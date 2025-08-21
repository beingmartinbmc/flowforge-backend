import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { redis, QUEUE_NAMES } from '@/lib/redis';
import { TaskService } from '@/services/task-service';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST' || req.method === 'GET') {
      console.log('Scheduler triggered: Processing tasks');
      
      let processedTasks = 0;
      let results = [];

      // Method 1: Process tasks from Redis queue
      let redisTasksProcessed = 0;
      for (let i = 0; i < 10; i++) {
        const taskMessage = await redis.rpop(QUEUE_NAMES.TASK_QUEUE);
        if (!taskMessage) break;

        const message = typeof taskMessage === 'string' ? JSON.parse(taskMessage) : taskMessage;
        
        if (message.taskId) {
          try {
            console.log(`Processing Redis task: ${message.taskId}`);
            await TaskService.processTask(message.taskId);
            results.push({ taskId: message.taskId, status: 'processed', source: 'redis' });
            processedTasks++;
            redisTasksProcessed++;
          } catch (error: any) {
            console.error(`Error processing Redis task ${message.taskId}:`, error);
            results.push({ taskId: message.taskId, status: 'error', error: error.message, source: 'redis' });
          }
        }
      }

      // Method 2: Process pending tasks from MongoDB
      const pendingTasks = await prisma.task.findMany({
        where: { status: 'PENDING' },
        take: 10,
        orderBy: { createdAt: 'asc' },
        include: {
          run: {
            include: {
              workflow: true
            }
          }
        }
      });

      console.log(`Found ${pendingTasks.length} pending tasks in MongoDB`);

      for (const task of pendingTasks) {
        try {
          console.log(`Processing MongoDB task: ${task.id} (${task.nodeId})`);
          
          // Update task status to running
          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'RUNNING',
              startedAt: new Date(),
            },
          });

          // Process the task
          await TaskService.processTask(task.id);
          
          results.push({ 
            taskId: task.id, 
            nodeId: task.nodeId,
            status: 'processed', 
            source: 'mongodb' 
          });
          processedTasks++;
          
        } catch (error: any) {
          console.error(`Error processing MongoDB task ${task.id}:`, error);
          
          // Update task status to failed
          await prisma.task.update({
            where: { id: task.id },
            data: {
              status: 'FAILED',
              error: error.message,
              completedAt: new Date(),
            },
          });
          
          results.push({ 
            taskId: task.id, 
            nodeId: task.nodeId,
            status: 'error', 
            error: error.message,
            source: 'mongodb' 
          });
        }
      }

      // Method 3: Handle stuck tasks
      const stuckTasks = await prisma.task.findMany({
        where: {
          status: 'RUNNING',
          startedAt: {
            lt: new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
          }
        },
        take: 5,
        include: {
          run: {
            include: {
              workflow: true
            }
          }
        }
      });

      for (const task of stuckTasks) {
        try {
          console.log(`Processing stuck task: ${task.id}`);
          await TaskService.processTask(task.id);
          results.push({ 
            taskId: task.id, 
            nodeId: task.nodeId,
            status: 'processed_stuck',
            source: 'mongodb' 
          });
          processedTasks++;
        } catch (error: any) {
          console.error(`Error processing stuck task ${task.id}:`, error);
          results.push({ 
            taskId: task.id, 
            nodeId: task.nodeId,
            status: 'error_stuck', 
            error: error.message,
            source: 'mongodb' 
          });
        }
      }

      const response = {
        success: true,
        message: `Scheduler processed ${processedTasks} tasks`,
        processedTasks,
        redisTasksProcessed,
        pendingTasksFound: pendingTasks.length,
        stuckTasksFound: stuckTasks.length,
        results,
        timestamp: new Date().toISOString()
      };

      console.log('Scheduler completed:', response);
      res.status(200).json(response);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Scheduler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default withCors(handler);

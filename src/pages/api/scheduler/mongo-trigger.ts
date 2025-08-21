import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { TaskService } from '@/services/task-service';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { maxTasks = 10, runId } = req.body;
      
      let processedTasks = 0;
      let results = [];

      // Build query to find pending tasks
      const whereClause: any = { status: 'PENDING' };
      if (runId) {
        whereClause.runId = runId;
      }

      // Get pending tasks from database
      const pendingTasks = await prisma.task.findMany({
        where: whereClause,
        take: parseInt(maxTasks as string),
        orderBy: { createdAt: 'asc' },
        include: {
          run: {
            include: {
              workflow: true
            }
          }
        }
      });

      console.log(`Found ${pendingTasks.length} pending tasks to process`);

      // Process each pending task
      for (const task of pendingTasks) {
        try {
          console.log(`Processing task: ${task.id} (${task.nodeId})`);
          
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
            status: 'processed' 
          });
          processedTasks++;
          
        } catch (error: any) {
          console.error(`Error processing task ${task.id}:`, error);
          
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
            error: error.message 
          });
        }
      }

      // Also process any tasks that are stuck in RUNNING status for too long
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
            status: 'processed_stuck' 
          });
          processedTasks++;
        } catch (error: any) {
          console.error(`Error processing stuck task ${task.id}:`, error);
          results.push({ 
            taskId: task.id, 
            nodeId: task.nodeId,
            status: 'error_stuck', 
            error: error.message 
          });
        }
      }

      res.status(200).json({
        success: true,
        message: `MongoDB scheduler processed ${processedTasks} tasks`,
        processedTasks,
        pendingTasksFound: pendingTasks.length,
        stuckTasksFound: stuckTasks.length,
        results,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('MongoDB scheduler error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default withCors(handler);

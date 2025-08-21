import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { TaskService } from '@/services/task-service';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Verify cron secret if provided
    const cronSecret = req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;
    
    if (expectedSecret && cronSecret !== expectedSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'POST' || req.method === 'GET') {
      console.log('Cron job triggered: Processing pending tasks');
      
      let processedTasks = 0;
      let results = [];

      // Get pending tasks from database
      const pendingTasks = await prisma.task.findMany({
        where: { status: 'PENDING' },
        take: 20, // Process up to 20 tasks per cron run
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
          results.push({ 
            taskId: task.id, 
            nodeId: task.nodeId,
            status: 'error', 
            error: error.message 
          });
        }
      }

      // Also handle stuck tasks
      const stuckTasks = await prisma.task.findMany({
        where: {
          status: 'RUNNING',
          startedAt: {
            lt: new Date(Date.now() - 10 * 60 * 1000) // 10 minutes ago
          }
        },
        take: 10,
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

      const response = {
        success: true,
        message: `Cron processed ${processedTasks} tasks`,
        processedTasks,
        pendingTasksFound: pendingTasks.length,
        stuckTasksFound: stuckTasks.length,
        results,
        timestamp: new Date().toISOString()
      };

      console.log('Cron job completed:', response);
      res.status(200).json(response);
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Cron job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default withCors(handler);

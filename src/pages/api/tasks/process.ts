import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { redis, QUEUE_NAMES } from '@/lib/redis';
import { TaskService } from '@/services/task-service';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);

    if (req.method === 'POST') {
      const { taskId, runId, limit = 10 } = req.body;

      let processedTasks = 0;
      let results = [];

      if (taskId) {
        // Process specific task
        try {
          await TaskService.processTask(taskId);
          results.push({ taskId, status: 'processed' });
          processedTasks++;
        } catch (error: any) {
          results.push({ taskId, status: 'error', error: error.message });
        }
      } else if (runId) {
        // Process all pending tasks for a specific run
        const pendingTasks = await prisma.task.findMany({
          where: {
            runId,
            status: 'PENDING',
          },
          take: parseInt(limit as string),
        });

        for (const task of pendingTasks) {
          try {
            await TaskService.processTask(task.id);
            results.push({ taskId: task.id, status: 'processed' });
            processedTasks++;
          } catch (error: any) {
            results.push({ taskId: task.id, status: 'error', error: error.message });
          }
        }
      } else {
        // Process tasks from Redis queue
        const queueLimit = parseInt(limit as string);
        
        for (let i = 0; i < queueLimit; i++) {
          const taskMessage = await redis.rpop(QUEUE_NAMES.TASK_QUEUE);
          if (!taskMessage) break;

          const message = typeof taskMessage === 'string' ? JSON.parse(taskMessage) : taskMessage;
          
          if (message.taskId) {
            try {
              await TaskService.processTask(message.taskId);
              results.push({ taskId: message.taskId, status: 'processed' });
              processedTasks++;
            } catch (error: any) {
              results.push({ taskId: message.taskId, status: 'error', error: error.message });
            }
          }
        }
      }

      res.status(200).json({
        message: `Processed ${processedTasks} tasks`,
        processedTasks,
        results,
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Task processing API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default withCors(handler);

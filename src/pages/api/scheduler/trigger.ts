import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { redis, QUEUE_NAMES } from '@/lib/redis';
import { TaskService } from '@/services/task-service';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { maxTasks = 10, processRetryQueue = true } = req.body;
      
      let processedTasks = 0;
      let results = [];

      // Process main task queue
      for (let i = 0; i < maxTasks; i++) {
        const taskMessage = await redis.rpop(QUEUE_NAMES.TASK_QUEUE);
        if (!taskMessage) break;

        const message = typeof taskMessage === 'string' ? JSON.parse(taskMessage) : taskMessage;
        
        if (message.taskId) {
          try {
            console.log(`Processing task: ${message.taskId}`);
            await TaskService.processTask(message.taskId);
            results.push({ taskId: message.taskId, status: 'processed', queue: 'main' });
            processedTasks++;
          } catch (error: any) {
            console.error(`Error processing task ${message.taskId}:`, error);
            results.push({ taskId: message.taskId, status: 'error', error: error.message, queue: 'main' });
          }
        }
      }

      // Process retry queue if requested
      if (processRetryQueue) {
        const retryMessages = await redis.lrange(QUEUE_NAMES.RETRY_QUEUE, 0, -1);
        const now = Date.now();

        for (const message of retryMessages) {
          const parsedMessage = typeof message === 'string' ? JSON.parse(message) : message;
          if (parsedMessage.retryAt <= now) {
            await redis.lrem(QUEUE_NAMES.RETRY_QUEUE, 1, message);
            
            if (parsedMessage.taskId) {
              try {
                console.log(`Processing retry task: ${parsedMessage.taskId}`);
                await TaskService.processTask(parsedMessage.taskId);
                results.push({ taskId: parsedMessage.taskId, status: 'processed', queue: 'retry' });
                processedTasks++;
              } catch (error: any) {
                console.error(`Error processing retry task ${parsedMessage.taskId}:`, error);
                results.push({ taskId: parsedMessage.taskId, status: 'error', error: error.message, queue: 'retry' });
              }
            }
          }
        }
      }

      res.status(200).json({
        success: true,
        message: `Scheduler processed ${processedTasks} tasks`,
        processedTasks,
        results,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Scheduler trigger error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default withCors(handler);

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { TaskService } from '@/services/task-service';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { taskId } = req.body;

      if (!taskId) {
        return res.status(400).json({ error: 'Task ID is required' });
      }

      console.log(`Processing task: ${taskId}`);
      
      try {
        await TaskService.processTask(taskId);
        res.status(200).json({ 
          success: true, 
          message: `Task ${taskId} processed successfully` 
        });
      } catch (error: any) {
        console.error(`Error processing task ${taskId}:`, error);
        res.status(500).json({ 
          success: false, 
          error: error.message,
          taskId 
        });
      }
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Debug API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export default withCors(handler);

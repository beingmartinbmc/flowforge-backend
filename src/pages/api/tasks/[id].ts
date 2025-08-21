import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { redis, QUEUE_NAMES } from '@/lib/redis';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);
    const { id: taskId } = req.query;

    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'Task ID is required' });
    }

    if (req.method === 'GET') {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          run: {
            include: {
              workflow: { select: { nodes: true, edges: true } },
            },
          },
        },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get task logs
      const logs = await prisma.taskLog.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
      });

      // Enrich task with node information
      const workflow = task.run.workflow as any;
      const node = workflow.nodes.find((n: any) => n.id === task.nodeId);
      
      const enrichedTask = {
        ...task,
        nodeName: node?.name || task.nodeId,
        nodeType: node?.type || 'unknown',
        logs,
      };

      res.status(200).json({ task: enrichedTask });
    } else if (req.method === 'POST') {
      // Retry task
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: { run: true },
      });

      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (task.status !== 'FAILED') {
        return res.status(400).json({ error: 'Only failed tasks can be retried' });
      }

      // Reset task for retry
      await prisma.task.update({
        where: { id: taskId },
        data: {
          status: 'PENDING',
          retryCount: task.retryCount + 1,
          error: null,
          startedAt: null,
          completedAt: null,
        },
      });

      // Queue the task for retry
      await redis.lpush(QUEUE_NAMES.TASK_QUEUE, { taskId });

      // Log retry attempt
      await prisma.taskLog.create({
        data: {
          taskId,
          runId: task.runId,
          level: 'INFO',
          message: 'Task retry initiated',
          metadata: { retryCount: task.retryCount + 1 },
        },
      });

      res.status(200).json({ message: 'Task queued for retry' });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Task API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default withCors(handler);

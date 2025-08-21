import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);
    const { id: runId } = req.query;

    if (!runId || typeof runId !== 'string') {
      return res.status(400).json({ error: 'Run ID is required' });
    }

    if (req.method === 'GET') {
      const run = await prisma.run.findUnique({
        where: { id: runId },
        include: {
          workflow: {
            select: { name: true, version: true, nodes: true, edges: true },
          },
          user: {
            select: { email: true },
          },
          tasks: {
            orderBy: { createdAt: 'asc' },
          },
          _count: {
            select: { tasks: true },
          },
        },
      });

      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      res.status(200).json({ run });
    } else if (req.method === 'DELETE') {
      // Cancel run
      const run = await prisma.run.findUnique({
        where: { id: runId },
        include: { tasks: true },
      });

      if (!run) {
        return res.status(404).json({ error: 'Run not found' });
      }

      if (run.status === 'SUCCESS' || run.status === 'FAILED') {
        return res.status(400).json({ error: 'Cannot cancel completed run' });
      }

      // Update run status
      await prisma.run.update({
        where: { id: runId },
        data: { 
          status: 'CANCELED',
          completedAt: new Date(),
        },
      });

      // Cancel all pending/running tasks
      await prisma.task.updateMany({
        where: {
          runId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: {
          status: 'CANCELED',
          completedAt: new Date(),
        },
      });

      res.status(200).json({ message: 'Run canceled successfully' });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Run API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

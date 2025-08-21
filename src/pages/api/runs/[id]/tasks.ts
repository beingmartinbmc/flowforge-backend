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
      const tasks = await prisma.task.findMany({
        where: { runId },
        orderBy: { createdAt: 'asc' },
        include: {
          run: {
            select: { workflow: { select: { nodes: true, edges: true } } },
          },
        },
      });

      // Enrich tasks with node information
      const enrichedTasks = tasks.map(task => {
        const workflow = task.run.workflow as any;
        const node = workflow.nodes.find((n: any) => n.id === task.nodeId);
        return {
          ...task,
          nodeName: node?.name || task.nodeId,
          nodeType: node?.type || 'unknown',
        };
      });

      res.status(200).json({ tasks: enrichedTasks });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Run tasks API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);
    const { id } = req.query;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    if (req.method === 'GET') {
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: {
          runs: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      res.status(200).json({ workflow });
    } else if (req.method === 'PUT') {
      const { name, description, nodes, edges, isActive } = req.body;

      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      const updatedWorkflow = await prisma.workflow.update({
        where: { id },
        data: {
          name: name || workflow.name,
          description: description !== undefined ? description : workflow.description,
          nodes: nodes || workflow.nodes,
          edges: edges || workflow.edges,
          isActive: isActive !== undefined ? isActive : workflow.isActive,
        },
      });

      res.status(200).json({ workflow: updatedWorkflow });
    } else if (req.method === 'DELETE') {
      const workflow = await prisma.workflow.findUnique({
        where: { id },
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      await prisma.workflow.update({
        where: { id },
        data: { isActive: false },
      });

      res.status(200).json({ message: 'Workflow deleted successfully' });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Workflow API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

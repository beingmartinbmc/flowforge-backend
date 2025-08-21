import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);

    if (req.method === 'GET') {
      const { page = '1', limit = '10' } = req.query;
      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const workflows = await prisma.workflow.findMany({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        include: {
          _count: {
            select: { runs: true },
          },
        },
      });

      const total = await prisma.workflow.count({
        where: { isActive: true },
      });

      res.status(200).json({
        workflows,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } else if (req.method === 'POST') {
      const { name, description, nodes, edges } = req.body;

      if (!name || !nodes || !edges) {
        return res.status(400).json({ error: 'Name, nodes, and edges are required' });
      }

      // Get the latest version
      const latestVersion = await prisma.workflow.findFirst({
        where: { name },
        orderBy: { version: 'desc' },
        select: { version: true },
      });

      const newVersion = (latestVersion?.version || 0) + 1;

      const workflow = await prisma.workflow.create({
        data: {
          name,
          description,
          version: newVersion,
          nodes,
          edges,
          isActive: true,
        },
      });

      res.status(201).json({ workflow });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Workflows API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

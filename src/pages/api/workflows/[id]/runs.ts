import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { redis, QUEUE_NAMES } from '@/lib/redis';
import { v4 as uuidv4 } from 'uuid';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);
    const { id: workflowId } = req.query;

    if (!workflowId || typeof workflowId !== 'string') {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    if (req.method === 'POST') {
      const { input = {} } = req.body;

      // Get the workflow
      const workflow = await prisma.workflow.findUnique({
        where: { id: workflowId },
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      if (!workflow.isActive) {
        return res.status(400).json({ error: 'Workflow is not active' });
      }

      // Create a new run
      const run = await prisma.run.create({
        data: {
          workflowId,
          workflowVersion: workflow.version,
          status: 'PENDING',
          input,
          triggeredBy: authToken.userId,
        },
      });

      // Get workflow nodes and edges
      const nodes = workflow.nodes as any[];
      const edges = workflow.edges as any[];

      // Find initial tasks (nodes with no incoming edges)
      const initialNodes = nodes.filter((node: any) => {
        return !edges.some((edge: any) => edge.target === node.id);
      });

      // Create tasks for initial nodes
      for (const node of initialNodes) {
        const task = await prisma.task.create({
          data: {
            runId: run.id,
            workflowId,
            nodeId: node.id,
            status: 'PENDING',
            input,
            idempotencyKey: `${run.id}-${node.id}`,
          },
        });

        // Queue the task
        await redis.lpush(QUEUE_NAMES.TASK_QUEUE, { taskId: task.id });
      }

      // Update run status to running
      await prisma.run.update({
        where: { id: run.id },
        data: { status: 'RUNNING' },
      });

      res.status(201).json({ run });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Workflow runs API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default withCors(handler);

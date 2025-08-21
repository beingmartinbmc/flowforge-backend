import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      const { force = false, deleteRuns = false } = req.query;
      
      const workflow = await prisma.workflow.findUnique({
        where: { id },
        include: {
          runs: {
            include: {
              tasks: true,
              _count: {
                select: { tasks: true }
              }
            }
          },
          _count: {
            select: { runs: true }
          }
        }
      });

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Check if workflow has runs
      if (workflow._count.runs > 0 && !force) {
        return res.status(400).json({ 
          error: 'Workflow has runs and cannot be deleted. Use force=true to delete anyway.',
          runsCount: workflow._count.runs
        });
      }

      if (force && deleteRuns) {
        // Delete all related data: tasks, runs, then workflow
        console.log(`Force deleting workflow ${id} with all runs`);
        
        // Delete all tasks for all runs
        for (const run of workflow.runs) {
          await prisma.task.deleteMany({
            where: { runId: run.id }
          });
          
          // Delete task logs
          await prisma.taskLog.deleteMany({
            where: { runId: run.id }
          });
        }
        
        // Delete all runs
        await prisma.run.deleteMany({
          where: { workflowId: id }
        });
        
        // Delete the workflow
        await prisma.workflow.delete({
          where: { id }
        });
        
        res.status(200).json({ 
          message: 'Workflow and all related data deleted successfully',
          deletedRuns: workflow._count.runs,
          deletedTasks: workflow.runs.reduce((sum, run) => sum + run._count.tasks, 0)
        });
      } else if (force) {
        // Just delete the workflow, keep runs
        await prisma.workflow.delete({
          where: { id }
        });
        
        res.status(200).json({ 
          message: 'Workflow deleted successfully (runs preserved)',
          preservedRuns: workflow._count.runs
        });
      } else {
        // Soft delete (set isActive to false)
        await prisma.workflow.update({
          where: { id },
          data: { isActive: false },
        });
        
        res.status(200).json({ 
          message: 'Workflow deactivated successfully',
          runsCount: workflow._count.runs
        });
      }
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

export default withCors(handler);

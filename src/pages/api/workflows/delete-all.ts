import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);

    if (req.method === 'POST') {
      const { force = false, deleteRuns = false, onlyInactive = false } = req.body;

      // Build where clause
      const whereClause: any = {};
      if (onlyInactive) {
        whereClause.isActive = false;
      }

      // Get all workflows
      const workflows = await prisma.workflow.findMany({
        where: whereClause,
        include: {
          runs: {
            include: {
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

      if (workflows.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'No workflows found to delete',
          summary: {
            totalWorkflows: 0,
            deleted: 0,
            deactivated: 0,
            errors: 0
          }
        });
      }

      // Check if any workflows have runs
      const workflowsWithRuns = workflows.filter(w => w._count.runs > 0);
      if (workflowsWithRuns.length > 0 && !force) {
        return res.status(400).json({
          error: 'Some workflows have runs and cannot be deleted. Use force=true to delete anyway.',
          workflowsWithRuns: workflowsWithRuns.map(w => ({
            id: w.id,
            name: w.name,
            runsCount: w._count.runs
          }))
        });
      }

      let totalDeleted = 0;
      let totalDeactivated = 0;
      let totalErrors = 0;
      const results = [];

      for (const workflow of workflows) {
        try {
          if (force && deleteRuns) {
            // Delete all related data: tasks, runs, then workflow
            console.log(`Force deleting workflow ${workflow.id} with all runs`);
            
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
              where: { workflowId: workflow.id }
            });
            
            // Delete the workflow
            await prisma.workflow.delete({
              where: { id: workflow.id }
            });
            
            results.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              status: 'deleted',
              message: 'Workflow and all related data deleted successfully',
              deletedRuns: workflow._count.runs,
              deletedTasks: workflow.runs.reduce((sum, run) => sum + run._count.tasks, 0)
            });
            totalDeleted++;
            
          } else if (force) {
            // Just delete the workflow, keep runs
            await prisma.workflow.delete({
              where: { id: workflow.id }
            });
            
            results.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              status: 'deleted',
              message: 'Workflow deleted successfully (runs preserved)',
              preservedRuns: workflow._count.runs
            });
            totalDeleted++;
            
          } else {
            // Soft delete (set isActive to false)
            await prisma.workflow.update({
              where: { id: workflow.id },
              data: { isActive: false },
            });
            
            results.push({
              workflowId: workflow.id,
              workflowName: workflow.name,
              status: 'deactivated',
              message: 'Workflow deactivated successfully',
              runsCount: workflow._count.runs
            });
            totalDeactivated++;
          }

        } catch (error: any) {
          console.error(`Error processing workflow ${workflow.id}:`, error);
          results.push({
            workflowId: workflow.id,
            workflowName: workflow.name,
            status: 'error',
            error: error.message
          });
          totalErrors++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Delete all operation completed`,
        summary: {
          totalWorkflows: workflows.length,
          deleted: totalDeleted,
          deactivated: totalDeactivated,
          errors: totalErrors
        },
        results
      });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Delete all API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default withCors(handler);

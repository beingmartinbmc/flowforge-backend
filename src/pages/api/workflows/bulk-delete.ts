import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { redis, QUEUE_NAMES, STREAM_NAMES } from '@/lib/redis';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);

    if (req.method === 'POST') {
      const { workflowIds, force = false, deleteRuns = false } = req.body;

      if (!workflowIds || !Array.isArray(workflowIds) || workflowIds.length === 0) {
        return res.status(400).json({ error: 'workflowIds array is required' });
      }

      if (workflowIds.length > 50) {
        return res.status(400).json({ error: 'Cannot delete more than 50 workflows at once' });
      }

      const results = [];
      let totalDeleted = 0;
      let totalDeactivated = 0;
      let totalErrors = 0;

      for (const workflowId of workflowIds) {
        try {
          const workflow = await prisma.workflow.findUnique({
            where: { id: workflowId },
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

          if (!workflow) {
            results.push({
              workflowId,
              status: 'error',
              error: 'Workflow not found'
            });
            totalErrors++;
            continue;
          }

          // Check if workflow has runs
          if (workflow._count.runs > 0 && !force) {
            results.push({
              workflowId,
              status: 'error',
              error: 'Workflow has runs and cannot be deleted. Use force=true to delete anyway.',
              runsCount: workflow._count.runs
            });
            totalErrors++;
            continue;
          }

          if (force && deleteRuns) {
            // Delete all related data: tasks, runs, then workflow
            console.log(`Force deleting workflow ${workflowId} with all runs`);
            
            // Clean up Redis data for this workflow
            try {
              // Remove workflow-related keys from Redis
              const workflowKeys = await redis.keys(`workflow:${workflowId}:*`);
              if (workflowKeys.length > 0) {
                await redis.del(...workflowKeys);
              }
              
              // Remove run-related keys from Redis
              for (const run of workflow.runs) {
                const runKeys = await redis.keys(`run:${run.id}:*`);
                if (runKeys.length > 0) {
                  await redis.del(...runKeys);
                }
                
                // Remove task-related keys from Redis
                const taskKeys = await redis.keys(`task:*:run:${run.id}`);
                if (taskKeys.length > 0) {
                  await redis.del(...taskKeys);
                }
              }
              
              console.log(`Cleaned up Redis data for workflow ${workflowId}`);
            } catch (redisError) {
              console.error(`Redis cleanup error for workflow ${workflowId}:`, redisError);
              // Continue with deletion even if Redis cleanup fails
            }
            
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
              where: { workflowId }
            });
            
            // Delete the workflow
            await prisma.workflow.delete({
              where: { id: workflowId }
            });
            
            results.push({
              workflowId,
              status: 'deleted',
              message: 'Workflow and all related data deleted successfully',
              deletedRuns: workflow._count.runs,
              deletedTasks: workflow.runs.reduce((sum, run) => sum + run._count.tasks, 0)
            });
            totalDeleted++;
            
          } else if (force) {
            // Just delete the workflow, keep runs
            await prisma.workflow.delete({
              where: { id: workflowId }
            });
            
            results.push({
              workflowId,
              status: 'deleted',
              message: 'Workflow deleted successfully (runs preserved)',
              preservedRuns: workflow._count.runs
            });
            totalDeleted++;
            
          } else {
            // Soft delete (set isActive to false)
            await prisma.workflow.update({
              where: { id: workflowId },
              data: { isActive: false },
            });
            
            results.push({
              workflowId,
              status: 'deactivated',
              message: 'Workflow deactivated successfully',
              runsCount: workflow._count.runs
            });
            totalDeactivated++;
          }

        } catch (error: any) {
          console.error(`Error processing workflow ${workflowId}:`, error);
          results.push({
            workflowId,
            status: 'error',
            error: error.message
          });
          totalErrors++;
        }
      }

      res.status(200).json({
        success: true,
        message: `Bulk operation completed`,
        summary: {
          totalProcessed: workflowIds.length,
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
    console.error('Bulk delete API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default withCors(handler);

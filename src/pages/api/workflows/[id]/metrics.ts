import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { withCors } from '@/lib/cors';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);
    const { id: workflowId } = req.query;

    if (!workflowId || typeof workflowId !== 'string') {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    if (req.method === 'GET') {
      // Get date range for metrics (last 30 days by default)
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      // Workflow-specific metrics
      const [
        totalRuns,
        successfulRuns,
        failedRuns,
        runningRuns,
        totalTasks,
        successfulTasks,
        failedTasks,
        retryTasks,
        recentRuns,
        taskMetrics,
        avgExecutionTimeData,
        lastRun,
      ] = await Promise.all([
        // Run counts
        prisma.run.count({ where: { workflowId } }),
        prisma.run.count({ where: { workflowId, status: 'SUCCESS' } }),
        prisma.run.count({ where: { workflowId, status: 'FAILED' } }),
        prisma.run.count({ where: { workflowId, status: 'RUNNING' } }),

        // Task counts
        prisma.task.count({ where: { workflowId } }),
        prisma.task.count({ where: { workflowId, status: 'SUCCESS' } }),
        prisma.task.count({ where: { workflowId, status: 'FAILED' } }),
        prisma.task.count({ where: { workflowId, status: 'RETRY' } }),

        // Recent runs
        prisma.run.findMany({
          where: { 
            workflowId,
            createdAt: { gte: startDate },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            user: { select: { email: true } },
            _count: { select: { tasks: true } },
          },
        }),

        // Task metrics by node
        prisma.task.groupBy({
          by: ['nodeId', 'status'],
          where: { workflowId },
          _count: { id: true },
        }),

        // Average execution time - simplified for now
        prisma.run.findMany({
          where: {
            workflowId,
            status: { in: ['SUCCESS', 'FAILED'] },
            completedAt: { not: null },
          },
          select: {
            startedAt: true,
            completedAt: true,
          },
        }),

        // Last run
        prisma.run.findFirst({
          where: { workflowId },
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { email: true } },
          },
        }),
      ]);

      // Calculate success rates
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
      const taskSuccessRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

      // Calculate average execution time
      const avgExecutionTime = avgExecutionTimeData.length > 0 
        ? avgExecutionTimeData.reduce((acc, run) => {
            const duration = run.completedAt!.getTime() - run.startedAt.getTime();
            return acc + duration;
          }, 0) / avgExecutionTimeData.length / 1000 // Convert to seconds
        : 0;

      // Process task metrics by node
      const nodeMetrics = taskMetrics.reduce((acc: any, task) => {
        if (!acc[task.nodeId]) {
          acc[task.nodeId] = { total: 0, success: 0, failed: 0, retry: 0 };
        }
        acc[task.nodeId].total += task._count.id;
        acc[task.nodeId][task.status.toLowerCase()] = task._count.id;
        return acc;
      }, {});

      const metrics = {
        overview: {
          totalRuns,
          successfulRuns,
          failedRuns,
          runningRuns,
          successRate: Math.round(successRate * 100) / 100,
          totalTasks,
          successfulTasks,
          failedTasks,
          retryTasks,
          taskSuccessRate: Math.round(taskSuccessRate * 100) / 100,
          avgExecutionTimeSeconds: Math.round(avgExecutionTime * 100) / 100,
          lastRunAt: lastRun?.createdAt,
        },
        recentRuns,
        nodeMetrics,
        lastRun,
      };

      res.status(200).json({ metrics });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Workflow metrics API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default withCors(handler);

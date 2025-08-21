import type { NextApiRequest, NextApiResponse } from 'next';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const authToken = requireAuth(req);

    if (req.method === 'GET') {
      // Get date range for metrics (last 7 days by default)
      const { days = '7' } = req.query;
      const daysNum = parseInt(days as string);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysNum);

      // System-wide metrics
      const [
        totalRuns,
        successfulRuns,
        failedRuns,
        runningRuns,
        totalTasks,
        successfulTasks,
        failedTasks,
        retryTasks,
        totalWorkflows,
        activeWorkflows,
        recentRuns,
        dailyRuns,
      ] = await Promise.all([
        // Total counts
        prisma.run.count(),
        prisma.run.count({ where: { status: 'SUCCESS' } }),
        prisma.run.count({ where: { status: 'FAILED' } }),
        prisma.run.count({ where: { status: 'RUNNING' } }),
        prisma.task.count(),
        prisma.task.count({ where: { status: 'SUCCESS' } }),
        prisma.task.count({ where: { status: 'FAILED' } }),
        prisma.task.count({ where: { status: 'RETRY' } }),
        prisma.workflow.count(),
        prisma.workflow.count({ where: { isActive: true } }),

        // Recent runs (last 10)
        prisma.run.findMany({
          where: { createdAt: { gte: startDate } },
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: {
            workflow: { select: { name: true } },
            user: { select: { email: true } },
          },
        }),

        // Daily run counts - simplified for now
        prisma.run.findMany({
          where: { createdAt: { gte: startDate } },
          select: {
            createdAt: true,
            status: true,
          },
        }),
      ]);

      // Calculate averages
      const successRate = totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0;
      const taskSuccessRate = totalTasks > 0 ? (successfulTasks / totalTasks) * 100 : 0;

      // Calculate average execution time - simplified for now
      const completedRuns = await prisma.run.findMany({
        where: {
          status: { in: ['SUCCESS', 'FAILED'] },
          completedAt: { not: null },
        },
        select: {
          startedAt: true,
          completedAt: true,
        },
      });

      const avgExecutionTime = completedRuns.length > 0 
        ? completedRuns.reduce((acc, run) => {
            const duration = run.completedAt!.getTime() - run.startedAt.getTime();
            return acc + duration;
          }, 0) / completedRuns.length / 1000 // Convert to seconds
        : 0;

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
          totalWorkflows,
          activeWorkflows,
          avgExecutionTimeSeconds: Math.round(avgExecutionTime * 100) / 100,
        },
        recentRuns,
        dailyRuns,
      };

      res.status(200).json({ metrics });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    console.error('Metrics API error:', error);
    if (error.message === 'Authentication required') {
      res.status(401).json({ error: 'Authentication required' });
    } else {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

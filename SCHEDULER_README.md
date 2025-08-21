# FlowForge Scheduler Solution

This document explains the scheduler-based approach for processing tasks in the FlowForge backend, designed to work with Vercel's serverless environment.

## Problem

The original task worker was a long-running process that continuously polled Redis queues. This doesn't work well with Vercel's serverless functions, which are stateless and don't support persistent processes.

## Solution

We've created a scheduler-based approach that can be triggered periodically to process tasks. This works much better with serverless environments.

## Scheduler Endpoints

### 1. Main Scheduler (`/api/scheduler/process`)
- **URL**: `POST/GET /api/scheduler/process`
- **Purpose**: Main scheduler that processes tasks from both Redis and MongoDB
- **Features**:
  - Processes tasks from Redis queue
  - Processes pending tasks from MongoDB
  - Handles stuck tasks (running for >5 minutes)
  - Returns detailed results

### 2. Redis-based Scheduler (`/api/scheduler/trigger`)
- **URL**: `POST /api/scheduler/trigger`
- **Purpose**: Processes tasks from Redis queue only
- **Parameters**:
  - `maxTasks`: Maximum tasks to process (default: 10)
  - `processRetryQueue`: Whether to process retry queue (default: true)

### 3. MongoDB-based Scheduler (`/api/scheduler/mongo-trigger`)
- **URL**: `POST /api/scheduler/mongo-trigger`
- **Purpose**: Processes pending tasks directly from MongoDB
- **Parameters**:
  - `maxTasks`: Maximum tasks to process (default: 10)
  - `runId`: Process tasks for specific run only (optional)

### 4. Cron Endpoint (`/api/cron/process-tasks`)
- **URL**: `GET/POST /api/cron/process-tasks`
- **Purpose**: Designed for external cron services
- **Security**: Supports `x-cron-secret` header for authentication

## Usage Examples

### Manual Trigger
```bash
# Trigger the main scheduler
curl -X POST https://your-vercel-app.vercel.app/api/scheduler/process

# Process specific number of tasks
curl -X POST https://your-vercel-app.vercel.app/api/scheduler/process \
  -H "Content-Type: application/json" \
  -d '{"maxTasks": 5}'
```

### Vercel Cron Jobs
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/scheduler/process",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

### External Cron Services
- **GitHub Actions**: Create a workflow that calls the cron endpoint
- **Cron-job.org**: Set up a cron job to hit the endpoint
- **Upstash QStash**: Use for reliable cron job scheduling

## Manual Processing Script

For immediate testing, use the `process-tasks.js` script:

```bash
node process-tasks.js
```

This script:
- Logs in as test3@example.com
- Finds all pending tasks
- Simulates task processing
- Shows what would happen if tasks were processed

## Deployment

1. **Deploy the new endpoints**:
   ```bash
   git add .
   git commit -m "Add scheduler endpoints"
   git push
   ```

2. **Set up Vercel Cron** (if using Vercel Pro):
   - Add cron configuration to `vercel.json`
   - Deploy to trigger automatic scheduling

3. **Set up external cron** (alternative):
   - Use GitHub Actions, Cron-job.org, or similar service
   - Call `/api/scheduler/process` every 30 seconds to 1 minute

## Benefits

1. **Serverless Compatible**: Works with Vercel's serverless functions
2. **Scalable**: Can process multiple tasks per trigger
3. **Reliable**: Handles stuck tasks and retries
4. **Flexible**: Multiple trigger methods (manual, cron, external)
5. **Cost Effective**: Only runs when needed

## Current Status

- ✅ Workflow creation works
- ✅ Task queuing works
- ✅ Scheduler endpoints created
- ⏳ Need to deploy scheduler endpoints
- ⏳ Need to set up cron triggers

## Next Steps

1. Deploy the scheduler endpoints to Vercel
2. Set up cron job triggers
3. Test the complete workflow execution
4. Monitor task processing performance

## Testing

After deployment, test with:

```bash
# Create a new workflow run
curl -X POST https://your-app.vercel.app/api/workflows/{workflowId}/runs \
  -H "Authorization: Bearer {token}" \
  -d '{"input": {"test": "data"}}'

# Trigger scheduler to process tasks
curl -X POST https://your-app.vercel.app/api/scheduler/process

# Check run status
curl -X GET https://your-app.vercel.app/api/runs/{runId} \
  -H "Authorization: Bearer {token}"
```

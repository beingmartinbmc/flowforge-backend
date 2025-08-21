# Workflow Deletion APIs

This document describes the various APIs available for deleting workflows in the FlowForge backend.

## Overview

The deletion system provides three levels of deletion:
1. **Soft Delete** - Sets `isActive: false` (default)
2. **Hard Delete** - Removes workflow but preserves runs
3. **Complete Delete** - Removes workflow and all related data

## API Endpoints

### 1. Single Workflow Deletion

**Endpoint**: `DELETE /api/workflows/[id]`

**Query Parameters**:
- `force` (boolean): Force deletion even if workflow has runs
- `deleteRuns` (boolean): Delete all runs and tasks when force=true

**Examples**:

```bash
# Soft delete (deactivate)
curl -X DELETE https://your-app.vercel.app/api/workflows/68a6e08cb4413c8a9702101c \
  -H "Authorization: Bearer {token}"

# Force delete workflow (keep runs)
curl -X DELETE "https://your-app.vercel.app/api/workflows/68a6e08cb4413c8a9702101c?force=true" \
  -H "Authorization: Bearer {token}"

# Force delete workflow and all runs
curl -X DELETE "https://your-app.vercel.app/api/workflows/68a6e08cb4413c8a9702101c?force=true&deleteRuns=true" \
  -H "Authorization: Bearer {token}"
```

**Response Examples**:

```json
// Soft delete
{
  "message": "Workflow deactivated successfully",
  "runsCount": 2
}

// Force delete with runs
{
  "message": "Workflow and all related data deleted successfully",
  "deletedRuns": 2,
  "deletedTasks": 4
}
```

### 2. Bulk Workflow Deletion

**Endpoint**: `POST /api/workflows/bulk-delete`

**Request Body**:
```json
{
  "workflowIds": ["id1", "id2", "id3"],
  "force": false,
  "deleteRuns": false
}
```

**Examples**:

```bash
# Bulk soft delete
curl -X POST https://your-app.vercel.app/api/workflows/bulk-delete \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIds": ["68a6e08cb4413c8a9702101c", "68a692ab17e6966b46fccb72"]
  }'

# Bulk force delete with runs
curl -X POST https://your-app.vercel.app/api/workflows/bulk-delete \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "workflowIds": ["68a6e08cb4413c8a9702101c"],
    "force": true,
    "deleteRuns": true
  }'
```

**Response**:
```json
{
  "success": true,
  "message": "Bulk operation completed",
  "summary": {
    "totalProcessed": 2,
    "deleted": 1,
    "deactivated": 1,
    "errors": 0
  },
  "results": [
    {
      "workflowId": "68a6e08cb4413c8a9702101c",
      "status": "deleted",
      "message": "Workflow and all related data deleted successfully",
      "deletedRuns": 2,
      "deletedTasks": 4
    },
    {
      "workflowId": "68a692ab17e6966b46fccb72",
      "status": "deactivated",
      "message": "Workflow deactivated successfully",
      "runsCount": 0
    }
  ]
}
```

### 3. Delete All Workflows

**Endpoint**: `POST /api/workflows/delete-all`

**Request Body**:
```json
{
  "force": false,
  "deleteRuns": false,
  "onlyInactive": false
}
```

**Examples**:

```bash
# Delete all inactive workflows
curl -X POST https://your-app.vercel.app/api/workflows/delete-all \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "onlyInactive": true
  }'

# Force delete all workflows and runs
curl -X POST https://your-app.vercel.app/api/workflows/delete-all \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "force": true,
    "deleteRuns": true
  }'
```

## Deletion Types

### 1. Soft Delete (Default)
- Sets `isActive: false`
- Preserves all data
- Can be reactivated later
- Safe operation

### 2. Hard Delete (force=true)
- Removes workflow from database
- Preserves runs and tasks
- Cannot be undone
- Use when you want to keep execution history

### 3. Complete Delete (force=true & deleteRuns=true)
- Removes workflow, runs, tasks, and logs
- Completely removes all related data
- Cannot be undone
- Use for complete cleanup

## Safety Features

1. **Run Protection**: Workflows with runs cannot be deleted without `force=true`
2. **Bulk Limits**: Maximum 50 workflows per bulk operation
3. **Detailed Results**: Each operation returns detailed status
4. **Error Handling**: Individual failures don't stop bulk operations

## Error Responses

```json
// Workflow has runs
{
  "error": "Workflow has runs and cannot be deleted. Use force=true to delete anyway.",
  "runsCount": 2
}

// Workflow not found
{
  "error": "Workflow not found"
}

// Invalid request
{
  "error": "workflowIds array is required"
}
```

## Best Practices

1. **Always use soft delete first** unless you're sure you want permanent deletion
2. **Test with a single workflow** before using bulk operations
3. **Check run counts** before force deleting
4. **Use `onlyInactive: true`** for cleanup operations
5. **Backup important data** before complete deletion

## Testing

Test the APIs with the test3@example.com workflow:

```bash
# Get authentication token
curl -X POST https://your-app.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test3@example.com", "password": "test@123"}'

# Test soft delete
curl -X DELETE https://your-app.vercel.app/api/workflows/68a6e08cb4413c8a9702101c \
  -H "Authorization: Bearer {token}"
```

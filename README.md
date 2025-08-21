# FlowForge Backend - Distributed Workflow Orchestrator

A robust, scalable backend system for orchestrating distributed workflows with support for task scheduling, retry mechanisms, and real-time monitoring.

## Features

- **Workflow Management**: Create, version, and manage workflow definitions
- **Task Execution**: Support for HTTP requests, echo operations, and extensible task types
- **Distributed Processing**: Redis-based queue system for scalable task processing
- **Retry Logic**: Exponential backoff with configurable retry limits
- **Dead Letter Queue**: Handle failed tasks that exceed retry limits
- **Real-time Updates**: WebSocket support for live status updates
- **Monitoring**: Comprehensive metrics and logging
- **Authentication**: JWT-based authentication system

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Task Worker   │
│   (Next.js)     │◄──►│   (Next.js)     │◄──►│   (Node.js)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │                       │
                                ▼                       ▼
                       ┌─────────────────┐    ┌─────────────────┐
                       │   MongoDB       │    │   Redis         │
                       │   (Database)    │    │   (Queues)      │
                       └─────────────────┘    └─────────────────┘
```

## Prerequisites

- Node.js 18+ 
- MongoDB (local or Atlas)
- Redis (local or Upstash)

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd flowforge-backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/flowforge
   
   # Redis Configuration
   REDIS_URL=redis://localhost:6379
   UPSTASH_REDIS_REST_URL=your_upstash_redis_url
   UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
   
   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here
   JWT_EXPIRES_IN=7d
   
   # Server Configuration
   PORT=3001
   NODE_ENV=development
   
   # CORS Configuration
   CORS_ORIGIN=http://localhost:3000
   ```

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate
   
   # Push schema to database
   npm run db:push
   
   # (Optional) Run migrations
   npm run db:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Workflows
- `GET /api/workflows` - List workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows/[id]` - Get workflow details
- `PUT /api/workflows/[id]` - Update workflow
- `DELETE /api/workflows/[id]` - Delete workflow
- `POST /api/workflows/[id]/runs` - Trigger workflow run
- `GET /api/workflows/[id]/metrics` - Get workflow metrics

### Runs
- `GET /api/runs` - List runs
- `GET /api/runs/[id]` - Get run details
- `DELETE /api/runs/[id]` - Cancel run
- `GET /api/runs/[id]/tasks` - Get tasks for run

### Tasks
- `GET /api/tasks/[id]` - Get task details
- `POST /api/tasks/[id]/retry` - Retry failed task

### Metrics
- `GET /api/metrics` - Get system metrics

### WebSocket
- `WS /api/ws` - Real-time updates

## Task Types

### HTTP Task
Make REST API calls with configurable methods, headers, and body.

```json
{
  "type": "http",
  "config": {
    "method": "POST",
    "url": "https://api.example.com/endpoint",
    "headers": {
      "Content-Type": "application/json"
    },
    "body": {
      "key": "value"
    },
    "timeout": 30000
  }
}
```

### Echo Task
Log messages with different levels.

```json
{
  "type": "echo",
  "config": {
    "message": "Task completed successfully",
    "level": "info"
  }
}
```

## Development

### Running Tests
```bash
npm test
```

### Database Management
```bash
# Open Prisma Studio
npm run db:studio

# Generate Prisma client
npm run db:generate

# Push schema changes
npm run db:push
```

### Type Checking
```bash
npm run type-check
```

## Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

3. **Environment variables for production**
   - Set `NODE_ENV=production`
   - Use production MongoDB and Redis instances
   - Configure proper CORS origins
   - Set strong JWT secrets

## Monitoring

The system provides comprehensive monitoring through:

- **Task Logs**: Detailed logs for each task execution
- **Metrics API**: System-wide and workflow-specific metrics
- **Dead Letter Queue**: Failed tasks that exceeded retry limits
- **Real-time Updates**: WebSocket events for live status

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License
# flowforge-backend

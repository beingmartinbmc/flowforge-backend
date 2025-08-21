import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { SchedulerService } from './services/scheduler-service';
import { taskWorker } from './workers/task-worker';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3001', 10);

// Prepare the Next.js app
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    await app.prepare();
    
    // Start the scheduler service
    console.log('Starting scheduler service...');
    await SchedulerService.startScheduler();
    
    // Start the task worker
    console.log('Starting task worker...');
    taskWorker.start();
    
    // Create HTTP server
    const server = createServer(async (req, res) => {
      try {
        const parsedUrl = parse(req.url!, true);
        await handle(req, res, parsedUrl);
      } catch (err) {
        console.error('Error occurred handling request:', err);
        res.statusCode = 500;
        res.end('Internal Server Error');
      }
    });

    server.listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log('> FlowForge Backend is running');
      console.log('> Scheduler service: Active');
      console.log('> Task worker: Active');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        taskWorker.stop();
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully...');
      server.close(() => {
        console.log('HTTP server closed');
        taskWorker.stop();
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

startServer();

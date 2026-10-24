import { app } from './app.js';
import { env } from './config/env.js';
import { schedulerService } from './services/scheduler.service.js';

const server = app.listen(env.PORT, async () => {
  console.log(`Focus Tracker API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`Health check: http://localhost:${env.PORT}/api/v1/health`);

  // Initialize in-process cron scheduler if not in test mode
  if (env.NODE_ENV !== 'test') {
    try {
      await schedulerService.initScheduler();
    } catch (err) {
      console.error('Failed to initialize scheduler on startup:', err);
    }
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  schedulerService.stopScheduler();
  server.close(() => {
    console.log('API process terminated');
    process.exit(0);
  });
});

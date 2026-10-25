import { app } from './app.js';
import { env } from './config/env.js';
import { client } from './db/index.js';
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

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`\n[${signal}] Signal received. Starting graceful shutdown...`);

  // Force exit safety timeout (10 seconds)
  const forceExitTimeout = setTimeout(() => {
    console.error('⚠️ Graceful shutdown timed out after 10s. Forcing exit.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    // 1. Stop background cron jobs
    schedulerService.stopScheduler();
    console.log('✓ In-process scheduler stopped');

    // 2. Stop accepting new HTTP connections and close idle connections
    await new Promise<void>((resolve, reject) => {
      server.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    console.log('✓ HTTP server closed');

    // 3. Drain and close database connection pool
    await client.end({ timeout: 5 });
    console.log('✓ Database pool closed');

    clearTimeout(forceExitTimeout);
    console.log('API process terminated cleanly.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error during graceful shutdown:', err);
    clearTimeout(forceExitTimeout);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

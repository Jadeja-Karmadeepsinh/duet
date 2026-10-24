import { app } from './app.js';
import { env } from './config/env.js';

const server = app.listen(env.PORT, () => {
  console.log(`Focus Tracker API server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  console.log(`Health check: http://localhost:${env.PORT}/api/v1/health`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('API process terminated');
    process.exit(0);
  });
});

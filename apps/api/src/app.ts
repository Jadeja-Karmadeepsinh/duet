import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection } from './db/index.js';
import { getAsiaKolkataDateTimeString } from './utils/timezone.js';

export const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

// Request logging (concise in dev)
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoints
const handleHealthCheck = async (_req: Request, res: Response) => {
  const dbHealth = await checkDatabaseConnection();
  const now = new Date();

  const isHealthy = dbHealth.ok;
  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'ok' : 'degraded',
      serverTimeUtc: now.toISOString(),
      serverTimeAsiaKolkata: getAsiaKolkataDateTimeString(now),
      database: dbHealth.ok ? 'connected' : 'error',
      databaseError: dbHealth.error,
    },
  });
};

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);
app.get('/api/v1/health', handleHealthCheck);

// 404 handler for unmatched routes
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API route does not exist.',
    },
  });
});

// Global error handler adhering to API envelope
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const statusCode = err.status || err.statusCode || 500;
  console.error('Unhandled API Error:', err);

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected internal error occurred.',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
});

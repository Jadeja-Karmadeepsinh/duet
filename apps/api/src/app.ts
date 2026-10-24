import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { checkDatabaseConnection } from './db/index.js';
import { getAsiaKolkataDateTimeString } from './utils/timezone.js';
import { authRouter } from './routes/auth.js';
import { taskRouter } from './routes/tasks.js';
import { workSessionRouter } from './routes/work-sessions.js';
import { statsRouter } from './routes/stats.js';
import { AppError } from './utils/errors.js';
import { ZodError } from 'zod';

export const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json());

// Request logging (sanitized, never logs credentials, cookies, tokens, or PINs)
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoints (Public)
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

// Application routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/tasks', taskRouter);
app.use('/api/v1/work-sessions', workSessionRouter);
app.use('/api/v1/stats', statsRouter);


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

// Global error handler adhering to API contract envelope
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request payload',
        details: err.format(),
      },
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  if (process.env.NODE_ENV !== 'test') {
    console.error('Unhandled API Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'An unexpected internal error occurred.',
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
});

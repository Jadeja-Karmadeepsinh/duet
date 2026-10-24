import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { analyticsQuerySchema, type AnalyticsQuery } from '../schemas/analytics.js';
import { analyticsService, type AnalyticsRange } from '../services/analytics.service.js';
import { asyncHandler } from '../utils/errors.js';

export const analyticsRouter = Router();

// Protect all analytics endpoints with authentication
analyticsRouter.use(requireAuth);

/**
 * GET /api/v1/analytics
 * Returns comprehensive analytics summary, time series, category breakdown, and prior-period metrics.
 * Query: range = '7d' | '30d' | '90d' | '1y' | 'lifetime' (default: '7d')
 */
analyticsRouter.get(
  '/',
  validateQuery(analyticsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = ((req as any).validatedQuery || req.query) as AnalyticsQuery;
    const range = (query.range || '7d') as AnalyticsRange;

    const data = await analyticsService.getAnalytics(userId, range);

    res.status(200).json({
      success: true,
      data,
    });
  })
);

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import { asyncHandler } from '../utils/errors.js';
import type { LeaderboardSlot } from '../utils/timezone.js';

export const leaderboardRouter = Router();

// Require user authentication for viewing the leaderboard
leaderboardRouter.use(requireAuth);

const leaderboardQuerySchema = z.object({
  period: z.enum(['today', '7d']).default('today'),
  slot: z.enum(['10:00', '18:00', '22:00']).optional(),
});

type LeaderboardQuery = z.infer<typeof leaderboardQuerySchema>;

/**
 * GET /api/v1/leaderboard
 * Returns official checkpoint standings or provisional live standings.
 * Query: period = 'today' | '7d' (default: 'today'), slot = '10:00' | '18:00' | '22:00' (optional)
 */
leaderboardRouter.get(
  '/',
  validateQuery(leaderboardQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = ((req as any).validatedQuery || req.query) as LeaderboardQuery;
    const period = query.period || 'today';
    const slot = query.slot as LeaderboardSlot | undefined;

    const data = await leaderboardService.getLeaderboard(period, userId, slot);

    res.status(200).json({
      success: true,
      data,
    });
  })
);

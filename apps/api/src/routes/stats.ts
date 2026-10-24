import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  updatePreferencesSchema,
  dayDetailsQuerySchema,
  contributionsQuerySchema,
  type UpdatePreferencesInput,
  type DayDetailsQuery,
  type ContributionsQuery,
} from '../schemas/stats.js';
import { statsService } from '../services/stats.service.js';
import { asyncHandler } from '../utils/errors.js';
import { db } from '../db/index.js';
import {
  leaderboardSnapshotRuns,
  leaderboardSnapshotEntries,
  users,
} from '../db/schema/index.js';
import { eq, desc } from 'drizzle-orm';
import { getAsiaKolkataDateString } from '../utils/timezone.js';

export const statsRouter = Router();

// Protect all stats endpoints with authentication
statsRouter.use(requireAuth);

/**
 * GET /api/v1/stats/summary
 * Returns today's active focus time, completed tasks, daily goal progress, and streaks.
 */
statsRouter.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const summary = await statsService.getSummary(userId);

    res.status(200).json({
      success: true,
      data: summary,
    });
  })
);

/**
 * GET /api/v1/stats/contributions
 * Returns GitHub-style contribution grid for the past 26 weeks (~182 days).
 */
statsRouter.get(
  '/contributions',
  validateQuery(contributionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = ((req as any).validatedQuery || req.query) as ContributionsQuery;
    const weeks = query.weeks ?? 26;

    const data = await statsService.getContributions(userId, weeks);

    res.status(200).json({
      success: true,
      data,
    });
  })
);

/**
 * GET /api/v1/stats/day
 * Returns day detail completions and sessions for a clicked date.
 */
statsRouter.get(
  '/day',
  validateQuery(dayDetailsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = ((req as any).validatedQuery || req.query) as DayDetailsQuery;

    const details = await statsService.getDayDetails(userId, query.date);

    res.status(200).json({
      success: true,
      data: details,
    });
  })
);

/**
 * GET /api/v1/stats/preferences
 * Returns persistent user preferences.
 */
statsRouter.get(
  '/preferences',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const prefs = await statsService.getUserPreferences(userId);

    res.status(200).json({
      success: true,
      data: prefs,
    });
  })
);

/**
 * PATCH /api/v1/stats/preferences
 * Updates user preferences (e.g. dailyGoalSeconds).
 */
statsRouter.patch(
  '/preferences',
  validateBody(updatePreferencesSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { dailyGoalSeconds } = req.body as UpdatePreferencesInput;

    const prefs = await statsService.updateUserPreferences(userId, dailyGoalSeconds);

    res.status(200).json({
      success: true,
      data: prefs,
    });
  })
);

/**
 * GET /api/v1/stats/leaderboard-preview
 * Returns today's latest snapshot run if captured, or provisional standings overview.
 */
statsRouter.get(
  '/leaderboard-preview',
  asyncHandler(async (_req: Request, res: Response) => {
    const todayDate = getAsiaKolkataDateString(new Date());

    // Check if there is an official snapshot run for today
    const [latestRun] = await db
      .select()
      .from(leaderboardSnapshotRuns)
      .where(eq(leaderboardSnapshotRuns.localDate, todayDate))
      .orderBy(desc(leaderboardSnapshotRuns.capturedAt))
      .limit(1);

    if (latestRun) {
      const entries = await db
        .select()
        .from(leaderboardSnapshotEntries)
        .where(eq(leaderboardSnapshotEntries.snapshotRunId, latestRun.id))
        .orderBy(desc(leaderboardSnapshotEntries.focusSecondsToday));

      return res.status(200).json({
        success: true,
        data: {
          hasSnapshot: true,
          slot: latestRun.slot,
          capturedAt: latestRun.capturedAt,
          localDate: latestRun.localDate,
          entries: entries.slice(0, 4).map((e) => ({
            userId: e.userId,
            displayName: e.displayNameSnapshot,
            focusSecondsToday: e.focusSecondsToday,
            completedTasksToday: e.completedTasksToday,
          })),
        },
      });
    }

    // No snapshot run yet today: provide provisional active profiles count
    const activeProfiles = await db
      .select({
        id: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.isActive, true));

    return res.status(200).json({
      success: true,
      data: {
        hasSnapshot: false,
        status: 'provisional',
        localDate: todayDate,
        activeProfileCount: activeProfiles.length,
        nextScheduledSlot: '10:00',
      },
    });
  })
);

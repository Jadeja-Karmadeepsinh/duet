import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import { UnauthorizedError, asyncHandler } from '../utils/errors.js';
import { getSlotScheduledUtc, type LeaderboardSlot } from '../utils/timezone.js';

export const jobsRouter = Router();

/**
 * Constant-time comparison to prevent timing attacks when verifying CRON_SECRET.
 */
function verifyCronSecret(providedSecret?: string): boolean {
  if (!providedSecret || typeof providedSecret !== 'string') {
    return false;
  }

  const expectedSecret = env.CRON_SECRET || env.JOB_SECRET;
  if (!expectedSecret) {
    return false;
  }

  const providedBuffer = Buffer.from(providedSecret);
  const expectedBuffer = Buffer.from(expectedSecret);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Middleware protecting internal cron/job endpoints.
 * Never callable by normal session authentication.
 */
function requireCronSecret(req: Request, _res: Response, next: () => void) {
  // Support either X-Cron-Secret header or Authorization: Bearer <secret>
  const headerSecret = req.headers['x-cron-secret'] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerSecret = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  const provided = headerSecret || bearerSecret;

  if (!verifyCronSecret(provided)) {
    throw new UnauthorizedError('Unauthorized: Invalid or missing cron secret.');
  }

  next();
}

/**
 * POST /api/v1/jobs/leaderboard-snapshot
 * Internal protected endpoint for scheduled snapshot processing.
 * Can be called by external schedulers (e.g. cron-job.org, Cloudflare Workers, GitHub Actions)
 * when the API server sleeps or scales to zero.
 *
 * Body (optional):
 * - date: "YYYY-MM-DD"
 * - slot: "10:00" | "18:00" | "22:00"
 */
jobsRouter.post(
  '/leaderboard-snapshot',
  requireCronSecret,
  asyncHandler(async (req: Request, res: Response) => {
    const { date, slot } = req.body || {};

    // Specific slot requested
    if (date && slot) {
      const scheduledUtc = getSlotScheduledUtc(date, slot as LeaderboardSlot);
      const run = await leaderboardService.captureSnapshot(
        date,
        slot as LeaderboardSlot,
        scheduledUtc
      );

      return res.status(200).json({
        success: true,
        message: `Snapshot captured for ${date} @ ${slot} IST`,
        data: {
          runId: run.id,
          localDate: run.localDate,
          slot: run.slot,
          isDelayed: run.isDelayed,
          capturedAt: run.capturedAt,
        },
      });
    }

    // Default: detect and process all due/missing slots
    const results = await leaderboardService.processDueSnapshots();

    res.status(200).json({
      success: true,
      message: 'Processed due snapshot checkpoints.',
      data: {
        results,
      },
    });
  })
);

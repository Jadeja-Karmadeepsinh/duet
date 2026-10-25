import { Router, type Request, type Response } from 'express';
import crypto from 'crypto';
import { env } from '../config/env.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import { UnauthorizedError, asyncHandler, ForbiddenError } from '../utils/errors.js';
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
 *
 * Security Guarantee:
 * - Rejects any query string secrets (?secret=... or ?cron_secret=...) to prevent
 *   leakage in server access logs, proxy logs, or browser histories.
 * - Requires Authorization: Bearer <CRON_SECRET> or X-Cron-Secret: <CRON_SECRET>.
 */
function requireCronSecret(req: Request, _res: Response, next: () => void) {
  // Reject query parameter tokens explicitly
  if (req.query.secret || req.query.cron_secret || req.query.key) {
    throw new ForbiddenError(
      'Passing secrets in URL query parameters is forbidden to prevent access log leakage. Use Authorization: Bearer <CRON_SECRET> or X-Cron-Secret header instead.'
    );
  }

  // Support either X-Cron-Secret header or Authorization: Bearer <secret>
  const headerSecret = req.headers['x-cron-secret'] as string | undefined;
  const authHeader = req.headers.authorization;
  const bearerSecret = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : undefined;

  const provided = headerSecret || bearerSecret;

  if (!verifyCronSecret(provided)) {
    throw new UnauthorizedError('Unauthorized: Invalid or missing cron secret header.');
  }

  next();
}

/**
 * Handler for snapshot processing.
 * Supports both automatic due-snapshot capture (default) and specific slot execution.
 */
const handleSnapshotRequest = asyncHandler(async (req: Request, res: Response) => {
  const date = (req.body?.date || req.query?.date) as string | undefined;
  const slot = (req.body?.slot || req.query?.slot) as string | undefined;

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

  // Default: detect and process all due/missing slots idempotently
  const results = await leaderboardService.processDueSnapshots();

  res.status(200).json({
    success: true,
    message: 'Processed due snapshot checkpoints.',
    data: {
      results,
    },
  });
});

/**
 * POST /api/v1/jobs/leaderboard-snapshot
 * GET /api/v1/jobs/leaderboard-snapshot
 * POST /api/v1/jobs/due-snapshots
 * GET /api/v1/jobs/due-snapshots
 *
 * Internal protected endpoints for scheduled snapshot processing.
 * Called by external schedulers (e.g. cron-job.org, Cloudflare Workers, GitHub Actions)
 * when the API server may sleep or restart.
 */
jobsRouter.post('/leaderboard-snapshot', requireCronSecret, handleSnapshotRequest);
jobsRouter.get('/leaderboard-snapshot', requireCronSecret, handleSnapshotRequest);
jobsRouter.post('/due-snapshots', requireCronSecret, handleSnapshotRequest);
jobsRouter.get('/due-snapshots', requireCronSecret, handleSnapshotRequest);

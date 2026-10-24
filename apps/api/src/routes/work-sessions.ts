import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';
import {
  startSessionSchema,
  extendSessionSchema,
  listSessionsQuerySchema,
  type StartSessionInput,
  type ExtendSessionInput,
  type ListSessionsQuery,
} from '../schemas/work-session.js';
import { timerService } from '../services/timer.service.js';
import { asyncHandler, ValidationError } from '../utils/errors.js';

export const workSessionRouter = Router();

// Protect all work-session routes with authentication
workSessionRouter.use(requireAuth);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getValidSessionId(param: string | string[] | undefined): string {
  const id = String(param);
  if (!UUID_REGEX.test(id)) {
    throw new ValidationError('Invalid session ID format. Must be a valid UUID.');
  }
  return id;
}

/**
 * GET /api/v1/work-sessions/current
 * Returns the currently running or awaiting-decision session with server-derived metrics.
 * Automatically reconciles expired countdowns into awaiting_decision.
 * Returns null if no active or awaiting session exists.
 */
workSessionRouter.get(
  '/current',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const session = await timerService.getCurrentSession(userId);

    res.status(200).json({
      success: true,
      data: {
        session,
      },
    });
  })
);

/**
 * GET /api/v1/work-sessions/paused
 * Returns resumable paused sessions for the authenticated user.
 */
workSessionRouter.get(
  '/paused',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessions = await timerService.getPausedSessions(userId);

    res.status(200).json({
      success: true,
      data: {
        sessions,
      },
    });
  })
);

/**
 * GET /api/v1/work-sessions
 * Returns paginated work session history for the authenticated user with optional filters.
 */
workSessionRouter.get(
  '/',
  validateQuery(listSessionsQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const query = ((req as any).validatedQuery || req.query) as ListSessionsQuery;

    const result = await timerService.getSessions(userId, query);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/work-sessions/start
 * Starts a new work session and open segment for a task.
 * Mode is derived from task.plannedDurationSeconds: positive = countdown, null = stopwatch.
 * Rejects with 409 if a timer is already running for the user.
 */
workSessionRouter.post(
  '/start',
  validateBody(startSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { taskId } = req.body as StartSessionInput;

    const session = await timerService.startSession(userId, taskId);

    res.status(201).json({
      success: true,
      data: {
        session,
      },
    });
  })
);

/**
 * POST /api/v1/work-sessions/:id/pause
 * Pauses a running session. Closes the open segment at server time,
 * accumulates segment duration into trackedSeconds, and marks status 'paused'.
 */
workSessionRouter.post(
  '/:id/pause',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = getValidSessionId(req.params.id);

    const session = await timerService.pauseSession(userId, sessionId);

    res.status(200).json({
      success: true,
      data: {
        session,
      },
    });
  })
);

/**
 * POST /api/v1/work-sessions/:id/resume
 * Resumes a paused session. Changes status to 'running' and opens a new segment.
 */
workSessionRouter.post(
  '/:id/resume',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = getValidSessionId(req.params.id);

    const session = await timerService.resumeSession(userId, sessionId);

    res.status(200).json({
      success: true,
      data: {
        session,
      },
    });
  })
);

/**
 * POST /api/v1/work-sessions/:id/expire
 * Explicit expiry transition when frontend countdown reaches zero.
 * Closes segment at exact target boundary and sets status 'awaiting_decision'. Idempotent.
 */
workSessionRouter.post(
  '/:id/expire',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = getValidSessionId(req.params.id);

    const session = await timerService.expireSession(userId, sessionId);

    res.status(200).json({
      success: true,
      data: {
        session,
      },
    });
  })
);

/**
 * POST /api/v1/work-sessions/:id/extend
 * Extends a countdown session from awaiting_decision by 900, 1800, or 3600 seconds.
 * Increases target duration, resumes running, opens a new segment. Decision gap excluded.
 */
workSessionRouter.post(
  '/:id/extend',
  validateBody(extendSessionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = getValidSessionId(req.params.id);
    const { extensionSeconds } = req.body as ExtendSessionInput;

    const session = await timerService.extendSession(userId, sessionId, extensionSeconds);

    res.status(200).json({
      success: true,
      data: {
        session,
      },
    });
  })
);

/**
 * POST /api/v1/work-sessions/:id/complete
 * Marks a session completed, closes any active segment, and creates exactly one
 * task_completions record atomically. Idempotent against double-clicks.
 */
workSessionRouter.post(
  '/:id/complete',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = getValidSessionId(req.params.id);

    const result = await timerService.completeSession(userId, sessionId);

    res.status(200).json({
      success: true,
      data: result,
    });
  })
);

/**
 * POST /api/v1/work-sessions/:id/stop
 * Stops a session, closes any active segment, and sets status 'stopped'.
 * Preserves trackedSeconds and creates NO completion record.
 */
workSessionRouter.post(
  '/:id/stop',
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const sessionId = getValidSessionId(req.params.id);

    const session = await timerService.stopSession(userId, sessionId);

    res.status(200).json({
      success: true,
      data: {
        session,
      },
    });
  })
);

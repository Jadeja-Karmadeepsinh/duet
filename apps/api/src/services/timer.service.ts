import { and, eq, desc, gte, lte, sql, isNull, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  workSessions,
  workSessionSegments,
  taskCompletions,
  tasks,
  type WorkSession,
  type WorkSessionSegment,
  type TaskCompletion,
} from '../db/schema/index.js';
import { AppError, ConflictError, NotFoundError, ValidationError } from '../utils/errors.js';
import type { ListSessionsQuery } from '../schemas/work-session.js';

export const STALE_RUNNING_THRESHOLD_SECONDS = 12 * 3600; // 12 hours (43,200 seconds)

export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export interface CalculatedSessionMetrics {
  elapsedSeconds: number;
  remainingSeconds: number | null;
  isExpired: boolean;
  activeSegmentSeconds: number;
  staleRunningWarning: boolean;
}

export interface EnrichedWorkSession extends WorkSession {
  elapsedSeconds: number;
  remainingSeconds: number | null;
  isExpired: boolean;
  staleRunningWarning: boolean;
  activeSegmentStartedAt?: Date | null;
}

/**
 * Pure function to calculate elapsed time, remaining time, expiry, and stale warning
 * for a work session given its state, optional open segment, and reference time.
 * All calculations use integer seconds.
 */
export function calculateSessionMetrics(
  session: Pick<WorkSession, 'mode' | 'status' | 'targetDurationSeconds' | 'trackedSeconds'>,
  openSegment: Pick<WorkSessionSegment, 'startedAt'> | null | undefined,
  now: Date
): CalculatedSessionMetrics {
  const trackedSeconds = Math.max(0, session.trackedSeconds || 0);

  let activeSegmentSeconds = 0;
  if (session.status === 'running' && openSegment) {
    const elapsedMs = Math.max(0, now.getTime() - openSegment.startedAt.getTime());
    activeSegmentSeconds = Math.floor(elapsedMs / 1000);
  }

  const staleRunningWarning =
    session.status === 'running' && activeSegmentSeconds >= STALE_RUNNING_THRESHOLD_SECONDS;

  if (session.mode === 'stopwatch') {
    const elapsedSeconds = trackedSeconds + activeSegmentSeconds;
    return {
      elapsedSeconds,
      remainingSeconds: null,
      isExpired: false,
      activeSegmentSeconds,
      staleRunningWarning,
    };
  }

  // Countdown mode
  const target = session.targetDurationSeconds ?? 0;

  if (session.status === 'awaiting_decision') {
    return {
      elapsedSeconds: target,
      remainingSeconds: 0,
      isExpired: true,
      activeSegmentSeconds: 0,
      staleRunningWarning: false,
    };
  }

  if (session.status === 'running') {
    const totalElapsed = trackedSeconds + activeSegmentSeconds;
    if (target > 0 && totalElapsed >= target) {
      return {
        elapsedSeconds: target,
        remainingSeconds: 0,
        isExpired: true,
        activeSegmentSeconds,
        staleRunningWarning,
      };
    }

    return {
      elapsedSeconds: totalElapsed,
      remainingSeconds: Math.max(0, target - totalElapsed),
      isExpired: false,
      activeSegmentSeconds,
      staleRunningWarning,
    };
  }

  // Paused, completed, or stopped
  const remainingSeconds = target > 0 ? Math.max(0, target - trackedSeconds) : 0;
  return {
    elapsedSeconds: trackedSeconds,
    remainingSeconds,
    isExpired: remainingSeconds === 0 && target > 0,
    activeSegmentSeconds: 0,
    staleRunningWarning: false,
  };
}

/**
 * Formats a raw WorkSession and its open segment with server-derived metrics.
 */
export function enrichSession(
  session: WorkSession,
  openSegment: WorkSessionSegment | null | undefined,
  now: Date
): EnrichedWorkSession {
  const metrics = calculateSessionMetrics(session, openSegment, now);
  return {
    ...session,
    elapsedSeconds: metrics.elapsedSeconds,
    remainingSeconds: metrics.remainingSeconds,
    isExpired: metrics.isExpired,
    staleRunningWarning: metrics.staleRunningWarning,
    activeSegmentStartedAt: openSegment?.startedAt ?? null,
  };
}

export class TimerService {
  constructor(private clock: Clock = systemClock) {}

  /**
   * Internal helper: Reconciles an expired running countdown into awaiting_decision
   * at the exact target boundary if it has reached or passed zero.
   * Runs inside an active transaction.
   */
  private async reconcileExpiredCountdownInTx(
    tx: any,
    session: WorkSession,
    openSegment: WorkSessionSegment,
    now: Date
  ): Promise<{ session: WorkSession; reconciled: boolean }> {
    if (session.mode !== 'countdown' || session.status !== 'running') {
      return { session, reconciled: false };
    }

    const target = session.targetDurationSeconds ?? 0;
    const tracked = session.trackedSeconds ?? 0;
    const remainingNeeded = target - tracked;

    const segmentDuration = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));

    if (segmentDuration >= remainingNeeded) {
      // Reached or crossed zero! Close exactly at the target boundary.
      const exactEndedAt = new Date(openSegment.startedAt.getTime() + Math.max(0, remainingNeeded) * 1000);

      await tx
        .update(workSessionSegments)
        .set({ endedAt: exactEndedAt })
        .where(eq(workSessionSegments.id, openSegment.id));

      const [updatedSession] = await tx
        .update(workSessions)
        .set({
          status: 'awaiting_decision',
          trackedSeconds: target,
          updatedAt: exactEndedAt,
        })
        .where(eq(workSessions.id, session.id))
        .returning();

      return { session: updatedSession, reconciled: true };
    }

    return { session, reconciled: false };
  }

  /**
   * Retrieves the current active or awaiting-decision session for a user.
   * If a running countdown has expired, reconciles it into awaiting_decision.
   */
  async getCurrentSession(userId: string): Promise<EnrichedWorkSession | null> {
    const now = this.clock.now();

    // Look for a session in 'running' or 'awaiting_decision'
    const candidateSessions = await db
      .select()
      .from(workSessions)
      .where(
        and(
          eq(workSessions.userId, userId),
          inArray(workSessions.status, ['running', 'awaiting_decision'])
        )
      )
      .orderBy(desc(workSessions.createdAt))
      .limit(1);

    if (candidateSessions.length === 0) {
      return null;
    }

    let session = candidateSessions[0];

    // Find if there is an open segment
    const [openSegment] = await db
      .select()
      .from(workSessionSegments)
      .where(
        and(
          eq(workSessionSegments.workSessionId, session.id),
          isNull(workSessionSegments.endedAt)
        )
      )
      .limit(1);

    // If running countdown, check if reconciliation is required
    if (session.status === 'running' && session.mode === 'countdown' && openSegment) {
      const target = session.targetDurationSeconds ?? 0;
      const tracked = session.trackedSeconds ?? 0;
      const remainingNeeded = target - tracked;
      const segmentDuration = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));

      if (segmentDuration >= remainingNeeded) {
        // Reconcile within transaction
        const result = await db.transaction(async (tx) => {
          return this.reconcileExpiredCountdownInTx(tx, session, openSegment, now);
        });
        session = result.session;
        return enrichSession(session, null, now);
      }
    }

    return enrichSession(session, openSegment, now);
  }

  /**
   * Lists paused sessions for the user (resumable).
   */
  async getPausedSessions(userId: string): Promise<EnrichedWorkSession[]> {
    const now = this.clock.now();
    const pausedList = await db
      .select()
      .from(workSessions)
      .where(and(eq(workSessions.userId, userId), eq(workSessions.status, 'paused')))
      .orderBy(desc(workSessions.updatedAt));

    return pausedList.map((s) => enrichSession(s, null, now));
  }

  /**
   * Lists paginated history of sessions for the authenticated user with optional filters.
   */
  async getSessions(
    userId: string,
    query: ListSessionsQuery
  ): Promise<{
    sessions: EnrichedWorkSession[];
    pagination: { page: number; limit: number; totalCount: number; totalPages: number };
  }> {
    const now = this.clock.now();
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.max(1, Math.min(100, Number(query.limit) || 20));
    const { taskId, status, from, to } = query;
    const offset = (page - 1) * limit;

    const conditions = [eq(workSessions.userId, userId)];

    if (taskId) {
      conditions.push(eq(workSessions.taskId, taskId));
    }
    if (status) {
      conditions.push(eq(workSessions.status, status));
    }
    if (from) {
      conditions.push(gte(workSessions.startedAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(workSessions.startedAt, new Date(to)));
    }

    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(workSessions)
      .where(whereClause);

    const totalCount = countResult?.count ?? 0;
    const totalPages = Math.ceil(totalCount / limit) || 1;

    const rawSessions = await db
      .select()
      .from(workSessions)
      .where(whereClause)
      .orderBy(desc(workSessions.startedAt))
      .limit(limit)
      .offset(offset);

    // Get open segments for any running sessions in this page
    const runningIds = rawSessions.filter((s) => s.status === 'running').map((s) => s.id);
    const openSegmentsMap = new Map<string, WorkSessionSegment>();

    if (runningIds.length > 0) {
      const segments = await db
        .select()
        .from(workSessionSegments)
        .where(
          and(
            inArray(workSessionSegments.workSessionId, runningIds),
            isNull(workSessionSegments.endedAt)
          )
        );
      for (const seg of segments) {
        openSegmentsMap.set(seg.workSessionId, seg);
      }
    }

    const sessions = rawSessions.map((s) => enrichSession(s, openSegmentsMap.get(s.id), now));

    return {
      sessions,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
      },
    };
  }

  /**
   * Starts a new work session from a task.
   * Mode derived from task's plannedDurationSeconds: >0 = countdown, null = stopwatch.
   * Atomic transaction enforces single running session per user.
   */
  async startSession(userId: string, taskId: string): Promise<EnrichedWorkSession> {
    const now = this.clock.now();

    // Verify task exists and is owned by user
    const [task] = await db
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, taskId), eq(tasks.ownerUserId, userId)))
      .limit(1);

    if (!task) {
      throw new NotFoundError('Task not found or access denied');
    }

    if (task.status === 'archived') {
      throw new ValidationError('Cannot start a timer for an archived task. Please unarchive it first.');
    }

    // Check for existing running session and reconcile if expired countdown
    const [existingRunning] = await db
      .select()
      .from(workSessions)
      .where(and(eq(workSessions.userId, userId), eq(workSessions.status, 'running')))
      .limit(1);

    if (existingRunning) {
      if (existingRunning.mode === 'countdown') {
        const [openSegment] = await db
          .select()
          .from(workSessionSegments)
          .where(
            and(
              eq(workSessionSegments.workSessionId, existingRunning.id),
              isNull(workSessionSegments.endedAt)
            )
          )
          .limit(1);

        if (openSegment) {
          const target = existingRunning.targetDurationSeconds ?? 0;
          const tracked = existingRunning.trackedSeconds ?? 0;
          const remainingNeeded = target - tracked;
          const segmentDuration = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));

          if (segmentDuration >= remainingNeeded) {
            // Reconcile the expired session to awaiting_decision
            await db.transaction(async (tx) => {
              await this.reconcileExpiredCountdownInTx(tx, existingRunning, openSegment, now);
            });
            // Old session is now awaiting_decision! Proceed to start new session.
          } else {
            throw new ConflictError('A work session is already running for this user. Please pause, stop, or complete it before starting a new one.');
          }
        } else {
          throw new ConflictError('A work session is already running for this user.');
        }
      } else {
        throw new ConflictError('A work session is already running for this user. Please pause, stop, or complete it before starting a new one.');
      }
    }

    // Determine mode and target
    const isCountdown = typeof task.plannedDurationSeconds === 'number' && task.plannedDurationSeconds > 0;
    const mode = isCountdown ? 'countdown' : 'stopwatch';
    const targetDurationSeconds = isCountdown ? task.plannedDurationSeconds : null;

    try {
      const result = await db.transaction(async (tx) => {
        const [newSession] = await tx
          .insert(workSessions)
          .values({
            userId,
            taskId: task.id,
            mode,
            status: 'running',
            targetDurationSeconds,
            trackedSeconds: 0,
            taskTitleSnapshot: task.title,
            categorySnapshot: task.category,
            startedAt: now,
            updatedAt: now,
          })
          .returning();

        const [openSegment] = await tx
          .insert(workSessionSegments)
          .values({
            workSessionId: newSession.id,
            startedAt: now,
            endedAt: null,
          })
          .returning();

        return { session: newSession, openSegment };
      });

      return enrichSession(result.session, result.openSegment, now);
    } catch (err: any) {
      const code = err.code || err.cause?.code;
      const message = `${err.message || ''} ${err.cause?.message || ''}`.toLowerCase();
      if (
        code === '23505' ||
        message.includes('idx_work_sessions_single_running') ||
        message.includes('unique constraint') ||
        message.includes('duplicate key')
      ) {
        throw new ConflictError('A work session is already running for this user.');
      }
      throw err;
    }
  }

  /**
   * Pauses an active session:
   * Closes open segment at server time, adds segment duration to trackedSeconds,
   * sets status 'paused'.
   */
  async pauseSession(userId: string, sessionId: string): Promise<EnrichedWorkSession> {
    const now = this.clock.now();

    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.userId, userId)))
        .limit(1);

      if (!session) {
        throw new NotFoundError('Work session not found');
      }

      if (session.status === 'paused') {
        throw new ConflictError('Session is already paused');
      }

      if (session.status !== 'running') {
        throw new ConflictError(`Cannot pause session with status '${session.status}'`);
      }

      const [openSegment] = await tx
        .select()
        .from(workSessionSegments)
        .where(
          and(
            eq(workSessionSegments.workSessionId, session.id),
            isNull(workSessionSegments.endedAt)
          )
        )
        .limit(1);

      if (!openSegment) {
        throw new ConflictError('No open segment found to pause');
      }

      // Check if countdown expired before pause click
      if (session.mode === 'countdown') {
        const target = session.targetDurationSeconds ?? 0;
        const tracked = session.trackedSeconds ?? 0;
        const remainingNeeded = target - tracked;
        const elapsedInSegment = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));

        if (elapsedInSegment >= remainingNeeded) {
          // Reconcile and inform client it expired
          await this.reconcileExpiredCountdownInTx(tx, session, openSegment, now);
          throw new ConflictError('Countdown target reached. Session is now awaiting your decision.');
        }
      }

      // Close open segment at server time
      const segmentDuration = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));

      await tx
        .update(workSessionSegments)
        .set({ endedAt: now })
        .where(eq(workSessionSegments.id, openSegment.id));

      const [updatedSession] = await tx
        .update(workSessions)
        .set({
          status: 'paused',
          trackedSeconds: session.trackedSeconds + segmentDuration,
          updatedAt: now,
        })
        .where(eq(workSessions.id, session.id))
        .returning();

      return enrichSession(updatedSession, null, now);
    });
  }

  /**
   * Resumes a paused session:
   * Validates user has no other running session, sets status 'running',
   * and opens a new segment with startedAt = now.
   */
  async resumeSession(userId: string, sessionId: string): Promise<EnrichedWorkSession> {
    const now = this.clock.now();

    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.userId, userId)))
        .limit(1);

      if (!session) {
        throw new NotFoundError('Work session not found');
      }

      if (session.status === 'running') {
        throw new ConflictError('Session is already running');
      }

      if (session.status !== 'paused') {
        throw new ConflictError(`Cannot resume session with status '${session.status}'`);
      }

      // Enforce single running session check
      const [runningSession] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.userId, userId), eq(workSessions.status, 'running')))
        .limit(1);

      if (runningSession) {
        throw new ConflictError('Cannot resume session because another session is currently running.');
      }

      const [updatedSession] = await tx
        .update(workSessions)
        .set({
          status: 'running',
          updatedAt: now,
        })
        .where(eq(workSessions.id, session.id))
        .returning();

      const [newSegment] = await tx
        .insert(workSessionSegments)
        .values({
          workSessionId: session.id,
          startedAt: now,
          endedAt: null,
        })
        .returning();

      return enrichSession(updatedSession, newSegment, now);
    });
  }

  /**
   * Explicit expiry endpoint when frontend reaches 0 while browser is open.
   * Closes open segment at exact target boundary, sets status 'awaiting_decision',
   * and sets trackedSeconds = targetDurationSeconds. Idempotent.
   */
  async expireSession(userId: string, sessionId: string): Promise<EnrichedWorkSession> {
    const now = this.clock.now();

    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.userId, userId)))
        .limit(1);

      if (!session) {
        throw new NotFoundError('Work session not found');
      }

      if (session.status === 'awaiting_decision') {
        // Idempotent
        return enrichSession(session, null, now);
      }

      if (session.mode !== 'countdown') {
        throw new ConflictError('Stopwatch sessions cannot expire');
      }

      if (session.status !== 'running') {
        throw new ConflictError(`Cannot expire session with status '${session.status}'`);
      }

      const [openSegment] = await tx
        .select()
        .from(workSessionSegments)
        .where(
          and(
            eq(workSessionSegments.workSessionId, session.id),
            isNull(workSessionSegments.endedAt)
          )
        )
        .limit(1);

      if (!openSegment) {
        throw new ConflictError('No open segment found to expire');
      }

      const target = session.targetDurationSeconds ?? session.trackedSeconds;
      const remainingNeeded = Math.max(0, target - (session.trackedSeconds ?? 0));
      const exactEndedAt = new Date(openSegment.startedAt.getTime() + remainingNeeded * 1000);

      await tx
        .update(workSessionSegments)
        .set({ endedAt: exactEndedAt })
        .where(eq(workSessionSegments.id, openSegment.id));

      const [updatedSession] = await tx
        .update(workSessions)
        .set({
          status: 'awaiting_decision',
          trackedSeconds: target,
          updatedAt: exactEndedAt,
        })
        .where(eq(workSessions.id, session.id))
        .returning();

      return enrichSession(updatedSession, null, now);
    });
  }

  /**
   * Extends a countdown session:
   * Only allowed from 'awaiting_decision'.
   * Increases targetDurationSeconds by extensionSeconds (900, 1800, 3600),
   * sets status 'running', opens new segment at action time.
   * The decision gap is excluded.
   */
  async extendSession(
    userId: string,
    sessionId: string,
    extensionSeconds: number
  ): Promise<EnrichedWorkSession> {
    if (![900, 1800, 3600].includes(extensionSeconds)) {
      throw new ValidationError('extensionSeconds must be 900 (15m), 1800 (30m), or 3600 (60m)');
    }

    const now = this.clock.now();

    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.userId, userId)))
        .limit(1);

      if (!session) {
        throw new NotFoundError('Work session not found');
      }

      if (session.mode !== 'countdown') {
        throw new ConflictError('Stopwatch sessions cannot be extended');
      }

      if (session.status !== 'awaiting_decision') {
        throw new ConflictError(`Sessions can only be extended from 'awaiting_decision' status. Current status: '${session.status}'`);
      }

      // Enforce single running session constraint
      const [existingRunning] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.userId, userId), eq(workSessions.status, 'running')))
        .limit(1);

      if (existingRunning) {
        throw new ConflictError('Another session is already running. Please pause or stop it before extending this one.');
      }

      const newTarget = (session.targetDurationSeconds ?? session.trackedSeconds) + extensionSeconds;

      const [updatedSession] = await tx
        .update(workSessions)
        .set({
          targetDurationSeconds: newTarget,
          status: 'running',
          updatedAt: now,
        })
        .where(eq(workSessions.id, session.id))
        .returning();

      const [newSegment] = await tx
        .insert(workSessionSegments)
        .values({
          workSessionId: session.id,
          startedAt: now,
          endedAt: null,
        })
        .returning();

      return enrichSession(updatedSession, newSegment, now);
    });
  }

  /**
   * Completes a work session:
   * Closes any active segment, marks session 'completed',
   * and inserts exactly one task_completions row in the same transaction.
   * Fully idempotent against retries and double-clicks.
   */
  async completeSession(
    userId: string,
    sessionId: string
  ): Promise<{ session: EnrichedWorkSession; completion: TaskCompletion }> {
    const now = this.clock.now();

    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.userId, userId)))
        .limit(1);

      if (!session) {
        throw new NotFoundError('Work session not found');
      }

      // Idempotency check: if already completed, return existing session and completion
      if (session.status === 'completed') {
        const [existingCompletion] = await tx
          .select()
          .from(taskCompletions)
          .where(eq(taskCompletions.workSessionId, session.id))
          .limit(1);

        if (existingCompletion) {
          return {
            session: enrichSession(session, null, now),
            completion: existingCompletion,
          };
        }
      }

      if (session.status === 'stopped') {
        throw new ConflictError('Stopped sessions cannot be completed');
      }

      let finalTrackedSeconds = session.trackedSeconds;

      // Close open segment if running
      if (session.status === 'running') {
        const [openSegment] = await tx
          .select()
          .from(workSessionSegments)
          .where(
            and(
              eq(workSessionSegments.workSessionId, session.id),
              isNull(workSessionSegments.endedAt)
            )
          )
          .limit(1);

        if (openSegment) {
          if (session.mode === 'countdown' && session.targetDurationSeconds) {
            const remainingNeeded = session.targetDurationSeconds - session.trackedSeconds;
            const elapsed = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));
            if (elapsed >= remainingNeeded) {
              const exactEndedAt = new Date(openSegment.startedAt.getTime() + Math.max(0, remainingNeeded) * 1000);
              await tx
                .update(workSessionSegments)
                .set({ endedAt: exactEndedAt })
                .where(eq(workSessionSegments.id, openSegment.id));
              finalTrackedSeconds = session.targetDurationSeconds;
            } else {
              await tx
                .update(workSessionSegments)
                .set({ endedAt: now })
                .where(eq(workSessionSegments.id, openSegment.id));
              finalTrackedSeconds += elapsed;
            }
          } else {
            const elapsed = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));
            await tx
              .update(workSessionSegments)
              .set({ endedAt: now })
              .where(eq(workSessionSegments.id, openSegment.id));
            finalTrackedSeconds += elapsed;
          }
        }
      }

      const [updatedSession] = await tx
        .update(workSessions)
        .set({
          status: 'completed',
          trackedSeconds: finalTrackedSeconds,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(workSessions.id, session.id))
        .returning();

      // Insert exactly one task completion row (safe against unique constraint violation)
      let completion: TaskCompletion;
      const [insertedCompletion] = await tx
        .insert(taskCompletions)
        .values({
          userId,
          taskId: session.taskId,
          workSessionId: session.id,
          taskTitleSnapshot: session.taskTitleSnapshot,
          categorySnapshot: session.categorySnapshot,
          completedAt: now,
        })
        .onConflictDoNothing({ target: taskCompletions.workSessionId })
        .returning();

      if (insertedCompletion) {
        completion = insertedCompletion;
      } else {
        const [existing] = await tx
          .select()
          .from(taskCompletions)
          .where(eq(taskCompletions.workSessionId, session.id))
          .limit(1);
        completion = existing!;
      }

      return {
        session: enrichSession(updatedSession, null, now),
        completion,
      };
    });
  }

  /**
   * Stops an active session:
   * Closes open segment, sets status 'stopped', preserves tracked seconds,
   * creates NO task completion row.
   */
  async stopSession(userId: string, sessionId: string): Promise<EnrichedWorkSession> {
    const now = this.clock.now();

    return await db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(workSessions)
        .where(and(eq(workSessions.id, sessionId), eq(workSessions.userId, userId)))
        .limit(1);

      if (!session) {
        throw new NotFoundError('Work session not found');
      }

      // Idempotency: if already stopped, return current
      if (session.status === 'stopped') {
        return enrichSession(session, null, now);
      }

      if (session.status === 'completed') {
        throw new ConflictError('Completed sessions cannot be stopped');
      }

      let finalTrackedSeconds = session.trackedSeconds;

      if (session.status === 'running') {
        const [openSegment] = await tx
          .select()
          .from(workSessionSegments)
          .where(
            and(
              eq(workSessionSegments.workSessionId, session.id),
              isNull(workSessionSegments.endedAt)
            )
          )
          .limit(1);

        if (openSegment) {
          if (session.mode === 'countdown' && session.targetDurationSeconds) {
            const remainingNeeded = session.targetDurationSeconds - session.trackedSeconds;
            const elapsed = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));
            if (elapsed >= remainingNeeded) {
              const exactEndedAt = new Date(openSegment.startedAt.getTime() + Math.max(0, remainingNeeded) * 1000);
              await tx
                .update(workSessionSegments)
                .set({ endedAt: exactEndedAt })
                .where(eq(workSessionSegments.id, openSegment.id));
              finalTrackedSeconds = session.targetDurationSeconds;
            } else {
              await tx
                .update(workSessionSegments)
                .set({ endedAt: now })
                .where(eq(workSessionSegments.id, openSegment.id));
              finalTrackedSeconds += elapsed;
            }
          } else {
            const elapsed = Math.max(0, Math.floor((now.getTime() - openSegment.startedAt.getTime()) / 1000));
            await tx
              .update(workSessionSegments)
              .set({ endedAt: now })
              .where(eq(workSessionSegments.id, openSegment.id));
            finalTrackedSeconds += elapsed;
          }
        }
      }

      const [updatedSession] = await tx
        .update(workSessions)
        .set({
          status: 'stopped',
          trackedSeconds: finalTrackedSeconds,
          finishedAt: now,
          updatedAt: now,
        })
        .where(eq(workSessions.id, session.id))
        .returning();

      return enrichSession(updatedSession, null, now);
    });
  }
}

export const timerService = new TimerService();

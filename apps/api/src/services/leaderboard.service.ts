import { eq, and, lte, gte, desc, asc, or, isNull, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  workSessions,
  workSessionSegments,
  taskCompletions,
  leaderboardSnapshotRuns,
  leaderboardSnapshotEntries,
  type LeaderboardSnapshotRun,
} from '../db/schema/index.js';
import {
  getAsiaKolkataDateString,
  getAsiaKolkataDayBounds,
  splitSegmentByAsiaKolkataDays,
  getDateDaysAgo,
  getSlotScheduledUtc,
  isSlotDelayed,
  LEADERBOARD_SLOTS,
  type LeaderboardSlot,
} from '../utils/timezone.js';

export interface LeaderboardEntryView {
  rank: number;
  userId: string;
  displayName: string;
  focusSeconds: number;
  completedTasks: number;
  isCurrentUser: boolean;
}

export interface LeaderboardResponse {
  period: 'today' | '7d';
  date: string;
  currentSlot: LeaderboardSlot | 'provisional';
  availableSlots: LeaderboardSlot[];
  isProvisional: boolean;
  scheduledFor: string | null;
  capturedAt: string | null;
  isDelayed: boolean;
  nextScheduledSlot: LeaderboardSlot | null;
  activeProfileCount: number;
  entries: LeaderboardEntryView[];
  timezone: string;
}

export interface ProcessedSlotResult {
  date: string;
  slot: LeaderboardSlot;
  status: 'created' | 'already_exists' | 'failed';
  runId?: string;
  error?: string;
}

export class LeaderboardService {
  /**
   * Calculates metrics for all active profiles at a given reference timestamp.
   * Computes both today's metrics and rolling 7-day metrics in Asia/Kolkata.
   */
  async calculateMetricsForAllUsers(localDate: string, captureTime: Date) {
    // 1. Fetch all active users (up to 4 profiles)
    const activeUsers = await db
      .select({
        id: users.id,
        displayName: users.displayName,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.createdAt));

    if (activeUsers.length === 0) {
      return [];
    }

    const userIds = activeUsers.map((u) => u.id);

    // 2. Determine date bounds
    const todayBounds = getAsiaKolkataDayBounds(localDate);
    const rolling7DaysStartDate = getDateDaysAgo(localDate, 6);
    const rolling7DaysBounds = getAsiaKolkataDayBounds(rolling7DaysStartDate);

    // End bound for both today and 7d is capped at captureTime
    const effectiveEndUtc = captureTime < todayBounds.endUtc ? captureTime : todayBounds.endUtc;

    // 3. Fetch completions for all active users in the 7-day window
    const completions = await db
      .select({
        id: taskCompletions.id,
        userId: taskCompletions.userId,
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .where(
        and(
          inArray(taskCompletions.userId, userIds),
          gte(taskCompletions.completedAt, rolling7DaysBounds.startUtc),
          lte(taskCompletions.completedAt, effectiveEndUtc)
        )
      );

    // Map completions by user
    const todayCompletionsByUser = new Map<string, number>();
    const last7dCompletionsByUser = new Map<string, number>();

    for (const c of completions) {
      const compDate = new Date(c.completedAt);
      // All items in query are within the 7-day window
      last7dCompletionsByUser.set(c.userId, (last7dCompletionsByUser.get(c.userId) || 0) + 1);

      // Check if within today's bounds
      if (compDate >= todayBounds.startUtc && compDate <= effectiveEndUtc) {
        todayCompletionsByUser.set(c.userId, (todayCompletionsByUser.get(c.userId) || 0) + 1);
      }
    }

    // 4. Fetch work session segments overlapping the 7-day window
    const segments = await db
      .select({
        userId: workSessions.userId,
        startedAt: workSessionSegments.startedAt,
        endedAt: workSessionSegments.endedAt,
      })
      .from(workSessionSegments)
      .innerJoin(workSessions, eq(workSessionSegments.workSessionId, workSessions.id))
      .where(
        and(
          inArray(workSessions.userId, userIds),
          lte(workSessionSegments.startedAt, effectiveEndUtc),
          or(
            gte(workSessionSegments.endedAt, rolling7DaysBounds.startUtc),
            isNull(workSessionSegments.endedAt)
          )
        )
      );

    // Split segments and aggregate by user
    const todayFocusByUser = new Map<string, number>();
    const last7dFocusByUser = new Map<string, number>();

    for (const seg of segments) {
      const segStart = new Date(seg.startedAt);
      const segEnd = seg.endedAt ? new Date(seg.endedAt) : captureTime;
      const effectiveSegEnd = segEnd > captureTime ? captureTime : segEnd;

      if (segStart < effectiveSegEnd) {
        const splits = splitSegmentByAsiaKolkataDays(segStart, effectiveSegEnd);
        for (const split of splits) {
          // If within the 7-day calendar window
          if (split.date >= rolling7DaysStartDate && split.date <= localDate) {
            last7dFocusByUser.set(
              seg.userId,
              (last7dFocusByUser.get(seg.userId) || 0) + split.seconds
            );
          }
          // If today
          if (split.date === localDate) {
            todayFocusByUser.set(
              seg.userId,
              (todayFocusByUser.get(seg.userId) || 0) + split.seconds
            );
          }
        }
      }
    }

    // 5. Combine into user metrics list
    return activeUsers.map((user) => ({
      userId: user.id,
      displayName: user.displayName,
      focusSecondsToday: todayFocusByUser.get(user.id) || 0,
      completedTasksToday: todayCompletionsByUser.get(user.id) || 0,
      focusSecondsLast7Days: last7dFocusByUser.get(user.id) || 0,
      completedTasksLast7Days: last7dCompletionsByUser.get(user.id) || 0,
    }));
  }

  /**
   * Idempotently captures a snapshot for a given date and slot.
   * If the snapshot already exists, returns the existing run.
   * Uses a database transaction and handles unique constraint collisions.
   */
  async captureSnapshot(
    localDate: string,
    slot: LeaderboardSlot,
    scheduledFor: Date,
    options?: { captureTime?: Date }
  ): Promise<LeaderboardSnapshotRun> {
    // Check if snapshot already exists
    const [existing] = await db
      .select()
      .from(leaderboardSnapshotRuns)
      .where(
        and(
          eq(leaderboardSnapshotRuns.localDate, localDate),
          eq(leaderboardSnapshotRuns.slot, slot)
        )
      )
      .limit(1);

    if (existing) {
      return existing;
    }

    const captureTime = options?.captureTime ?? new Date();
    const isDelayed = isSlotDelayed(scheduledFor, captureTime);

    // Calculate metrics at consistent capture time
    const userMetrics = await this.calculateMetricsForAllUsers(localDate, captureTime);

    // Execute in a transaction
    try {
      return await db.transaction(async (tx) => {
        const [run] = await tx
          .insert(leaderboardSnapshotRuns)
          .values({
            localDate,
            slot,
            scheduledFor,
            capturedAt: captureTime,
            isDelayed,
          })
          .onConflictDoNothing()
          .returning();

        if (!run) {
          const [existingRun] = await tx
            .select()
            .from(leaderboardSnapshotRuns)
            .where(
              and(
                eq(leaderboardSnapshotRuns.localDate, localDate),
                eq(leaderboardSnapshotRuns.slot, slot)
              )
            )
            .limit(1);
          return existingRun;
        }

        if (userMetrics.length > 0) {
          await tx
            .insert(leaderboardSnapshotEntries)
            .values(
              userMetrics.map((m) => ({
                snapshotRunId: run.id,
                userId: m.userId,
                displayNameSnapshot: m.displayName,
                focusSecondsToday: m.focusSecondsToday,
                completedTasksToday: m.completedTasksToday,
                focusSecondsLast7Days: m.focusSecondsLast7Days,
                completedTasksLast7Days: m.completedTasksLast7Days,
                capturedAt: captureTime,
              }))
            )
            .onConflictDoNothing();
        }

        return run;
      });
    } catch (err: any) {
      // In case of unique constraint race condition, fetch and return the winning run
      if (
        err?.code === '23505' ||
        err?.cause?.code === '23505' ||
        err?.message?.includes('duplicate key') ||
        err?.cause?.message?.includes('duplicate key')
      ) {
        const [winningRun] = await db
          .select()
          .from(leaderboardSnapshotRuns)
          .where(
            and(
              eq(leaderboardSnapshotRuns.localDate, localDate),
              eq(leaderboardSnapshotRuns.slot, slot)
            )
          )
          .limit(1);
        if (winningRun) return winningRun;
      }
      throw err;
    }
  }

  /**
   * Detects due snapshot slots that are missing and captures them idempotently.
   * Checks today's slots up to the current time, plus yesterday's slots if missing.
   */
  async processDueSnapshots(referenceTime: Date = new Date()): Promise<ProcessedSlotResult[]> {
    const todayStr = getAsiaKolkataDateString(referenceTime);
    const yesterdayStr = getDateDaysAgo(todayStr, 1);

    const candidates: Array<{ date: string; slot: LeaderboardSlot; scheduledFor: Date }> = [];

    // Check yesterday's slots (all 3 slots must have run)
    for (const slot of LEADERBOARD_SLOTS) {
      const scheduledUtc = getSlotScheduledUtc(yesterdayStr, slot);
      candidates.push({ date: yesterdayStr, slot, scheduledFor: scheduledUtc });
    }

    // Check today's slots that have passed their scheduled time
    for (const slot of LEADERBOARD_SLOTS) {
      const scheduledUtc = getSlotScheduledUtc(todayStr, slot);
      if (referenceTime >= scheduledUtc) {
        candidates.push({ date: todayStr, slot, scheduledFor: scheduledUtc });
      }
    }

    const results: ProcessedSlotResult[] = [];

    for (const candidate of candidates) {
      try {
        // Check if already captured
        const [existing] = await db
          .select({ id: leaderboardSnapshotRuns.id })
          .from(leaderboardSnapshotRuns)
          .where(
            and(
              eq(leaderboardSnapshotRuns.localDate, candidate.date),
              eq(leaderboardSnapshotRuns.slot, candidate.slot)
            )
          )
          .limit(1);

        if (existing) {
          results.push({
            date: candidate.date,
            slot: candidate.slot,
            status: 'already_exists',
            runId: existing.id,
          });
        } else {
          const run = await this.captureSnapshot(
            candidate.date,
            candidate.slot,
            candidate.scheduledFor,
            { captureTime: referenceTime }
          );
          results.push({
            date: candidate.date,
            slot: candidate.slot,
            status: 'created',
            runId: run.id,
          });
        }
      } catch (err: any) {
        results.push({
          date: candidate.date,
          slot: candidate.slot,
          status: 'failed',
          error: err?.message || 'Unknown snapshot error',
        });
      }
    }

    return results;
  }

  /**
   * Retrieves the leaderboard view for the requested period ('today' | '7d') and optional slot.
   * If no snapshots exist for today, returns a provisional live board.
   */
  async getLeaderboard(
    period: 'today' | '7d',
    currentUserId?: string,
    requestedSlot?: LeaderboardSlot
  ): Promise<LeaderboardResponse> {
    const now = new Date();
    const todayDate = getAsiaKolkataDateString(now);

    // Fetch all snapshots for today
    const todayRuns = await db
      .select()
      .from(leaderboardSnapshotRuns)
      .where(eq(leaderboardSnapshotRuns.localDate, todayDate))
      .orderBy(asc(leaderboardSnapshotRuns.scheduledFor));

    const availableSlots = todayRuns.map((r) => r.slot as LeaderboardSlot);

    // Determine next upcoming slot today
    let nextScheduledSlot: LeaderboardSlot | null = null;
    for (const s of LEADERBOARD_SLOTS) {
      const sched = getSlotScheduledUtc(todayDate, s);
      if (now < sched) {
        nextScheduledSlot = s;
        break;
      }
    }

    // Count active profiles
    const activeProfiles = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.isActive, true));
    const activeProfileCount = activeProfiles.length;

    // Case 1: Official Snapshots exist for today
    if (todayRuns.length > 0) {
      // Pick the selected run or default to latest
      let selectedRun: LeaderboardSnapshotRun;
      if (requestedSlot) {
        const matched = todayRuns.find((r) => r.slot === requestedSlot);
        selectedRun = matched || todayRuns[todayRuns.length - 1];
      } else {
        selectedRun = todayRuns[todayRuns.length - 1];
      }

      // Fetch entries for the selected run
      const entries = await db
        .select()
        .from(leaderboardSnapshotEntries)
        .where(eq(leaderboardSnapshotEntries.snapshotRunId, selectedRun.id));

      // Rank entries according to the period:
      // focus seconds descending -> completions descending -> displayName ascending
      const sorted = [...entries].sort((a, b) => {
        const focusA =
          period === 'today' ? a.focusSecondsToday : a.focusSecondsLast7Days;
        const focusB =
          period === 'today' ? b.focusSecondsToday : b.focusSecondsLast7Days;
        if (focusB !== focusA) return focusB - focusA;

        const tasksA =
          period === 'today' ? a.completedTasksToday : a.completedTasksLast7Days;
        const tasksB =
          period === 'today' ? b.completedTasksToday : b.completedTasksLast7Days;
        if (tasksB !== tasksA) return tasksB - tasksA;

        return a.displayNameSnapshot.localeCompare(b.displayNameSnapshot);
      });

      const rankedEntries: LeaderboardEntryView[] = sorted.slice(0, 4).map((entry, idx) => ({
        rank: idx + 1,
        userId: entry.userId,
        displayName: entry.displayNameSnapshot,
        focusSeconds:
          period === 'today' ? entry.focusSecondsToday : entry.focusSecondsLast7Days,
        completedTasks:
          period === 'today' ? entry.completedTasksToday : entry.completedTasksLast7Days,
        isCurrentUser: currentUserId ? entry.userId === currentUserId : false,
      }));

      return {
        period,
        date: selectedRun.localDate,
        currentSlot: selectedRun.slot as LeaderboardSlot,
        availableSlots,
        isProvisional: false,
        scheduledFor: selectedRun.scheduledFor.toISOString(),
        capturedAt: selectedRun.capturedAt.toISOString(),
        isDelayed: selectedRun.isDelayed,
        nextScheduledSlot,
        activeProfileCount,
        entries: rankedEntries,
        timezone: 'Asia/Kolkata (IST)',
      };
    }

    // Case 2: No snapshots exist yet today (Provisional Live Board)
    const liveMetrics = await this.calculateMetricsForAllUsers(todayDate, now);

    const sortedLive = [...liveMetrics].sort((a, b) => {
      const focusA =
        period === 'today' ? a.focusSecondsToday : a.focusSecondsLast7Days;
      const focusB =
        period === 'today' ? b.focusSecondsToday : b.focusSecondsLast7Days;
      if (focusB !== focusA) return focusB - focusA;

      const tasksA =
        period === 'today' ? a.completedTasksToday : a.completedTasksLast7Days;
      const tasksB =
        period === 'today' ? b.completedTasksToday : b.completedTasksLast7Days;
      if (tasksB !== tasksA) return tasksB - tasksA;

      return a.displayName.localeCompare(b.displayName);
    });

    const rankedLiveEntries: LeaderboardEntryView[] = sortedLive.slice(0, 4).map((entry, idx) => ({
      rank: idx + 1,
      userId: entry.userId,
      displayName: entry.displayName,
      focusSeconds:
        period === 'today' ? entry.focusSecondsToday : entry.focusSecondsLast7Days,
      completedTasks:
        period === 'today' ? entry.completedTasksToday : entry.completedTasksLast7Days,
      isCurrentUser: currentUserId ? entry.userId === currentUserId : false,
    }));

    return {
      period,
      date: todayDate,
      currentSlot: 'provisional',
      availableSlots: [],
      isProvisional: true,
      scheduledFor: null,
      capturedAt: now.toISOString(),
      isDelayed: false,
      nextScheduledSlot: nextScheduledSlot || '10:00',
      activeProfileCount,
      entries: rankedLiveEntries,
      timezone: 'Asia/Kolkata (IST)',
    };
  }
}

export const leaderboardService = new LeaderboardService();

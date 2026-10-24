import { eq, and, lte, gte, desc, or, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  workSessions,
  workSessionSegments,
  taskCompletions,
  userPreferences,
} from '../db/schema/index.js';
import {
  getAsiaKolkataDateString,
  getAsiaKolkataDayBounds,
  splitSegmentByAsiaKolkataDays,
  getPreviousDateString,
  getNextDateString,
  getWeekdayForDateString,
} from '../utils/timezone.js';

export interface DayContribution {
  date: string;
  weekday: number; // 0 = Sun, 1 = Mon, ...
  completionCount: number;
  focusSeconds: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface StatsSummary {
  todayDate: string;
  focusSecondsToday: number;
  completedTasksToday: number;
  dailyGoalSeconds: number;
  currentStreak: number;
  bestStreak: number;
}

export interface DayDetails {
  date: string;
  totalFocusSeconds: number;
  totalCompletions: number;
  completions: Array<{
    id: string;
    taskTitle: string;
    category: string | null;
    completedAt: Date;
  }>;
  sessions: Array<{
    id: string;
    taskTitle: string;
    category: string | null;
    mode: 'countdown' | 'stopwatch';
    status: string;
    trackedSeconds: number;
    startedAt: Date;
    finishedAt: Date | null;
  }>;
}

export class StatsService {
  /**
   * Returns stats summary for the authenticated user for today (Asia/Kolkata).
   */
  async getSummary(userId: string): Promise<StatsSummary> {
    const now = new Date();
    const todayDate = getAsiaKolkataDateString(now);
    const { startUtc, endUtc } = getAsiaKolkataDayBounds(todayDate);

    // 1. Fetch user preference for daily goal (default 14400s / 4h)
    const [pref] = await db
      .select({ dailyGoalSeconds: userPreferences.dailyGoalSeconds })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const dailyGoalSeconds = pref?.dailyGoalSeconds ?? 14400;

    // 2. Fetch completed tasks today
    const completionsToday = await db
      .select({ id: taskCompletions.id })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.userId, userId),
          gte(taskCompletions.completedAt, startUtc),
          lte(taskCompletions.completedAt, endUtc)
        )
      );

    const completedTasksToday = completionsToday.length;

    // 3. Compute active focus seconds today by splitting segments
    // Query segments of sessions owned by this user that overlap with today
    const segments = await db
      .select({
        startedAt: workSessionSegments.startedAt,
        endedAt: workSessionSegments.endedAt,
      })
      .from(workSessionSegments)
      .innerJoin(workSessions, eq(workSessionSegments.workSessionId, workSessions.id))
      .where(
        and(
          eq(workSessions.userId, userId),
          lte(workSessionSegments.startedAt, endUtc),
          or(
            gte(workSessionSegments.endedAt, startUtc),
            isNull(workSessionSegments.endedAt)
          )
        )
      );

    let focusSecondsToday = 0;
    for (const seg of segments) {
      const segStart = new Date(seg.startedAt);
      const segEnd = seg.endedAt ? new Date(seg.endedAt) : now;
      const effectiveEnd = segEnd > now ? now : segEnd;

      if (segStart < effectiveEnd) {
        const splits = splitSegmentByAsiaKolkataDays(segStart, effectiveEnd);
        for (const item of splits) {
          if (item.date === todayDate) {
            focusSecondsToday += item.seconds;
          }
        }
      }
    }

    // 4. Compute current and best streak
    const { currentStreak, bestStreak } = await this.calculateStreaks(userId, todayDate);

    return {
      todayDate,
      focusSecondsToday,
      completedTasksToday,
      dailyGoalSeconds,
      currentStreak,
      bestStreak,
    };
  }

  /**
   * Computes streak metrics strictly adhering to Asia/Kolkata calendar days.
   * A day counts if completionCount >= 1.
   * If today has 0 completions, streak continues from yesterday without resetting.
   */
  async calculateStreaks(userId: string, todayDate: string): Promise<{ currentStreak: number; bestStreak: number }> {
    // Fetch all completions for the user
    const allCompletions = await db
      .select({
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .where(eq(taskCompletions.userId, userId));

    if (allCompletions.length === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    // Map completions to unique Asia/Kolkata dates
    const activeDates = new Set<string>();
    for (const c of allCompletions) {
      activeDates.add(getAsiaKolkataDateString(new Date(c.completedAt)));
    }

    // Calculate current streak
    let currentStreak = 0;
    const yesterdayDate = getPreviousDateString(todayDate);

    let checkDate: string | null = null;
    if (activeDates.has(todayDate)) {
      checkDate = todayDate;
    } else if (activeDates.has(yesterdayDate)) {
      checkDate = yesterdayDate;
    }

    if (checkDate) {
      let cur = checkDate;
      while (activeDates.has(cur)) {
        currentStreak++;
        cur = getPreviousDateString(cur);
      }
    }

    // Calculate best streak
    const sortedDates = Array.from(activeDates).sort();
    let bestStreak = 0;
    let currentChain = 0;
    let lastDate: string | null = null;

    for (const d of sortedDates) {
      if (lastDate && d === getNextDateString(lastDate)) {
        currentChain++;
      } else {
        currentChain = 1;
      }
      if (currentChain > bestStreak) {
        bestStreak = currentChain;
      }
      lastDate = d;
    }

    return { currentStreak, bestStreak };
  }

  /**
   * Returns ~26 weeks of contribution data for GitHub-style calendar grid.
   * Grid starts on a Sunday and ends on Saturday of the current week (or today).
   */
  async getContributions(userId: string, weeks = 26): Promise<{
    startDate: string;
    endDate: string;
    totalFocusSeconds: number;
    totalCompletions: number;
    days: DayContribution[];
  }> {
    const now = new Date();
    const todayDate = getAsiaKolkataDateString(now);
    const todayWeekday = getWeekdayForDateString(todayDate); // 0 = Sun, ..., 6 = Sat

    // Calculate start date: 26 weeks ago, aligned to Sunday
    const daysToWalkBack = (weeks - 1) * 7 + todayWeekday;
    let startDate = todayDate;
    for (let i = 0; i < daysToWalkBack; i++) {
      startDate = getPreviousDateString(startDate);
    }

    // Build the full sequence of dates
    const dateList: string[] = [];
    let cur = startDate;
    while (cur <= todayDate) {
      dateList.push(cur);
      cur = getNextDateString(cur);
    }

    const { startUtc } = getAsiaKolkataDayBounds(startDate);
    const { endUtc } = getAsiaKolkataDayBounds(todayDate);

    // 1. Fetch completions in the date window
    const completions = await db
      .select({
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.userId, userId),
          gte(taskCompletions.completedAt, startUtc),
          lte(taskCompletions.completedAt, endUtc)
        )
      );

    const completionCountMap: Record<string, number> = {};
    for (const c of completions) {
      const d = getAsiaKolkataDateString(new Date(c.completedAt));
      completionCountMap[d] = (completionCountMap[d] || 0) + 1;
    }

    // 2. Fetch segments in the date window
    const segments = await db
      .select({
        startedAt: workSessionSegments.startedAt,
        endedAt: workSessionSegments.endedAt,
      })
      .from(workSessionSegments)
      .innerJoin(workSessions, eq(workSessionSegments.workSessionId, workSessions.id))
      .where(
        and(
          eq(workSessions.userId, userId),
          lte(workSessionSegments.startedAt, endUtc),
          or(
            gte(workSessionSegments.endedAt, startUtc),
            isNull(workSessionSegments.endedAt)
          )
        )
      );

    const focusSecondsMap: Record<string, number> = {};
    for (const seg of segments) {
      const segStart = new Date(seg.startedAt);
      const segEnd = seg.endedAt ? new Date(seg.endedAt) : now;
      const effectiveEnd = segEnd > now ? now : segEnd;

      if (segStart < effectiveEnd) {
        const splits = splitSegmentByAsiaKolkataDays(segStart, effectiveEnd);
        for (const item of splits) {
          focusSecondsMap[item.date] = (focusSecondsMap[item.date] || 0) + item.seconds;
        }
      }
    }

    let totalFocusSeconds = 0;
    let totalCompletions = 0;

    const days: DayContribution[] = dateList.map((d) => {
      const count = completionCountMap[d] || 0;
      const seconds = focusSecondsMap[d] || 0;

      totalFocusSeconds += seconds;
      totalCompletions += count;

      let level: 0 | 1 | 2 | 3 | 4 = 0;
      if (count === 1) level = 1;
      else if (count >= 2 && count <= 3) level = 2;
      else if (count >= 4 && count <= 6) level = 3;
      else if (count >= 7) level = 4;

      return {
        date: d,
        weekday: getWeekdayForDateString(d),
        completionCount: count,
        focusSeconds: seconds,
        level,
      };
    });

    return {
      startDate,
      endDate: todayDate,
      totalFocusSeconds,
      totalCompletions,
      days,
    };
  }

  /**
   * Returns details for a specific day: completions and work sessions.
   * Scoped strictly to the authenticated user.
   */
  async getDayDetails(userId: string, dateStr: string): Promise<DayDetails> {
    const { startUtc, endUtc } = getAsiaKolkataDayBounds(dateStr);
    const now = new Date();

    // 1. Completions on this day
    const completions = await db
      .select({
        id: taskCompletions.id,
        taskTitle: taskCompletions.taskTitleSnapshot,
        category: taskCompletions.categorySnapshot,
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.userId, userId),
          gte(taskCompletions.completedAt, startUtc),
          lte(taskCompletions.completedAt, endUtc)
        )
      )
      .orderBy(desc(taskCompletions.completedAt));

    // 2. Work sessions started on this day
    const sessions = await db
      .select({
        id: workSessions.id,
        taskTitle: workSessions.taskTitleSnapshot,
        category: workSessions.categorySnapshot,
        mode: workSessions.mode,
        status: workSessions.status,
        trackedSeconds: workSessions.trackedSeconds,
        startedAt: workSessions.startedAt,
        finishedAt: workSessions.finishedAt,
      })
      .from(workSessions)
      .where(
        and(
          eq(workSessions.userId, userId),
          gte(workSessions.startedAt, startUtc),
          lte(workSessions.startedAt, endUtc)
        )
      )
      .orderBy(desc(workSessions.startedAt));

    // 3. Focus seconds on this specific day from segments
    const segments = await db
      .select({
        startedAt: workSessionSegments.startedAt,
        endedAt: workSessionSegments.endedAt,
      })
      .from(workSessionSegments)
      .innerJoin(workSessions, eq(workSessionSegments.workSessionId, workSessions.id))
      .where(
        and(
          eq(workSessions.userId, userId),
          lte(workSessionSegments.startedAt, endUtc),
          or(
            gte(workSessionSegments.endedAt, startUtc),
            isNull(workSessionSegments.endedAt)
          )
        )
      );

    let totalFocusSeconds = 0;
    for (const seg of segments) {
      const segStart = new Date(seg.startedAt);
      const segEnd = seg.endedAt ? new Date(seg.endedAt) : now;
      const effectiveEnd = segEnd > now ? now : segEnd;

      if (segStart < effectiveEnd) {
        const splits = splitSegmentByAsiaKolkataDays(segStart, effectiveEnd);
        for (const item of splits) {
          if (item.date === dateStr) {
            totalFocusSeconds += item.seconds;
          }
        }
      }
    }

    return {
      date: dateStr,
      totalFocusSeconds,
      totalCompletions: completions.length,
      completions,
      sessions,
    };
  }

  /**
   * User preferences: get or update daily focus goal.
   */
  async getUserPreferences(userId: string): Promise<{ dailyGoalSeconds: number }> {
    const [pref] = await db
      .select({ dailyGoalSeconds: userPreferences.dailyGoalSeconds })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    return { dailyGoalSeconds: pref?.dailyGoalSeconds ?? 14400 };
  }

  async updateUserPreferences(userId: string, dailyGoalSeconds: number): Promise<{ dailyGoalSeconds: number }> {
    const now = new Date();
    const [updated] = await db
      .insert(userPreferences)
      .values({
        userId,
        dailyGoalSeconds,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: {
          dailyGoalSeconds,
          updatedAt: now,
        },
      })
      .returning({ dailyGoalSeconds: userPreferences.dailyGoalSeconds });

    return { dailyGoalSeconds: updated.dailyGoalSeconds };
  }
}

export const statsService = new StatsService();

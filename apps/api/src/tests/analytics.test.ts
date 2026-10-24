import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db/index.js';
import {
  users,
  tasks,
  workSessions,
  workSessionSegments,
  taskCompletions,
} from '../db/schema/index.js';
import { normalizeDisplayName } from '../utils/crypto.js';
import {
  getAsiaKolkataDateString,
  getAsiaKolkataDayBounds,
  getPreviousDateString,
} from '../utils/timezone.js';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

describe('Analytics API & Engine Integration Tests', () => {
  const testInviteCode = 'focus-team-2026';
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // Clean up potential old test records
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('AnalyticsTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('AnalyticsTester2')));

    // Register User 1
    const res1 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'AnalyticsTester1',
        pin: '1234',
        inviteCode: testInviteCode,
      });
    user1Id = res1.body.data.user.id;
    const header1 = res1.headers['set-cookie'];
    const cookies1 = Array.isArray(header1) ? header1 : [header1 as string];
    user1Cookie = cookies1.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // Register User 2
    const res2 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'AnalyticsTester2',
        pin: '5678',
        inviteCode: testInviteCode,
      });
    user2Id = res2.body.data.user.id;
    const header2 = res2.headers['set-cookie'];
    const cookies2 = Array.isArray(header2) ? header2 : [header2 as string];
    user2Cookie = cookies2.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('AnalyticsTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('AnalyticsTester2')));
  });

  it('GET /api/v1/analytics requires authentication with 401', async () => {
    const res = await request(app).get('/api/v1/analytics');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/analytics returns safe zero metrics for fresh user (no divide-by-zero)', async () => {
    const res = await request(app)
      .get('/api/v1/analytics?range=7d')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { summary, timeSeries, categories } = res.body.data;
    expect(summary.totalFocusSeconds).toBe(0);
    expect(summary.totalCompletions).toBe(0);
    expect(summary.calendarDaysCount).toBe(7);
    expect(summary.activeDaysCount).toBe(0);
    expect(summary.averageFocusSecondsPerCalendarDay).toBe(0);
    expect(summary.averageFocusSecondsPerActiveDay).toBe(0);
    expect(summary.mostFocusDay).toBeNull();
    expect(summary.mostCompletionsDay).toBeNull();
    expect(summary.longestSession).toBeNull();
    expect(timeSeries.length).toBe(7);
    expect(categories.length).toBe(0);
  });

  it('Validates allowed range parameter and rejects invalid range with 400', async () => {
    const res = await request(app)
      .get('/api/v1/analytics?range=invalid_range')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(400);
  });

  it('Returns exact range boundaries for 7d, 30d, 90d, 1y, and lifetime', async () => {
    // 7d
    const res7d = await request(app)
      .get('/api/v1/analytics?range=7d')
      .set('Cookie', user1Cookie);
    expect(res7d.status).toBe(200);
    expect(res7d.body.data.summary.calendarDaysCount).toBe(7);
    expect(res7d.body.data.binning).toBe('daily');
    expect(res7d.body.data.timeSeries.length).toBe(7);

    // 30d
    const res30d = await request(app)
      .get('/api/v1/analytics?range=30d')
      .set('Cookie', user1Cookie);
    expect(res30d.status).toBe(200);
    expect(res30d.body.data.summary.calendarDaysCount).toBe(30);
    expect(res30d.body.data.binning).toBe('daily');
    expect(res30d.body.data.timeSeries.length).toBe(30);

    // 90d
    const res90d = await request(app)
      .get('/api/v1/analytics?range=90d')
      .set('Cookie', user1Cookie);
    expect(res90d.status).toBe(200);
    expect(res90d.body.data.summary.calendarDaysCount).toBe(90);
    expect(res90d.body.data.binning).toBe('daily');
    expect(res90d.body.data.timeSeries.length).toBe(90);

    // 1y (trailing 365 days)
    const res1y = await request(app)
      .get('/api/v1/analytics?range=1y')
      .set('Cookie', user1Cookie);
    expect(res1y.status).toBe(200);
    expect(res1y.body.data.summary.calendarDaysCount).toBe(365);
    expect(res1y.body.data.binning).toBe('monthly');
    expect(res1y.body.data.timeSeries.length).toBeGreaterThanOrEqual(12);

    // lifetime
    const resLifetime = await request(app)
      .get('/api/v1/analytics?range=lifetime')
      .set('Cookie', user1Cookie);
    expect(resLifetime.status).toBe(200);
    expect(resLifetime.body.data.range).toBe('lifetime');
    expect(resLifetime.body.data.summary.priorPeriod).toBeNull();
  }, 60000);

  it('Calculates metrics with sessions, completions, midnight splits, and categories', async () => {
    // 1. Create a task with category "Coding"
    const [codingTask] = await db
      .insert(tasks)
      .values({
        ownerUserId: user1Id,
        title: 'Build Analytics API',
        category: 'Coding',
        status: 'active',
      })
      .returning();

    // 2. Create another task without category ("Uncategorized")
    const [uncatTask] = await db
      .insert(tasks)
      .values({
        ownerUserId: user1Id,
        title: 'Review System Metrics',
        category: null,
        status: 'active',
      })
      .returning();

    const now = new Date();
    const todayStr = getAsiaKolkataDateString(now);
    const yesterdayStr = getPreviousDateString(todayStr);

    const { startUtc: todayStart } = getAsiaKolkataDayBounds(todayStr);
    const { startUtc: yesterdayStart } = getAsiaKolkataDayBounds(yesterdayStr);

    // Create session 1: Coding, today (1800s / 30m)
    const session1Start = new Date(todayStart.getTime() + 10 * 3600 * 1000); // 10:00 AM IST today
    const session1End = new Date(session1Start.getTime() + 1800 * 1000);

    const [sess1] = await db
      .insert(workSessions)
      .values({
        userId: user1Id,
        taskId: codingTask.id,
        mode: 'countdown',
        status: 'completed',
        targetDurationSeconds: 1800,
        trackedSeconds: 1800,
        taskTitleSnapshot: 'Build Analytics API',
        categorySnapshot: 'Coding',
        startedAt: session1Start,
        finishedAt: session1End,
      })
      .returning();

    await db.insert(workSessionSegments).values({
      workSessionId: sess1.id,
      startedAt: session1Start,
      endedAt: session1End,
    });

    await db.insert(taskCompletions).values({
      userId: user1Id,
      taskId: codingTask.id,
      workSessionId: sess1.id,
      taskTitleSnapshot: 'Build Analytics API',
      categorySnapshot: 'Coding',
      completedAt: session1End,
    });

    // Create session 2: Uncategorized, yesterday (3600s / 60m - longest session)
    const session2Start = new Date(yesterdayStart.getTime() + 14 * 3600 * 1000); // 2:00 PM IST yesterday
    const session2End = new Date(session2Start.getTime() + 3600 * 1000);

    const [sess2] = await db
      .insert(workSessions)
      .values({
        userId: user1Id,
        taskId: uncatTask.id,
        mode: 'countdown',
        status: 'completed',
        targetDurationSeconds: 3600,
        trackedSeconds: 3600,
        taskTitleSnapshot: 'Review System Metrics',
        categorySnapshot: null,
        startedAt: session2Start,
        finishedAt: session2End,
      })
      .returning();

    await db.insert(workSessionSegments).values({
      workSessionId: sess2.id,
      startedAt: session2Start,
      endedAt: session2End,
    });

    await db.insert(taskCompletions).values({
      userId: user1Id,
      taskId: uncatTask.id,
      workSessionId: sess2.id,
      taskTitleSnapshot: 'Review System Metrics',
      categorySnapshot: null,
      completedAt: session2End,
    });

    // Add a second completion today on coding task (so today has 2 completions, yesterday has 1)
    // But yesterday has 3600s focus, today has 1800s focus!
    // This cleanly proves most-focus vs most-completions days can differ!
    const extraTime = new Date(todayStart.getTime() + 12 * 3600 * 1000);
    const [sessExtra] = await db
      .insert(workSessions)
      .values({
        userId: user1Id,
        taskId: codingTask.id,
        mode: 'stopwatch',
        status: 'completed',
        trackedSeconds: 0,
        taskTitleSnapshot: 'Build Analytics API',
        categorySnapshot: 'Coding',
        startedAt: extraTime,
        finishedAt: extraTime,
      })
      .returning();

    await db.insert(taskCompletions).values({
      userId: user1Id,
      taskId: codingTask.id,
      workSessionId: sessExtra.id,
      taskTitleSnapshot: 'Build Analytics API',
      categorySnapshot: 'Coding',
      completedAt: extraTime,
    });

    // Fetch Analytics for 7d
    const res = await request(app)
      .get('/api/v1/analytics?range=7d')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    const { summary, categories } = res.body.data;

    // Total focus = 1800 + 3600 = 5400s (1.5 hours)
    expect(summary.totalFocusSeconds).toBe(5400);
    // Total completions = 1 (today) + 1 (yesterday) + 1 (extra today) = 3
    expect(summary.totalCompletions).toBe(3);
    // Active days = 2 (today and yesterday)
    expect(summary.activeDaysCount).toBe(2);

    // Average per calendar day (5400 / 7 ≈ 771)
    expect(summary.averageFocusSecondsPerCalendarDay).toBe(Math.round(5400 / 7));
    // Average per active day (5400 / 2 = 2700)
    expect(summary.averageFocusSecondsPerActiveDay).toBe(2700);

    // Most focus day is yesterday (3600s > 1800s)
    expect(summary.mostFocusDay).not.toBeNull();
    expect(summary.mostFocusDay.date).toBe(yesterdayStr);
    expect(summary.mostFocusDay.focusSeconds).toBe(3600);

    // Most completions day is today (2 completions > 1 completion)
    expect(summary.mostCompletionsDay).not.toBeNull();
    expect(summary.mostCompletionsDay.date).toBe(todayStr);
    expect(summary.mostCompletionsDay.completionCount).toBe(2);

    // Longest session is sess2 (3600s)
    expect(summary.longestSession).not.toBeNull();
    expect(summary.longestSession.id).toBe(sess2.id);
    expect(summary.longestSession.trackedSeconds).toBe(3600);

    // Categories: "Uncategorized" (3600s, 67%) and "Coding" (1800s, 33%)
    expect(categories.length).toBe(2);
    const uncatStat = categories.find((c: any) => c.category === 'Uncategorized');
    expect(uncatStat).toBeDefined();
    expect(uncatStat.focusSeconds).toBe(3600);

    const codingStat = categories.find((c: any) => c.category === 'Coding');
    expect(codingStat).toBeDefined();
    expect(codingStat.focusSeconds).toBe(1800);
    expect(codingStat.completionCount).toBe(2);
  });

  it('Verifies user isolation: User 1 activity does not leak into User 2 analytics', async () => {
    const res = await request(app)
      .get('/api/v1/analytics?range=7d')
      .set('Cookie', user2Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.summary.totalFocusSeconds).toBe(0);
    expect(res.body.data.summary.totalCompletions).toBe(0);
    expect(res.body.data.summary.activeDaysCount).toBe(0);
    expect(res.body.data.categories.length).toBe(0);
  });
});

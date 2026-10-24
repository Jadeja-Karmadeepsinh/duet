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
  userPreferences,
  leaderboardSnapshotRuns,
} from '../db/schema/index.js';
import { normalizeDisplayName } from '../utils/crypto.js';
import {
  getAsiaKolkataDateString,
  getAsiaKolkataDayBounds,
  getPreviousDateString,
  splitSegmentByAsiaKolkataDays,
} from '../utils/timezone.js';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

describe('Stats API & Engine Integration Tests', () => {
  const testInviteCode = 'focus-team-2026';
  let user1Cookie: string;
  let user2Cookie: string;
  let user1Id: string;
  let user2Id: string;

  beforeAll(async () => {
    // 1. Clean up potential old test records
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('StatsTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('StatsTester2')));

    // 2. Register/Signin User 1
    const res1 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'StatsTester1',
        pin: '1234',
        inviteCode: testInviteCode,
      });

    if (res1.status === 201) {
      user1Id = res1.body.data.user.id;
      const header1 = res1.headers['set-cookie'];
      const cookies1 = Array.isArray(header1) ? header1 : [header1 as string];
      user1Cookie = cookies1.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];
    } else {
      const login1 = await request(app)
        .post('/api/v1/auth/signin')
        .send({ displayName: 'StatsTester1', pin: '1234' });
      user1Id = login1.body.data.user.id;
      const header1 = login1.headers['set-cookie'];
      const cookies1 = Array.isArray(header1) ? header1 : [header1 as string];
      user1Cookie = cookies1.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];
    }

    // 3. Register/Signin User 2
    const res2 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'StatsTester2',
        pin: '5678',
        inviteCode: testInviteCode,
      });

    if (res2.status === 201) {
      user2Id = res2.body.data.user.id;
      const header2 = res2.headers['set-cookie'];
      const cookies2 = Array.isArray(header2) ? header2 : [header2 as string];
      user2Cookie = cookies2.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];
    } else {
      const login2 = await request(app)
        .post('/api/v1/auth/signin')
        .send({ displayName: 'StatsTester2', pin: '5678' });
      user2Id = login2.body.data.user.id;
      const header2 = login2.headers['set-cookie'];
      const cookies2 = Array.isArray(header2) ? header2 : [header2 as string];
      user2Cookie = cookies2.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];
    }
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('StatsTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('StatsTester2')));
  });

  it('GET /api/v1/stats/summary requires authentication with 401', async () => {
    const res = await request(app).get('/api/v1/stats/summary');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/stats/summary returns genuine empty state for fresh user', async () => {
    const res = await request(app)
      .get('/api/v1/stats/summary')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.focusSecondsToday).toBe(0);
    expect(res.body.data.completedTasksToday).toBe(0);
    expect(res.body.data.currentStreak).toBe(0);
    expect(res.body.data.bestStreak).toBe(0);
    expect(res.body.data.dailyGoalSeconds).toBe(14400); // 4 hours default
  });

  it('GET /api/v1/stats/preferences and PATCH /api/v1/stats/preferences manages persistent goal', async () => {
    // 1. Get default
    const getRes = await request(app)
      .get('/api/v1/stats/preferences')
      .set('Cookie', user1Cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.dailyGoalSeconds).toBe(14400);

    // 2. Reject invalid (too short)
    const badRes = await request(app)
      .patch('/api/v1/stats/preferences')
      .set('Cookie', user1Cookie)
      .send({ dailyGoalSeconds: 30 });
    expect(badRes.status).toBe(400);

    // 3. Update to 3 hours (10800s)
    const patchRes = await request(app)
      .patch('/api/v1/stats/preferences')
      .set('Cookie', user1Cookie)
      .send({ dailyGoalSeconds: 10800 });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.data.dailyGoalSeconds).toBe(10800);

    // 4. Verify summary reflects updated goal
    const summaryRes = await request(app)
      .get('/api/v1/stats/summary')
      .set('Cookie', user1Cookie);
    expect(summaryRes.body.data.dailyGoalSeconds).toBe(10800);
  });

  it('GET /api/v1/stats/contributions returns ~26 weeks grid starting on Sunday', async () => {
    const res = await request(app)
      .get('/api/v1/stats/contributions')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { days, totalFocusSeconds, totalCompletions, startDate, endDate } = res.body.data;

    expect(days.length).toBeGreaterThanOrEqual(25 * 7); // ~180 days
    expect(days[0].weekday).toBe(0); // Starts on Sunday
    expect(startDate).toBe(days[0].date);
    expect(endDate).toBe(days[days.length - 1].date);
    expect(totalFocusSeconds).toBe(0);
    expect(totalCompletions).toBe(0);

    // Verify all days are empty level 0 for fresh user
    const hasNonZero = days.some((d: any) => d.level !== 0 || d.completionCount !== 0);
    expect(hasNonZero).toBe(false);
  });

  it('GET /api/v1/stats/contributions?weeks=52 returns full year (~52 weeks) starting on Sunday', async () => {
    const res = await request(app)
      .get('/api/v1/stats/contributions?weeks=52')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const { days, totalFocusSeconds, totalCompletions, startDate, endDate } = res.body.data;

    expect(days.length).toBeGreaterThanOrEqual(51 * 7); // ~364 days
    expect(days[0].weekday).toBe(0); // Starts on Sunday
    expect(startDate).toBe(days[0].date);
    expect(endDate).toBe(days[days.length - 1].date);
    expect(totalFocusSeconds).toBe(0);
    expect(totalCompletions).toBe(0);
  });

  it('Calculates streaks correctly when tasks are completed today and past days', async () => {
    // 1. Create a task for User 1
    const [task] = await db
      .insert(tasks)
      .values({
        ownerUserId: user1Id,
        title: 'Deep Work Session',
        category: 'Coding',
        status: 'active',
      })
      .returning();

    // 2. Create a completed session and completion for today
    const now = new Date();
    const todayStr = getAsiaKolkataDateString(now);

    const [sessionToday] = await db
      .insert(workSessions)
      .values({
        userId: user1Id,
        taskId: task.id,
        mode: 'countdown',
        status: 'completed',
        targetDurationSeconds: 1500,
        trackedSeconds: 1500,
        taskTitleSnapshot: 'Deep Work Session',
        categorySnapshot: 'Coding',
        finishedAt: now,
      })
      .returning();

    await db.insert(taskCompletions).values({
      userId: user1Id,
      taskId: task.id,
      workSessionId: sessionToday.id,
      taskTitleSnapshot: 'Deep Work Session',
      categorySnapshot: 'Coding',
      completedAt: now,
    });

    // 3. Verify currentStreak is 1, bestStreak is 1
    let summary = await request(app)
      .get('/api/v1/stats/summary')
      .set('Cookie', user1Cookie);
    expect(summary.body.data.completedTasksToday).toBe(1);
    expect(summary.body.data.currentStreak).toBe(1);
    expect(summary.body.data.bestStreak).toBe(1);

    // 4. Insert completion for yesterday in Asia/Kolkata
    const yesterdayStr = getPreviousDateString(todayStr);
    const { startUtc: yesterdayStart } = getAsiaKolkataDayBounds(yesterdayStr);
    const yesterdayTime = new Date(yesterdayStart.getTime() + 10 * 3600 * 1000); // 10:00 AM IST yesterday

    const [sessionYesterday] = await db
      .insert(workSessions)
      .values({
        userId: user1Id,
        taskId: task.id,
        mode: 'countdown',
        status: 'completed',
        targetDurationSeconds: 1800,
        trackedSeconds: 1800,
        taskTitleSnapshot: 'Deep Work Session',
        categorySnapshot: 'Coding',
        finishedAt: yesterdayTime,
      })
      .returning();

    await db.insert(taskCompletions).values({
      userId: user1Id,
      taskId: task.id,
      workSessionId: sessionYesterday.id,
      taskTitleSnapshot: 'Deep Work Session',
      categorySnapshot: 'Coding',
      completedAt: yesterdayTime,
    });

    // 5. Verify streak is now 2
    summary = await request(app)
      .get('/api/v1/stats/summary')
      .set('Cookie', user1Cookie);
    expect(summary.body.data.currentStreak).toBe(2);
    expect(summary.body.data.bestStreak).toBe(2);
  }, 60000);

  it('GET /api/v1/stats/day returns detailed completions and sessions for a date', async () => {
    const todayStr = getAsiaKolkataDateString(new Date());
    const res = await request(app)
      .get(`/api/v1/stats/day?date=${todayStr}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.date).toBe(todayStr);
    expect(res.body.data.totalCompletions).toBe(1);
    expect(res.body.data.completions.length).toBe(1);
    expect(res.body.data.completions[0].taskTitle).toBe('Deep Work Session');
  });

  it('GET /api/v1/stats/day validates date format and rejects invalid with 400', async () => {
    const res = await request(app)
      .get('/api/v1/stats/day?date=invalid-date')
      .set('Cookie', user1Cookie);
    expect(res.status).toBe(400);
  });

  it('Verifies user isolation: User 1 completions do not affect User 2 stats', async () => {
    const summary2 = await request(app)
      .get('/api/v1/stats/summary')
      .set('Cookie', user2Cookie);

    expect(summary2.body.data.completedTasksToday).toBe(0);
    expect(summary2.body.data.currentStreak).toBe(0);
    expect(summary2.body.data.bestStreak).toBe(0);
  });

  it('GET /api/v1/stats/leaderboard-preview returns provisional status when no snapshot run exists', async () => {
    const todayDate = getAsiaKolkataDateString(new Date());
    await db.delete(leaderboardSnapshotRuns).where(eq(leaderboardSnapshotRuns.localDate, todayDate));

    const res = await request(app)
      .get('/api/v1/stats/leaderboard-preview')
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('provisional');
    expect(res.body.data.nextScheduledSlot).toBe('10:00');
  });
});

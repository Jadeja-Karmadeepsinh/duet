import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db/index.js';
import { users, tasks, workSessions, workSessionSegments, taskCompletions } from '../db/schema/index.js';
import { normalizeDisplayName } from '../utils/crypto.js';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

describe('Timer Engine Integration Tests', () => {
  const testInviteCode = 'focus-team-2026';
  let user1Cookie: string;
  let user2Cookie: string;
  let user1CountdownTaskId: string;
  let user1StopwatchTaskId: string;
  let user2TaskId: string;

  beforeAll(async () => {
    // Clean up test users if they exist
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TimerTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TimerTester2')));

    // Sign up User 1
    const res1 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'TimerTester1',
        pin: '1234',
        inviteCode: testInviteCode,
      });
    const header1 = res1.headers['set-cookie'];
    const cookies1 = Array.isArray(header1) ? header1 : [header1 as string];
    user1Cookie = cookies1.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // Sign up User 2
    const res2 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'TimerTester2',
        pin: '5678',
        inviteCode: testInviteCode,
      });
    const header2 = res2.headers['set-cookie'];
    const cookies2 = Array.isArray(header2) ? header2 : [header2 as string];
    user2Cookie = cookies2.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`))!.split(';')[0];

    // Create Countdown Task for User 1 (plannedDurationSeconds: 1500 = 25m)
    const taskRes1 = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', user1Cookie)
      .send({
        title: 'Deep Work Session',
        category: 'Engineering',
        plannedDurationSeconds: 1500,
      });
    user1CountdownTaskId = taskRes1.body.data.task.id;

    // Create Stopwatch Task for User 1 (plannedDurationSeconds: null)
    const taskRes2 = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', user1Cookie)
      .send({
        title: 'Open Ended Brainstorming',
        category: 'Product',
      });
    user1StopwatchTaskId = taskRes2.body.data.task.id;

    // Create Task for User 2
    const taskRes3 = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', user2Cookie)
      .send({
        title: 'User 2 Task',
        category: 'Ops',
        plannedDurationSeconds: 1800,
      });
    user2TaskId = taskRes3.body.data.task.id;
  });

  afterAll(async () => {
    // Clean up test data cascade deletes sessions and tasks
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TimerTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TimerTester2')));
  });

  describe('Countdown Flow: Start, Pause, Resume, Expiry & Extension', () => {
    let countdownSessionId: string;

    it('POST /api/v1/work-sessions/start creates a countdown session with open segment', async () => {
      const res = await request(app)
        .post('/api/v1/work-sessions/start')
        .set('Cookie', user1Cookie)
        .send({ taskId: user1CountdownTaskId });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session.mode).toBe('countdown');
      expect(session.status).toBe('running');
      expect(session.targetDurationSeconds).toBe(1500);
      expect(session.trackedSeconds).toBe(0);
      expect(session.remainingSeconds).toBe(1500);
      expect(session.taskTitleSnapshot).toBe('Deep Work Session');
      expect(session.categorySnapshot).toBe('Engineering');
      expect(session.activeSegmentStartedAt).toBeDefined();

      countdownSessionId = session.id;

      // Verify open segment in DB
      const segments = await db
        .select()
        .from(workSessionSegments)
        .where(eq(workSessionSegments.workSessionId, countdownSessionId));
      expect(segments.length).toBe(1);
      expect(segments[0].endedAt).toBeNull();
    });

    it('GET /api/v1/work-sessions/current returns the running countdown session', async () => {
      const res = await request(app)
        .get('/api/v1/work-sessions/current')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session).not.toBeNull();
      expect(session.id).toBe(countdownSessionId);
      expect(session.status).toBe('running');
      expect(session.mode).toBe('countdown');
    });

    it('POST /api/v1/work-sessions/start rejects starting another session while one is running with 409', async () => {
      const res = await request(app)
        .post('/api/v1/work-sessions/start')
        .set('Cookie', user1Cookie)
        .send({ taskId: user1StopwatchTaskId });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('CONFLICT');
    });

    it('POST /api/v1/work-sessions/:id/pause pauses running session and closes segment at server time', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/pause`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session.status).toBe('paused');
      expect(session.activeSegmentStartedAt).toBeNull();

      // Verify in DB that open segment has endedAt populated
      const segments = await db
        .select()
        .from(workSessionSegments)
        .where(eq(workSessionSegments.workSessionId, countdownSessionId));
      expect(segments.length).toBe(1);
      expect(segments[0].endedAt).not.toBeNull();
    });

    it('GET /api/v1/work-sessions/paused lists the paused session', async () => {
      const res = await request(app)
        .get('/api/v1/work-sessions/paused')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const pausedSessions = res.body.data.sessions;
      expect(pausedSessions.length).toBeGreaterThanOrEqual(1);
      expect(pausedSessions.some((s: any) => s.id === countdownSessionId)).toBe(true);
    });

    it('GET /api/v1/work-sessions/current returns the paused session with frozen tracked duration', async () => {
      const res = await request(app)
        .get('/api/v1/work-sessions/current')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session).not.toBeNull();
      expect(session.id).toBe(countdownSessionId);
      expect(session.status).toBe('paused');
      expect(session.activeSegmentStartedAt).toBeNull();
      expect(session.elapsedSeconds).toBe(session.trackedSeconds);
    });

    it('POST /api/v1/work-sessions/:id/pause rejects pausing an already paused session with 409', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/pause`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(409);
    });

    it('POST /api/v1/work-sessions/:id/resume resumes the paused session and opens a new segment', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/resume`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session.status).toBe('running');
      expect(session.activeSegmentStartedAt).toBeDefined();

      // Verify in DB that there are now 2 segments: 1 closed, 1 open
      const segments = await db
        .select()
        .from(workSessionSegments)
        .where(eq(workSessionSegments.workSessionId, countdownSessionId));
      expect(segments.length).toBe(2);
      const openSegments = segments.filter((s) => s.endedAt === null);
      expect(openSegments.length).toBe(1);
    });

    it('POST /api/v1/work-sessions/:id/resume rejects resuming an already running session with 409', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/resume`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(409);
    });

    it('POST /api/v1/work-sessions/:id/expire triggers zero-crossing transition to awaiting_decision', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/expire`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session.status).toBe('awaiting_decision');
      expect(session.isExpired).toBe(true);
      expect(session.remainingSeconds).toBe(0);
      expect(session.elapsedSeconds).toBe(1500);
      expect(session.trackedSeconds).toBe(1500);

      // Verify segment was closed in DB
      const openSegments = await db
        .select()
        .from(workSessionSegments)
        .where(eq(workSessionSegments.workSessionId, countdownSessionId));
      expect(openSegments.every((s) => s.endedAt !== null)).toBe(true);
    });

    it('POST /api/v1/work-sessions/:id/expire is idempotent when already awaiting_decision', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/expire`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.session.status).toBe('awaiting_decision');
    });

    it('POST /api/v1/work-sessions/:id/extend validates allowed durations (15/30/60m)', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/extend`)
        .set('Cookie', user1Cookie)
        .send({ extensionSeconds: 500 }); // Not 900, 1800, or 3600

      expect(res.status).toBe(400);
    });

    it('POST /api/v1/work-sessions/:id/extend extends target by 900s (+15m) and opens fresh segment', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/extend`)
        .set('Cookie', user1Cookie)
        .send({ extensionSeconds: 900 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session.status).toBe('running');
      expect(session.targetDurationSeconds).toBe(2400); // 1500 + 900
      expect(session.trackedSeconds).toBe(1500); // preserves target, decision gap excluded
      expect(session.remainingSeconds).toBe(900);

      // Verify new open segment in DB
      const segments = await db
        .select()
        .from(workSessionSegments)
        .where(eq(workSessionSegments.workSessionId, countdownSessionId));
      const openSegments = segments.filter((s) => s.endedAt === null);
      expect(openSegments.length).toBe(1);
    });

    it('POST /api/v1/work-sessions/:id/complete closes segment, marks completed, and creates task_completions', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/complete`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const { session, completion } = res.body.data;
      expect(session.status).toBe('completed');
      expect(session.finishedAt).toBeDefined();
      expect(completion).toBeDefined();
      expect(completion.workSessionId).toBe(countdownSessionId);
      expect(completion.taskTitleSnapshot).toBe('Deep Work Session');

      // Verify DB completion row
      const completionsInDb = await db
        .select()
        .from(taskCompletions)
        .where(eq(taskCompletions.workSessionId, countdownSessionId));
      expect(completionsInDb.length).toBe(1);
    });

    it('POST /api/v1/work-sessions/:id/complete is idempotent: repeat request does not duplicate completions', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/complete`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const completionsInDb = await db
        .select()
        .from(taskCompletions)
        .where(eq(taskCompletions.workSessionId, countdownSessionId));
      expect(completionsInDb.length).toBe(1);
    });

    it('POST /api/v1/work-sessions/:id/resume rejects resuming completed session with 409', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${countdownSessionId}/resume`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(409);
    });
  });

  describe('Stopwatch Flow & Stop Transition', () => {
    let stopwatchSessionId: string;

    it('POST /api/v1/work-sessions/start creates a stopwatch session when plannedDurationSeconds is null', async () => {
      const res = await request(app)
        .post('/api/v1/work-sessions/start')
        .set('Cookie', user1Cookie)
        .send({ taskId: user1StopwatchTaskId });

      expect(res.status).toBe(201);
      const session = res.body.data.session;
      expect(session.mode).toBe('stopwatch');
      expect(session.status).toBe('running');
      expect(session.targetDurationSeconds).toBeNull();
      expect(session.remainingSeconds).toBeNull();

      stopwatchSessionId = session.id;
    });

    it('POST /api/v1/work-sessions/:id/extend rejects extending a stopwatch session with 409', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${stopwatchSessionId}/extend`)
        .set('Cookie', user1Cookie)
        .send({ extensionSeconds: 900 });

      expect(res.status).toBe(409);
    });

    it('POST /api/v1/work-sessions/:id/stop stops session and does NOT insert a completion row', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${stopwatchSessionId}/stop`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const session = res.body.data.session;
      expect(session.status).toBe('stopped');
      expect(session.finishedAt).toBeDefined();

      // Verify NO task completion was created
      const completions = await db
        .select()
        .from(taskCompletions)
        .where(eq(taskCompletions.workSessionId, stopwatchSessionId));
      expect(completions.length).toBe(0);
    });

    it('POST /api/v1/work-sessions/:id/stop is idempotent when already stopped', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${stopwatchSessionId}/stop`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.session.status).toBe('stopped');
    });

    it('POST /api/v1/work-sessions/:id/complete rejects completing a stopped session with 409', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${stopwatchSessionId}/complete`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(409);
    });
  });

  describe('Reconciliation on GET /current (Page Reload / Restore)', () => {
    it('auto-reconciles expired countdown into awaiting_decision and closes segment at target boundary', async () => {
      // 1. Create task with short duration (60 seconds)
      const taskRes = await request(app)
        .post('/api/v1/tasks')
        .set('Cookie', user1Cookie)
        .send({
          title: 'Auto Reconcile Test Task',
          plannedDurationSeconds: 60,
        });
      const taskId = taskRes.body.data.task.id;

      // 2. Start session
      const startRes = await request(app)
        .post('/api/v1/work-sessions/start')
        .set('Cookie', user1Cookie)
        .send({ taskId });
      const sessionId = startRes.body.data.session.id;

      // 3. Artificially backdate the open segment startedAt by 120 seconds in DB
      const pastStartedAt = new Date(Date.now() - 120 * 1000);
      await db
        .update(workSessionSegments)
        .set({ startedAt: pastStartedAt })
        .where(eq(workSessionSegments.workSessionId, sessionId));

      // 4. Now perform GET /current (simulates browser reload after expiry)
      const currentRes = await request(app)
        .get('/api/v1/work-sessions/current')
        .set('Cookie', user1Cookie);

      expect(currentRes.status).toBe(200);
      const session = currentRes.body.data.session;
      expect(session).not.toBeNull();
      expect(session.id).toBe(sessionId);
      expect(session.status).toBe('awaiting_decision');
      expect(session.trackedSeconds).toBe(60);
      expect(session.elapsedSeconds).toBe(60);
      expect(session.remainingSeconds).toBe(0);

      // 5. Verify the segment was closed exactly at target boundary: pastStartedAt + 60s
      const [segment] = await db
        .select()
        .from(workSessionSegments)
        .where(eq(workSessionSegments.workSessionId, sessionId));
      expect(segment.endedAt).not.toBeNull();
      const segmentDurationSeconds = Math.round((segment.endedAt!.getTime() - segment.startedAt.getTime()) / 1000);
      expect(segmentDurationSeconds).toBe(60); // exactly at target boundary!

      // Clean up session by stopping it
      await request(app)
        .post(`/api/v1/work-sessions/${sessionId}/stop`)
        .set('Cookie', user1Cookie);
    });
  });

  describe('Concurrency & Race Condition Protection', () => {
    it('prevents two simultaneous start requests from creating two running sessions', async () => {
      // Create a new task
      const taskRes = await request(app)
        .post('/api/v1/tasks')
        .set('Cookie', user1Cookie)
        .send({
          title: 'Concurrent Race Task',
          plannedDurationSeconds: 300,
        });
      const taskId = taskRes.body.data.task.id;

      // Fire two nearly simultaneous start requests
      const [resA, resB] = await Promise.all([
        request(app).post('/api/v1/work-sessions/start').set('Cookie', user1Cookie).send({ taskId }),
        request(app).post('/api/v1/work-sessions/start').set('Cookie', user1Cookie).send({ taskId }),
      ]);

      const statuses = [resA.status, resB.status];
      // Exactly one must succeed (201) and one must fail with Conflict (409)
      expect(statuses).toContain(201);
      expect(statuses).toContain(409);

      // Verify in DB that only 1 running session exists for user
      const runningSessions = await db
        .select()
        .from(workSessions)
        .where(eq(workSessions.status, 'running'));
      const userRunning = runningSessions.filter((s) => s.userId !== undefined);
      expect(userRunning.length).toBe(1);

      // Clean up
      const activeId = resA.status === 201 ? resA.body.data.session.id : resB.body.data.session.id;
      await request(app)
        .post(`/api/v1/work-sessions/${activeId}/stop`)
        .set('Cookie', user1Cookie);
    }, 30000);
  });

  describe('User Ownership & Profile Isolation', () => {
    let user2SessionId: string;

    beforeAll(async () => {
      const res = await request(app)
        .post('/api/v1/work-sessions/start')
        .set('Cookie', user2Cookie)
        .send({ taskId: user2TaskId });
      user2SessionId = res.body.data.session.id;
    });

    afterAll(async () => {
      await request(app)
        .post(`/api/v1/work-sessions/${user2SessionId}/stop`)
        .set('Cookie', user2Cookie);
    });

    it('User 1 cannot pause User 2 session (returns 404)', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${user2SessionId}/pause`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(404);
    });

    it('User 1 cannot complete User 2 session (returns 404)', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${user2SessionId}/complete`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(404);
    });

    it('User 1 cannot stop User 2 session (returns 404)', async () => {
      const res = await request(app)
        .post(`/api/v1/work-sessions/${user2SessionId}/stop`)
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(404);
    });
  });

  describe('History, Pagination, and Filters', () => {
    it('GET /api/v1/work-sessions returns paginated list with totalCount and totalPages', async () => {
      const res = await request(app)
        .get('/api/v1/work-sessions?page=1&limit=2')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sessions.length).toBeLessThanOrEqual(2);
      expect(res.body.data.pagination.page).toBe(1);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.totalCount).toBeGreaterThanOrEqual(1);
    });

    it('GET /api/v1/work-sessions?status=completed filters only completed sessions', async () => {
      const res = await request(app)
        .get('/api/v1/work-sessions?status=completed')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      const sessions = res.body.data.sessions;
      expect(sessions.every((s: any) => s.status === 'completed')).toBe(true);
    });
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TimerTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TimerTester2')));
  });
});


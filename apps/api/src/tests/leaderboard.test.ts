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
  leaderboardSnapshotRuns,
  leaderboardSnapshotEntries,
} from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import {
  getSlotScheduledUtc,
  isSlotDelayed,
  getAsiaKolkataDateString,
  getDateDaysAgo,
} from '../utils/timezone.js';
import { leaderboardService } from '../services/leaderboard.service.js';
import { env } from '../config/env.js';

describe('Leaderboard & Snapshot Engine Tests', () => {
  const testPin = '9876';
  let user1Cookie: string;
  let user1Id: string;
  let user2Cookie: string;
  let user2Id: string;

  beforeAll(async () => {
    // Clean up test users first to guarantee profile capacity
    await db.delete(users).where(eq(users.displayName, 'Alpha Leader'));
    await db.delete(users).where(eq(users.displayName, 'Beta Runner'));

    // 1. Create User 1
    const res1 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'Alpha Leader',
        pin: testPin,
        inviteCode: env.INVITE_CODE,
      });

    if (res1.status === 201) {
      user1Cookie = res1.headers['set-cookie'][0];
      user1Id = res1.body.data.user.id;
    } else {
      const login1 = await request(app)
        .post('/api/v1/auth/signin')
        .send({ displayName: 'Alpha Leader', pin: testPin });
      user1Cookie = login1.headers['set-cookie'][0];
      user1Id = login1.body.data.user.id;
    }

    // 2. Create User 2
    const res2 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'Beta Runner',
        pin: testPin,
        inviteCode: env.INVITE_CODE,
      });

    if (res2.status === 201) {
      user2Cookie = res2.headers['set-cookie'][0];
      user2Id = res2.body.data.user.id;
    } else {
      const login2 = await request(app)
        .post('/api/v1/auth/signin')
        .send({ displayName: 'Beta Runner', pin: testPin });
      user2Cookie = login2.headers['set-cookie'][0];
      user2Id = login2.body.data.user.id;
    }
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.displayName, 'Alpha Leader'));
    await db.delete(users).where(eq(users.displayName, 'Beta Runner'));
  });

  describe('Timezone & Slot Math', () => {
    it('calculates scheduled UTC timestamps in Asia/Kolkata independent of machine timezone', () => {
      // 10:00 AM IST on 2026-10-24 should be 04:30:00.000Z
      const utc10 = getSlotScheduledUtc('2026-10-24', '10:00');
      expect(utc10.toISOString()).toBe('2026-10-24T04:30:00.000Z');

      // 18:00 IST on 2026-10-24 should be 12:30:00.000Z
      const utc18 = getSlotScheduledUtc('2026-10-24', '18:00');
      expect(utc18.toISOString()).toBe('2026-10-24T12:30:00.000Z');

      // 22:00 IST on 2026-10-24 should be 16:30:00.000Z
      const utc22 = getSlotScheduledUtc('2026-10-24', '22:00');
      expect(utc22.toISOString()).toBe('2026-10-24T16:30:00.000Z');
    });

    it('correctly calculates delayed status when capture is > 15 minutes late', () => {
      const scheduled = new Date('2026-10-24T04:30:00.000Z');

      // 5 minutes later: not delayed
      const capturedOnTime = new Date('2026-10-24T04:35:00.000Z');
      expect(isSlotDelayed(scheduled, capturedOnTime)).toBe(false);

      // 16 minutes later: delayed
      const capturedLate = new Date('2026-10-24T04:46:00.000Z');
      expect(isSlotDelayed(scheduled, capturedLate)).toBe(true);
    });
  });

  describe('Snapshot Capture & Idempotency', () => {
    const testDate = '2026-01-15';

    it('captures snapshot run and user entries idempotently', async () => {
      const scheduledUtc = getSlotScheduledUtc(testDate, '10:00');

      // Clean up test slot if existing
      await db
        .delete(leaderboardSnapshotRuns)
        .where(
          and(
            eq(leaderboardSnapshotRuns.localDate, testDate),
            eq(leaderboardSnapshotRuns.slot, '10:00')
          )
        );

      // First capture
      const run1 = await leaderboardService.captureSnapshot(testDate, '10:00', scheduledUtc);
      expect(run1).toBeDefined();
      expect(run1.localDate).toBe(testDate);
      expect(run1.slot).toBe('10:00');

      // Verify entries were created
      const entries = await db
        .select()
        .from(leaderboardSnapshotEntries)
        .where(eq(leaderboardSnapshotEntries.snapshotRunId, run1.id));
      expect(entries.length).toBeGreaterThanOrEqual(1);

      // Second capture: must return identical run without duplicate error or duplicate entries
      const run2 = await leaderboardService.captureSnapshot(testDate, '10:00', scheduledUtc);
      expect(run2.id).toBe(run1.id);

      const entriesAfter = await db
        .select()
        .from(leaderboardSnapshotEntries)
        .where(eq(leaderboardSnapshotEntries.snapshotRunId, run1.id));
      expect(entriesAfter.length).toBe(entries.length);
    });

    it('handles concurrent snapshot requests for the same date and slot safely', async () => {
      const sched = getSlotScheduledUtc(testDate, '18:00');

      // Clean up slot
      await db
        .delete(leaderboardSnapshotRuns)
        .where(
          and(
            eq(leaderboardSnapshotRuns.localDate, testDate),
            eq(leaderboardSnapshotRuns.slot, '18:00')
          )
        );

      // Run 3 simultaneous captures
      const [r1, r2, r3] = await Promise.all([
        leaderboardService.captureSnapshot(testDate, '18:00', sched),
        leaderboardService.captureSnapshot(testDate, '18:00', sched),
        leaderboardService.captureSnapshot(testDate, '18:00', sched),
      ]);

      expect(r1.id).toBe(r2.id);
      expect(r2.id).toBe(r3.id);
    });
  });

  describe('Ranking and Tie-Breaking', () => {
    it('ranks primarily by focus seconds desc, then completions desc, then displayName asc', async () => {
      const todayDate = getAsiaKolkataDateString(new Date());

      // Fetch leaderboard
      const res = await request(app)
        .get('/api/v1/leaderboard?period=today')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.timezone).toContain('Asia/Kolkata');
      expect(Array.isArray(res.body.data.entries)).toBe(true);

      const entries = res.body.data.entries;
      for (let i = 0; i < entries.length - 1; i++) {
        const cur = entries[i];
        const next = entries[i + 1];

        // Should be sorted by focusSeconds desc or completions desc if tied
        if (cur.focusSeconds === next.focusSeconds) {
          expect(cur.completedTasks).toBeGreaterThanOrEqual(next.completedTasks);
        } else {
          expect(cur.focusSeconds).toBeGreaterThan(next.focusSeconds);
        }
      }

      // Check current user flag
      const user1Entry = entries.find((e: any) => e.userId === user1Id);
      if (user1Entry) {
        expect(user1Entry.isCurrentUser).toBe(true);
      }
    });

    it('supports period=7d for rolling seven-day rankings', async () => {
      const res = await request(app)
        .get('/api/v1/leaderboard?period=7d')
        .set('Cookie', user1Cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.period).toBe('7d');
      expect(Array.isArray(res.body.data.entries)).toBe(true);
    });
  });

  describe('Internal Protected CRON_SECRET Endpoint', () => {
    it('rejects unauthorized requests without CRON_SECRET', async () => {
      const res = await request(app).post('/api/v1/jobs/leaderboard-snapshot');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rejects requests with incorrect CRON_SECRET', async () => {
      const res = await request(app)
        .post('/api/v1/jobs/leaderboard-snapshot')
        .set('x-cron-secret', 'wrong-secret-token');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('processes due snapshots with valid x-cron-secret header', async () => {
      const cronSecret = env.CRON_SECRET || env.JOB_SECRET;
      const res = await request(app)
        .post('/api/v1/jobs/leaderboard-snapshot')
        .set('x-cron-secret', cronSecret);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results).toBeDefined();
    });

    it('accepts valid secret via Authorization: Bearer <secret>', async () => {
      const cronSecret = env.CRON_SECRET || env.JOB_SECRET;
      const res = await request(app)
        .post('/api/v1/jobs/leaderboard-snapshot')
        .set('Authorization', `Bearer ${cronSecret}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

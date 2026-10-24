import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db } from '../db/index.js';
import { users } from '../db/schema/index.js';
import { normalizeDisplayName } from '../utils/crypto.js';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

describe('Tasks API Integration Tests', () => {
  const testInviteCode = 'focus-team-2026';
  let user1Cookie: string;
  let user2Cookie: string;
  let user1TaskId: string;
  let user2TaskId: string;

  beforeAll(async () => {
    // Clean up test users
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TaskTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TaskTester2')));

    // Register User 1
    const res1 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'TaskTester1',
        pin: '1234',
        inviteCode: testInviteCode,
      });
    const header1 = res1.headers['set-cookie'];
    const cookies1 = Array.isArray(header1) ? header1 : [header1 as string];
    const c1 = cookies1.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`));
    user1Cookie = c1!.split(';')[0];

    // Register User 2
    const res2 = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'TaskTester2',
        pin: '5678',
        inviteCode: testInviteCode,
      });
    const header2 = res2.headers['set-cookie'];
    const cookies2 = Array.isArray(header2) ? header2 : [header2 as string];
    const c2 = cookies2.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`));
    user2Cookie = c2!.split(';')[0];
  });

  afterAll(async () => {
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TaskTester1')));
    await db.delete(users).where(eq(users.normalizedName, normalizeDisplayName('TaskTester2')));
  });

  it('GET /api/v1/tasks requires authentication with 401', async () => {
    const res = await request(app).get('/api/v1/tasks');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/tasks validates input and rejects negative duration with 400', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', user1Cookie)
      .send({
        title: 'Invalid Task',
        plannedDurationSeconds: -100, // Invalid
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/v1/tasks creates a task for User 1', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', user1Cookie)
      .send({
        title: 'Deep Architecture Design',
        description: 'Writing backend specifications',
        plannedDurationSeconds: 1500,
        category: 'Engineering',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.task.title).toBe('Deep Architecture Design');
    expect(res.body.data.task.status).toBe('active');
    expect(res.body.data.task.plannedDurationSeconds).toBe(1500);

    user1TaskId = res.body.data.task.id;
  });

  it('POST /api/v1/tasks creates a task for User 2', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set('Cookie', user2Cookie)
      .send({
        title: 'User 2 Secret Task',
        category: 'Private',
      });

    expect(res.status).toBe(201);
    user2TaskId = res.body.data.task.id;
  });

  it('GET /api/v1/tasks returns only tasks owned by authenticated user', async () => {
    const res1 = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', user1Cookie);

    expect(res1.status).toBe(200);
    expect(res1.body.data.tasks).toHaveLength(1);
    expect(res1.body.data.tasks[0].id).toBe(user1TaskId);

    const res2 = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', user2Cookie);

    expect(res2.status).toBe(200);
    expect(res2.body.data.tasks).toHaveLength(1);
    expect(res2.body.data.tasks[0].id).toBe(user2TaskId);
  });

  it('GET /api/v1/tasks/:id returns 404 when User 1 tries to access User 2 task', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${user2TaskId}`)
      .set('Cookie', user1Cookie);

    // Must return 404 (not 403) to prevent ID enumeration/probing
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('PATCH /api/v1/tasks/:id returns 404 when User 1 tries to edit User 2 task', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${user2TaskId}`)
      .set('Cookie', user1Cookie)
      .send({ title: 'Hacked Title' });

    expect(res.status).toBe(404);
  });

  it('PATCH /api/v1/tasks/:id allows User 1 to update own task', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${user1TaskId}`)
      .set('Cookie', user1Cookie)
      .send({
        title: 'Updated Architecture Design',
        plannedDurationSeconds: 1800,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.task.title).toBe('Updated Architecture Design');
    expect(res.body.data.task.plannedDurationSeconds).toBe(1800);
  });

  it('DELETE /api/v1/tasks/:id soft-archives the task', async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${user1TaskId}`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('archived');
    expect(res.body.data.task.archivedAt).not.toBeNull();

    // Default list should now be empty (active only)
    const listRes = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', user1Cookie);

    expect(listRes.body.data.tasks).toHaveLength(0);

    // List with ?status=archived should show the task
    const archivedRes = await request(app)
      .get('/api/v1/tasks?status=archived')
      .set('Cookie', user1Cookie);

    expect(archivedRes.body.data.tasks).toHaveLength(1);
    expect(archivedRes.body.data.tasks[0].id).toBe(user1TaskId);
  });

  it('POST /api/v1/tasks/:id/unarchive restores the task to active', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${user1TaskId}/unarchive`)
      .set('Cookie', user1Cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.task.status).toBe('active');
    expect(res.body.data.task.archivedAt).toBeNull();

    const listRes = await request(app)
      .get('/api/v1/tasks')
      .set('Cookie', user1Cookie);

    expect(listRes.body.data.tasks).toHaveLength(1);
  });
});

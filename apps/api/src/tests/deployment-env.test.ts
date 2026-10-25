import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { env } from '../config/env.js';

describe('Stage 10: Deployment & Production Readiness Tests', () => {
  describe('Health Check Endpoints', () => {
    it('GET /health returns healthy envelope with timestamps and database status', async () => {
      const res = await request(app).get('/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('success');
      expect(res.body.data).toHaveProperty('serverTimeUtc');
      expect(res.body.data).toHaveProperty('serverTimeAsiaKolkata');
      expect(res.body.data).toHaveProperty('database');
    });

    it('GET /api/v1/health matches contract structure', async () => {
      const res = await request(app).get('/api/v1/health');
      expect([200, 503]).toContain(res.status);
      expect(res.body.data.status).toBeDefined();
    });
  });

  describe('Cron & Snapshot Protection', () => {
    it('rejects unauthenticated requests to /api/v1/jobs/leaderboard-snapshot with 401', async () => {
      const res = await request(app).post('/api/v1/jobs/leaderboard-snapshot');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects query parameter secrets with 403 to prevent URL log leakage', async () => {
      const res = await request(app)
        .post(`/api/v1/jobs/leaderboard-snapshot?secret=${env.CRON_SECRET}`);
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toContain('query parameters is forbidden');
    });

    it('accepts valid secret via Authorization: Bearer <token>', async () => {
      const res = await request(app)
        .post('/api/v1/jobs/leaderboard-snapshot')
        .set('Authorization', `Bearer ${env.CRON_SECRET}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('results');
    });

    it('accepts valid secret via X-Cron-Secret header', async () => {
      const res = await request(app)
        .get('/api/v1/jobs/due-snapshots')
        .set('x-cron-secret', env.CRON_SECRET);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('results');
    });
  });

  describe('Environment Variable Configuration Invariants', () => {
    it('verifies APP_INVITE_CODE and INVITE_CODE are populated', () => {
      expect(env.APP_INVITE_CODE).toBeDefined();
      expect(env.INVITE_CODE).toBeDefined();
      expect(env.APP_INVITE_CODE).toBe(env.INVITE_CODE);
    });

    it('verifies CRON_SECRET and JOB_SECRET are populated', () => {
      expect(env.CRON_SECRET).toBeDefined();
      expect(env.JOB_SECRET).toBeDefined();
      expect(env.CRON_SECRET).toBe(env.JOB_SECRET);
    });

    it('verifies default port and client origin defaults', () => {
      expect(env.PORT).toBeGreaterThan(0);
      expect(env.CLIENT_ORIGIN).toBeDefined();
    });
  });
});

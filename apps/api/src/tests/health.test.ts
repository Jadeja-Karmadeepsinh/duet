import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Health API Check', () => {
  it('GET /api/v1/health returns valid envelope and server times', async () => {
    const res = await request(app).get('/api/v1/health');

    // Could be 200 (if DB reachable) or 503 (if DB offline/credentials pending in test environment)
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('serverTimeUtc');
    expect(res.body.data).toHaveProperty('serverTimeAsiaKolkata');
    expect(res.body.data).toHaveProperty('database');
  }, 15000);

  it('GET /api/v1/unknown-endpoint returns 404 in standard envelope', async () => {
    const res = await request(app).get('/api/v1/unknown-endpoint');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route does not exist.',
      },
    });
  });
});

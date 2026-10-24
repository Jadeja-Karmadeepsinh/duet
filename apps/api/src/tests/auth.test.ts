import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';
import { db, client } from '../db/index.js';
import { users, authSessions } from '../db/schema/index.js';
import {
  hashPin,
  verifyPin,
  normalizeDisplayName,
  generateSessionToken,
} from '../utils/crypto.js';
import { eq } from 'drizzle-orm';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

describe('Auth - Crypto & Name Normalization Unit Tests', () => {
  it('hashes PIN with scrypt and verifies correct PIN', async () => {
    const pin = '4829';
    const hash = await hashPin(pin);

    expect(hash.startsWith('scrypt$')).toBe(true);
    const isValid = await verifyPin(pin, hash);
    expect(isValid).toBe(true);

    const isInvalid = await verifyPin('1111', hash);
    expect(isInvalid).toBe(false);
  });

  it('rejects malformed hash strings gracefully without throwing', async () => {
    expect(await verifyPin('1234', 'invalid-hash')).toBe(false);
    expect(await verifyPin('1234', 'scrypt$bad')).toBe(false);
    expect(await verifyPin('1234', '')).toBe(false);
  });

  it('normalizes display names with Unicode NFKC, trimming, and lowercase folding', () => {
    expect(normalizeDisplayName('  Alex  ')).toBe('alex');
    expect(normalizeDisplayName('ALEX')).toBe('alex');
    // Unicode compatibility equivalence (e.g. ligature ﬁ -> fi)
    expect(normalizeDisplayName('  \uFB01nance  ')).toBe('finance');
    expect(normalizeDisplayName('')).toBe('');
  });

  it('generates random opaque session tokens and hashes them with sha256', () => {
    const { rawToken, tokenHash } = generateSessionToken();
    expect(rawToken).toHaveLength(64);
    expect(tokenHash).toHaveLength(64);
    expect(rawToken).not.toBe(tokenHash);
  });
});

describe('Auth API Integration Tests', () => {
  const testInviteCode = 'focus-team-2026';
  const testUserA = {
    displayName: 'TestUserA',
    pin: '1234',
    inviteCode: testInviteCode,
  };
  let userACookie: string;

  beforeAll(async () => {
    // Clean up test users if existing
    const normA = normalizeDisplayName(testUserA.displayName);
    const normB = normalizeDisplayName('TestUserB');
    await db.delete(users).where(eq(users.normalizedName, normA));
    await db.delete(users).where(eq(users.normalizedName, normB));
  });

  afterAll(async () => {
    const normA = normalizeDisplayName(testUserA.displayName);
    const normB = normalizeDisplayName('TestUserB');
    await db.delete(users).where(eq(users.normalizedName, normA));
    await db.delete(users).where(eq(users.normalizedName, normB));
  });

  it('POST /api/v1/auth/signup rejects invalid invite code with 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: 'Hacker',
        pin: '1234',
        inviteCode: 'wrong-invite-code',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/auth/signup registers a new profile and returns HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(testUserA);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.displayName).toBe('TestUserA');
    expect(res.body.data.user).toHaveProperty('id');

    // Extract cookie
    const cookiesHeader = res.headers['set-cookie'];
    const cookies = Array.isArray(cookiesHeader) ? cookiesHeader : [cookiesHeader as string];
    expect(cookies).toBeDefined();
    const sessionCookie = cookies.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).toContain('Path=/');

    userACookie = sessionCookie!.split(';')[0];
  });

  it('POST /api/v1/auth/signup rejects duplicate normalized display name with 409', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({
        displayName: '  testusera  ', // same after normalization
        pin: '9999',
        inviteCode: testInviteCode,
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('POST /api/v1/auth/signin rejects incorrect PIN with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        displayName: 'TestUserA',
        pin: 'wrong-pin',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/signin succeeds with valid PIN and sets cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signin')
      .send({
        displayName: 'TestUserA',
        pin: '1234',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.displayName).toBe('TestUserA');

    const cookiesHeader = res.headers['set-cookie'];
    const cookies = Array.isArray(cookiesHeader) ? cookiesHeader : [cookiesHeader as string];
    const sessionCookie = cookies.find((c: string) => c && c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
  });

  it('GET /api/v1/auth/me returns current authenticated user with valid cookie', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.displayName).toBe('TestUserA');
  });

  it('GET /api/v1/auth/me rejects request without cookie with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('POST /api/v1/auth/signout revokes session in DB and clears cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signout')
      .set('Cookie', userACookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // After signout, the cookie should no longer authenticate
    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', userACookie);

    expect(meRes.status).toBe(401);
  });
});

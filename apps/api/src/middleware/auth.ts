import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authSessions, users, type User } from '../db/schema/index.js';
import { hashSessionToken } from '../utils/crypto.js';
import { UnauthorizedError } from '../utils/errors.js';

export const SESSION_COOKIE_NAME = 'focus_session';
export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_MS,
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: User;
      sessionToken?: string;
    }
  }
}

/**
 * Reusable authentication middleware.
 * Verifies the HttpOnly session cookie (or Bearer header), checks expiration,
 * verifies active user status, and attaches authenticated user to req.user.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Extract raw token from cookie or Authorization header
    let rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (!rawToken && req.headers.authorization?.startsWith('Bearer ')) {
      rawToken = req.headers.authorization.substring(7).trim();
    }

    if (!rawToken) {
      throw new UnauthorizedError('Authentication required. Please sign in.');
    }

    // 2. Hash token for lookup (never search by raw token)
    const tokenHash = hashSessionToken(rawToken);

    // 3. Query session joined with user
    const [record] = await db
      .select({
        session: authSessions,
        user: users,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(eq(authSessions.tokenHash, tokenHash))
      .limit(1);

    if (!record) {
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
      throw new UnauthorizedError('Invalid session. Please sign in again.');
    }

    // 4. Verify expiration
    const now = new Date();
    if (record.session.expiresAt <= now) {
      // Clean up expired session in background
      db.delete(authSessions)
        .where(eq(authSessions.id, record.session.id))
        .catch(() => {});
      res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
      throw new UnauthorizedError('Session has expired. Please sign in again.');
    }

    // 5. Verify user is active
    if (!record.user.isActive) {
      throw new UnauthorizedError('User account is deactivated.');
    }

    // 6. Update lastSeenAt if > 5 minutes since last update (debounce writes)
    const lastSeen = record.session.lastSeenAt ? new Date(record.session.lastSeenAt).getTime() : 0;
    if (now.getTime() - lastSeen > 5 * 60 * 1000) {
      db.update(authSessions)
        .set({ lastSeenAt: now })
        .where(eq(authSessions.id, record.session.id))
        .catch(() => {});
    }

    // 7. Attach to request
    req.user = record.user;
    req.sessionToken = rawToken;
    next();
  } catch (err) {
    next(err);
  }
}

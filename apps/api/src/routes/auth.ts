import { Router, type Request, type Response } from 'express';
import { eq, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, authSessions } from '../db/schema/index.js';
import {
  hashPin,
  verifyPin,
  normalizeDisplayName,
  generateSessionToken,
  hashSessionToken,
} from '../utils/crypto.js';
import {
  ConflictError,
  ForbiddenError,
  UnauthorizedError,
  asyncHandler,
} from '../utils/errors.js';
import {
  requireAuth,
  SESSION_COOKIE_NAME,
  SESSION_DURATION_MS,
  getSessionCookieOptions,
} from '../middleware/auth.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { validateBody } from '../middleware/validate.js';
import { signupSchema, signinSchema, type SignupInput, type SigninInput } from '../schemas/auth.js';
import { env } from '../config/env.js';

export const authRouter = Router();

// Rate limiter for signup and login (15 attempts per 1 minute window)
const authLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please try again after 1 minute.',
});

/**
 * POST /api/v1/auth/signup
 * Register a new profile (max 4 active profiles, requires shared invite code).
 */
authRouter.post(
  '/signup',
  authLimiter,
  validateBody(signupSchema),
  asyncHandler(async (req: Request<{}, {}, SignupInput>, res: Response) => {
    const { displayName, pin, inviteCode } = req.body;

    // 1. Verify shared invite code
    const validInviteCode = process.env.APP_INVITE_CODE || env.INVITE_CODE;
    if (inviteCode !== validInviteCode) {
      throw new ForbiddenError('Invalid team invite code. Access is restricted.');
    }

    // 2. Enforce 4-profile system limit
    const [activeUsersCount] = await db
      .select({ val: count() })
      .from(users)
      .where(eq(users.isActive, true));

    if (Number(activeUsersCount?.val || 0) >= 4) {
      throw new ForbiddenError('Maximum profile limit reached (4 active profiles allowed).');
    }

    // 3. Normalize name and verify uniqueness
    const normalized = normalizeDisplayName(displayName);
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.normalizedName, normalized))
      .limit(1);

    if (existing) {
      throw new ConflictError('A profile with this display name already exists. Please sign in instead.');
    }

    // 4. Hash PIN securely using scrypt
    const pinHash = await hashPin(pin);

    // 5. Create user record
    const [newUser] = await db
      .insert(users)
      .values({
        displayName: displayName.trim(),
        normalizedName: normalized,
        pinHash,
        isActive: true,
      })
      .returning();

    // 6. Generate revocable session token and store hash
    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(authSessions).values({
      userId: newUser.id,
      tokenHash,
      expiresAt,
    });

    // 7. Send HttpOnly cookie
    res.cookie(SESSION_COOKIE_NAME, rawToken, getSessionCookieOptions());

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: newUser.id,
          displayName: newUser.displayName,
          createdAt: newUser.createdAt,
        },
      },
    });
  })
);

/**
 * POST /api/v1/auth/signin
 * Sign in with display name and PIN.
 */
authRouter.post(
  '/signin',
  authLimiter,
  validateBody(signinSchema),
  asyncHandler(async (req: Request<{}, {}, SigninInput>, res: Response) => {
    const { displayName, pin } = req.body;

    // 1. Look up user by normalized name
    const normalized = normalizeDisplayName(displayName);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.normalizedName, normalized))
      .limit(1);

    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid display name or PIN.');
    }

    // 2. Verify PIN using scrypt with timing-safe comparison
    const isPinValid = await verifyPin(pin, user.pinHash);
    if (!isPinValid) {
      throw new UnauthorizedError('Invalid display name or PIN.');
    }

    // 3. Create new revocable session
    const { rawToken, tokenHash } = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

    await db.insert(authSessions).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // 4. Set HttpOnly cookie
    res.cookie(SESSION_COOKIE_NAME, rawToken, getSessionCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          createdAt: user.createdAt,
        },
      },
    });
  })
);

/**
 * POST /api/v1/auth/signout
 * Revoke the current session and clear HttpOnly cookie.
 */
authRouter.post(
  '/signout',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.sessionToken) {
      const tokenHash = hashSessionToken(req.sessionToken);
      await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
    }

    res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());

    res.status(200).json({
      success: true,
      data: {
        message: 'Signed out successfully.',
      },
    });
  })
);

/**
 * GET /api/v1/auth/me
 * Retrieve the currently authenticated profile.
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    res.status(200).json({
      success: true,
      data: {
        user: {
          id: user.id,
          displayName: user.displayName,
          createdAt: user.createdAt,
        },
      },
    });
  })
);

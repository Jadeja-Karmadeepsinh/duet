import type { Request, Response, NextFunction } from 'express';
import { RateLimitError } from '../utils/errors.js';

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
}

/**
 * In-memory sliding-window rate limiter for sensitive authentication endpoints.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const { windowMs, max, message } = options;
  const requests = new Map<string, number[]>();

  // Cleanup old entries every 5 minutes
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of requests.entries()) {
      const valid = timestamps.filter((t) => now - t < windowMs);
      if (valid.length === 0) {
        requests.delete(key);
      } else {
        requests.set(key, valid);
      }
    }
  }, 5 * 60 * 1000).unref();

  return (req: Request, _res: Response, next: NextFunction) => {
    // In test environment, skip rate limiting to avoid flakiness
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
    const now = Date.now();
    const timestamps = (requests.get(ip) || []).filter((t) => now - t < windowMs);

    if (timestamps.length >= max) {
      throw new RateLimitError(message || 'Too many authentication attempts. Please try again later.');
    }

    timestamps.push(now);
    requests.set(ip, timestamps);
    next();
  };
}

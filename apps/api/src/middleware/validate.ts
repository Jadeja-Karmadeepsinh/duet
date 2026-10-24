import type { Request, Response, NextFunction } from 'express';
import { type ZodTypeAny } from 'zod';
import { ValidationError } from '../utils/errors.js';

export function validateBody(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError('Invalid request payload', result.error.format());
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError('Invalid query parameters', result.error.format());
    }
    // Express 5 defines req.query as a getter; assign to req.validatedQuery and object properties
    (req as any).validatedQuery = result.data;
    try {
      Object.assign(req.query, result.data);
    } catch {
      // Ignore if req.query is read-only
    }
    next();
  };
}

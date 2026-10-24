import { z } from 'zod';

export const startSessionSchema = z.object({
  taskId: z.string().uuid('A valid task ID is required to start a session'),
});

export const extendSessionSchema = z.object({
  extensionSeconds: z.union(
    [z.literal(900), z.literal(1800), z.literal(3600)],
    {
      errorMap: () => ({
        message: 'extensionSeconds must be 900 (15 min), 1800 (30 min), or 3600 (60 min)',
      }),
    }
  ),
});

export const listSessionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  taskId: z.string().uuid().optional(),
  status: z.enum(['running', 'paused', 'awaiting_decision', 'completed', 'stopped']).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type ExtendSessionInput = z.infer<typeof extendSessionSchema>;
export type ListSessionsQuery = z.infer<typeof listSessionsQuerySchema>;

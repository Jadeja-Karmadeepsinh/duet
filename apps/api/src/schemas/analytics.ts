import { z } from 'zod';

export const analyticsQuerySchema = z.object({
  range: z
    .enum(['7d', '30d', '90d', '1y', 'lifetime'])
    .default('7d'),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

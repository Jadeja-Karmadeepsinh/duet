import { z } from 'zod';

export const updatePreferencesSchema = z.object({
  dailyGoalSeconds: z
    .number({ required_error: 'dailyGoalSeconds is required' })
    .int('dailyGoalSeconds must be an integer')
    .min(60, 'dailyGoalSeconds must be at least 60 seconds (1 minute)')
    .max(86400, 'dailyGoalSeconds cannot exceed 86400 seconds (24 hours)'),
});

export const dayDetailsQuerySchema = z.object({
  date: z
    .string({ required_error: 'date query parameter is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
});

export const contributionsQuerySchema = z.object({
  weeks: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 26))
    .refine((val) => !isNaN(val) && val >= 1 && val <= 52, {
      message: 'weeks must be an integer between 1 and 52',
    }),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;
export type DayDetailsQuery = z.infer<typeof dayDetailsQuerySchema>;
export type ContributionsQuery = z.infer<typeof contributionsQuerySchema>;

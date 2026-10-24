import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters')
    .nullable()
    .optional(),
  plannedDurationSeconds: z
    .number()
    .int('Duration must be an integer in seconds')
    .positive('Duration must be positive (greater than 0)')
    .max(86400, 'Duration cannot exceed 24 hours (86,400 seconds)')
    .nullable()
    .optional(),
  category: z
    .string()
    .trim()
    .max(50, 'Category cannot exceed 50 characters')
    .nullable()
    .optional(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Title cannot be empty')
    .max(100, 'Title cannot exceed 100 characters')
    .optional(),
  description: z
    .string()
    .trim()
    .max(2000, 'Description cannot exceed 2000 characters')
    .nullable()
    .optional(),
  plannedDurationSeconds: z
    .number()
    .int('Duration must be an integer in seconds')
    .positive('Duration must be positive (greater than 0)')
    .max(86400, 'Duration cannot exceed 24 hours (86,400 seconds)')
    .nullable()
    .optional(),
  category: z
    .string()
    .trim()
    .max(50, 'Category cannot exceed 50 characters')
    .nullable()
    .optional(),
  status: z
    .enum(['active', 'archived'])
    .optional(),
});

export const listTasksQuerySchema = z.object({
  status: z
    .enum(['active', 'archived', 'all'])
    .default('active'),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;

import { z } from 'zod';

export const signupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(50, 'Display name cannot exceed 50 characters'),
  pin: z
    .string()
    .trim()
    .min(4, 'PIN must be at least 4 characters')
    .max(16, 'PIN cannot exceed 16 characters'),
  inviteCode: z
    .string()
    .trim()
    .min(1, 'Invite code is required'),
});

export const signinSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(50, 'Display name cannot exceed 50 characters'),
  pin: z
    .string()
    .trim()
    .min(1, 'PIN is required'),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type SigninInput = z.infer<typeof signinSchema>;

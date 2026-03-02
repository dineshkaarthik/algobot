import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  device_id: z.string().min(1),
  device_type: z.enum(['ios', 'android']).optional(),
});

export const refreshTokenSchema = z.object({
  refresh_token: z.string().min(1),
});

export const registerSchema = z.object({
  tenant_name: z.string().min(2).max(255),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .regex(/[A-Z]/, 'Must contain uppercase')
    .regex(/[0-9]/, 'Must contain number'),
  name: z.string().min(2).max(255),
  algonit_org_id: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

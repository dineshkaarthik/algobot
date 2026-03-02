import { z } from 'zod';

export const chatMessageSchema = z.object({
  conversation_id: z.string().uuid().nullable().optional(),
  message: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long (max 2000 chars)'),
  input_type: z.enum(['text', 'voice']).default('text'),
  audio_url: z.string().url().optional(),
  context: z
    .object({
      screen: z.string().optional(),
      selected_campaign_id: z.string().optional(),
    })
    .optional(),
});

export const confirmActionSchema = z.object({
  conversation_id: z.string().uuid(),
  confirmation_id: z.string().min(1),
  confirmed: z.boolean(),
});

export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type ConfirmActionInput = z.infer<typeof confirmActionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;

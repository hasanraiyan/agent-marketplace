import { z } from 'zod';

export const assistantIdParamSchema = z.object({
  assistantId: z.string().min(1),
});

export const conversationIdParamSchema = z.object({
  conversationId: z.string().min(1),
});

export const createConversationSchema = z.object({
  title: z.string().max(200).optional(),
});

export const listConversationsQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(8000),
});

export const listMessagesQuerySchema = z.object({
  page: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1))
    .optional(),
  limit: z
    .string()
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().min(1).max(200))
    .optional(),
});

// Shared validation schemas for edge functions
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Common schemas
export const emailSchema = z.string().email().max(255);
export const urlSchema = z.string().url().max(2000);
export const textContentSchema = z.string().min(1).max(10000);
export const shortTextSchema = z.string().min(1).max(500);
export const amountSchema = z.number().positive().max(1000000);

// Opportunity moderation schema
export const opportunityModerationSchema = z.object({
  title: z.string().min(5).max(200),
  description: z.string().min(10).max(5000),
  compensation: z.string().max(200).optional()
}).strict();

// Email notification schema
export const emailNotificationSchema = z.object({
  to: emailSchema,
  type: z.enum(['welcome', 'opportunity', 'match', 'application', 're-engagement', 'weekly-digest', 'activity-digest', 'streak-warning']),
  data: z.record(z.any()).optional()
}).strict();

// Content generation schema
export const contentGenerationSchema = z.object({
  prompt: z.string().min(1).max(2000)
}).strict();

// Image generation schema
export const imageGenerationSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  type: z.string().max(100)
}).strict();

// Payment schemas
export const paymentSchema = z.object({
  amount: amountSchema,
  currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
  description: shortTextSchema.optional()
}).strict();

// Partner submission schema
export const partnerSubmissionSchema = z.object({
  company_name: z.string().min(2).max(200),
  contact_name: z.string().min(2).max(200),
  contact_email: emailSchema,
  contact_phone: z.string().max(50).optional(),
  website_url: urlSchema.optional(),
  description: z.string().min(20).max(2000),
  category: z.string().min(2).max(100),
  discount_type: z.enum(['percentage', 'fixed', 'other']),
  discount_value: z.string().min(1).max(100),
  terms: z.string().max(1000).optional(),
  tier_required: z.enum(['free', 'creator_pro', 'thriver']).default('free')
}).strict();

// Validation helper
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
      };
    }
    return { success: false, error: 'Invalid input' };
  }
}

// Content size check middleware
export function checkContentLength(req: Request, maxBytes: number = 100000): { ok: true } | { ok: false; response: Response } {
  const contentLength = req.headers.get('content-length');
  if (contentLength && parseInt(contentLength) > maxBytes) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: 'Payload too large', maxBytes }),
        { status: 413, headers: { 'Content-Type': 'application/json' } }
      )
    };
  }
  return { ok: true };
}

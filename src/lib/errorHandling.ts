import { PostgrestError } from "@supabase/supabase-js";

export interface ValidationError {
  field: string;
  message: string;
}

export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const handleSupabaseError = (error: PostgrestError): AppError => {
  // Unique constraint violation
  if (error.code === '23505') {
    return new AppError(
      'This record already exists',
      'DUPLICATE_RECORD',
      409,
      error.details
    );
  }

  // Foreign key violation
  if (error.code === '23503') {
    return new AppError(
      'Referenced record does not exist',
      'INVALID_REFERENCE',
      400,
      error.details
    );
  }

  // Check constraint violation
  if (error.code === '23514') {
    return new AppError(
      'Invalid data provided',
      'VALIDATION_ERROR',
      400,
      error.details
    );
  }

  // Not null violation
  if (error.code === '23502') {
    return new AppError(
      'Required field is missing',
      'MISSING_FIELD',
      400,
      error.details
    );
  }

  // RLS policy violation
  if (error.code === '42501' || error.message.includes('row-level security')) {
    return new AppError(
      'You do not have permission to perform this action',
      'PERMISSION_DENIED',
      403,
      error.details
    );
  }

  // Default error
  return new AppError(
    error.message || 'An unexpected error occurred',
    'UNKNOWN_ERROR',
    500,
    error.details
  );
};

export const validateSwipeAction = (
  dailySwipes: number,
  subscriptionTier: string
): ValidationError[] => {
  const errors: ValidationError[] = [];
  const maxSwipes = subscriptionTier === 'free' ? 20 : 999;

  if (dailySwipes >= maxSwipes && subscriptionTier === 'free') {
    errors.push({
      field: 'swipes',
      message: 'Daily swipe limit reached. Upgrade to premium for unlimited swipes.',
    });
  }

  return errors;
};

export const validateMessage = (content: string): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!content || content.trim().length === 0) {
    errors.push({
      field: 'content',
      message: 'Message cannot be empty',
    });
  }

  if (content.length > 5000) {
    errors.push({
      field: 'content',
      message: 'Message is too long (max 5000 characters)',
    });
  }

  return errors;
};

export const validateApplication = (
  coverLetter: string,
  portfolioLinks?: string[]
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!coverLetter || coverLetter.trim().length === 0) {
    errors.push({
      field: 'coverLetter',
      message: 'Cover letter is required',
    });
  }

  if (coverLetter.length < 50) {
    errors.push({
      field: 'coverLetter',
      message: 'Cover letter must be at least 50 characters',
    });
  }

  if (coverLetter.length > 5000) {
    errors.push({
      field: 'coverLetter',
      message: 'Cover letter is too long (max 5000 characters)',
    });
  }

  if (portfolioLinks && portfolioLinks.length > 0) {
    const urlRegex = /^https?:\/\/.+/;
    portfolioLinks.forEach((link, index) => {
      if (link && !urlRegex.test(link)) {
        errors.push({
          field: `portfolioLink${index}`,
          message: 'Invalid URL format. Must start with http:// or https://',
        });
      }
    });
  }

  return errors;
};

export const validatePaymentAmount = (
  amount: number,
  type: 'credits' | 'balance'
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (amount <= 0) {
    errors.push({
      field: 'amount',
      message: 'Amount must be greater than 0',
    });
  }

  if (type === 'credits' && amount > 10000) {
    errors.push({
      field: 'amount',
      message: 'Maximum 10,000 credits per purchase',
    });
  }

  if (type === 'balance' && amount > 1000) {
    errors.push({
      field: 'amount',
      message: 'Maximum $1,000 per top-up',
    });
  }

  return errors;
};

export const sanitizeInput = (input: string): string => {
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .slice(0, 10000); // Hard limit on input length
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return url.startsWith('http://') || url.startsWith('https://');
  } catch {
    return false;
  }
};

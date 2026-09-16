import { z } from "zod";

// Email validation
export const emailSchema = z.string()
  .email("Invalid email address")
  .min(5, "Email must be at least 5 characters")
  .max(255, "Email must be less than 255 characters");

// Password validation
export const passwordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must be less than 100 characters");

// URL validation
export const urlSchema = z.string()
  .url("Invalid URL format")
  .max(500, "URL must be less than 500 characters")
  .or(z.literal(""));

// Social media URL validation
export const socialUrlSchema = z.string()
  .refine((val) => {
    if (!val) return true; // Empty is valid
    try {
      const url = new URL(val);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Invalid URL format")
  .or(z.literal(""));

// Text validation
export const nameSchema = z.string()
  .min(2, "Name must be at least 2 characters")
  .max(100, "Name must be less than 100 characters")
  .trim();

export const bioSchema = z.string()
  .max(1000, "Bio must be less than 1000 characters")
  .trim();

export const locationSchema = z.string()
  .max(200, "Location must be less than 200 characters")
  .trim();

// File validation
export const validateFileSize = (file: File, maxSizeMB: number = 10): boolean => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
};

export const validateFileType = (file: File, allowedTypes: string[]): boolean => {
  return allowedTypes.some(type => file.type.startsWith(type));
};

// Validation helpers
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  try {
    emailSchema.parse(email);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues[0].message };
    }
    return { valid: false, error: "Invalid email" };
  }
};

export const validatePassword = (password: string): { valid: boolean; error?: string } => {
  try {
    passwordSchema.parse(password);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues[0].message };
    }
    return { valid: false, error: "Invalid password" };
  }
};

export const validateUrl = (url: string): { valid: boolean; error?: string } => {
  if (!url) return { valid: true }; // Empty is valid
  try {
    socialUrlSchema.parse(url);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { valid: false, error: error.issues[0].message };
    }
    return { valid: false, error: "Invalid URL" };
  }
};

// Credit validation
export const validateCredits = (amount: number, balance: number): { valid: boolean; error?: string } => {
  if (amount < 0) {
    return { valid: false, error: "Amount cannot be negative" };
  }
  if (amount > balance) {
    return { valid: false, error: "Insufficient credits" };
  }
  return { valid: true };
};

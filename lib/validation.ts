/**
 * Validation utilities for authentication forms
 */

export type PasswordStrength = 'weak' | 'fair' | 'good' | 'strong';

export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-100
  feedback: string[];
}

/**
 * Validates email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Checks password strength and returns feedback
 */
export function getPasswordStrength(password: string): PasswordStrengthResult {
  const feedback: string[] = [];
  let score = 0;

  if (password.length === 0) {
    return { strength: 'weak', score: 0, feedback: [] };
  }

  // Length checks
  if (password.length >= 8) {
    score += 25;
  } else {
    feedback.push('At least 8 characters');
  }

  if (password.length >= 12) {
    score += 10;
  }

  // Character type checks
  if (/[a-z]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Lowercase letters');
  }

  if (/[A-Z]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Uppercase letters');
  }

  if (/[0-9]/.test(password)) {
    score += 15;
  } else {
    feedback.push('Numbers');
  }

  if (/[^a-zA-Z0-9]/.test(password)) {
    score += 20;
  } else {
    feedback.push('Special characters (!@#$%^&*)');
  }

  // Determine strength
  let strength: PasswordStrength;
  if (score < 40) {
    strength = 'weak';
  } else if (score < 60) {
    strength = 'fair';
  } else if (score < 80) {
    strength = 'good';
  } else {
    strength = 'strong';
  }

  return { strength, score, feedback };
}

/**
 * Validates password meets minimum requirements
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) {
    return { valid: false, error: 'Password must contain both uppercase and lowercase letters' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  return { valid: true };
}

/**
 * Gets user-friendly error message from Supabase auth errors
 */
export function getAuthErrorMessage(error: any): string {
  const errorMessage = error?.message || 'An unexpected error occurred';

  // Map common Supabase auth errors to user-friendly messages
  if (errorMessage.includes('already registered') || errorMessage.includes('User already registered')) {
    return 'This email is already registered. Try signing in instead.';
  }

  if (errorMessage.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please try again.';
  }

  if (errorMessage.includes('Email not confirmed')) {
    return 'Please check your email and confirm your account before signing in.';
  }

  if (errorMessage.includes('Password')) {
    if (errorMessage.includes('too short')) {
      return 'Password must be at least 8 characters';
    }
    return 'Password does not meet requirements';
  }

  if (errorMessage.includes('token') || errorMessage.includes('expired')) {
    return 'This reset link has expired. Please request a new one.';
  }

  if (errorMessage.includes('invalid')) {
    return 'Invalid request. Please try again.';
  }

  return errorMessage;
}

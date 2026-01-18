/**
 * Supabase Database Types
 *
 * This file should be regenerated using:
 * npx supabase gen types typescript --project-id <your-project-id> > types/supabase.ts
 *
 * For now, using placeholder types to allow builds to succeed.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: Record<string, unknown>;
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
    CompositeTypes: Record<string, unknown>;
  };
}

// ============================================================================
// Supabase client — بديل Firebase (ترحيل 2026-10-31)
// ----------------------------------------------------------------------------
// - الإعداد من متغيرات بيئة Vite: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
// - القيم الحقيقية في Vercel فقط، لا توجد قيم مضمّنة في الريبو
// ============================================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function readEnv(name: string): string | undefined {
  const metaEnv = (import.meta as unknown as {
    env?: Record<string, string | undefined>;
  }).env?.[name];
  if (metaEnv !== undefined) return metaEnv;
  return (
    globalThis as unknown as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process?.env?.[name];
}

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return !!(readEnv('VITE_SUPABASE_URL') && readEnv('VITE_SUPABASE_ANON_KEY'));
}

function requireConfigured(): void {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase غير مهيأ: اضبط VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY',
    );
  }
}

export function getSupabase(): SupabaseClient {
  requireConfigured();
  if (cached) return cached;
  cached = createClient(
    readEnv('VITE_SUPABASE_URL')!,
    readEnv('VITE_SUPABASE_ANON_KEY')!,
  );
  return cached;
}

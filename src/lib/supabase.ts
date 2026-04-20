// =====================================================
// Supabase Client Configuration
// =====================================================

import { createClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';

// Environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env file.'
  );
}

// =====================================================
// Browser Client (for client-side usage)
// =====================================================
export const supabaseBrowser = createBrowserClient<Database>(
  supabaseUrl,
  supabaseAnonKey
);

// =====================================================
// Realtime Helpers
// =====================================================

/**
 * Subscribe to messages for a user
 */
export function subscribeToMessages(
  userId: string,
  callback: (payload: unknown) => void
) {
  return supabaseBrowser
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'messages',
        filter: `receiver_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}

/**
 * Subscribe to project updates for a user
 */
export function subscribeToProjects(
  userId: string,
  callback: (payload: unknown) => void
) {
  return supabaseBrowser
    .channel('projects')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'projects',
        filter: `client_id=eq.${userId}`,
      },
      callback
    )
    .subscribe();
}

// =====================================================
// Storage Helpers
// =====================================================

/**
 * Upload file to Supabase Storage
 */
export async function uploadFile(
  bucket: string,
  path: string,
  file: File
) {
  const { data, error } = await supabaseBrowser.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) throw error;
  return data;
}

/**
 * Get public URL for file
 */
export function getPublicUrl(bucket: string, path: string) {
  const { data } = supabaseBrowser.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Delete file from storage
 */
export async function deleteFile(bucket: string, path: string) {
  const { error } = await supabaseBrowser.storage.from(bucket).remove([path]);
  if (error) throw error;
}

// =====================================================
// Error Handling
// =====================================================

/**
 * Handle Supabase errors consistently
 */
export function handleSupabaseError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

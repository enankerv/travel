/**
 * Supabase Client Setup
 * This will be used in your Next.js frontend
 *
 * Usage:
 * import { supabaseClient } from '@/lib/supabase'
 *
 * // Get current user
 * const { data: { user } } = await supabaseClient.auth.getUser()
 *
 * // Get user's villas (automatic RLS filtering)
 * const { data: villas } = await supabaseClient
 *   .from('villas')
 *   .select('*')
 *   .order('created_at', { ascending: false })
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Helper function to get the current session
 */
export async function getSession() {
  const {
    data: { session },
  } = await supabaseClient.auth.getSession();
  return session;
}

/**
 * Helper function to get the current user
 */
export async function getCurrentUser() {
  const {
    data: { user },
  } = await supabaseClient.auth.getUser();
  return user;
}

/**
 * Sign up with email and password
 */
export async function signUp(email: string, password: string) {
  return supabaseClient.auth.signUp({
    email,
    password,
  });
}

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string) {
  return supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
}

/**
 * Sign out
 */
export async function signOut() {
  return supabaseClient.auth.signOut();
}

/**
 * Fetch user's villas with RLS automatically applied
 */
export async function getUserVillas() {
  return supabaseClient
    .from("villas")
    .select("*")
    .order("created_at", { ascending: false });
}

/**
 * Get a specific villa by slug
 */
export async function getVillaBySlug(slug: string) {
  return supabaseClient.from("villas").select("*").eq("slug", slug).single();
}

/**
 * Update villa
 */
export async function updateVilla(id: string, updates: Record<string, any>) {
  return supabaseClient.from("villas").update(updates).eq("id", id).select();
}

/**
 * Delete villa
 */
export async function deleteVilla(id: string) {
  return supabaseClient.from("villas").delete().eq("id", id);
}

/**
 * Subscribe to real-time villa updates
 */
export function subscribeToVillas(callback: (payload: any) => void) {
  return supabaseClient
    .from("villas")
    .on("*", (payload) => {
      callback(payload);
    })
    .subscribe();
}


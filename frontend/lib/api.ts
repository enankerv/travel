import { supabase } from './supabase'

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

/** Resolve image URL - only full URLs (e.g. signed Supabase) work; storage paths need signing via API */
export function resolveImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // Legacy /images/ and raw storage paths (villa_id/filename) - not loadable without signed URL
  return ''
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

/** Get current user's profile (terms_accepted_at, age_verified_at, etc.) */
export async function getMyProfile(): Promise<{ terms_accepted_at: string | null; age_verified_at: string | null } | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('profiles').select('terms_accepted_at, age_verified_at').eq('id', user.id).single()
  return data
}

/** Record that user accepted Terms and Privacy Policy. For first-time users, pass age (must be 16+). */
export async function acceptTerms(age?: number): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (age !== undefined && age < 16) throw new Error('You must be at least 16 to use this service')
  const now = new Date().toISOString()
  const updates: Record<string, string> = {
    id: user.id,
    terms_accepted_at: now,
    updated_at: now,
  }
  if (age !== undefined && age >= 16) {
    updates.age_verified_at = now
  }
  const { error } = await supabase.from('profiles').upsert(updates, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

/** Check if user is on allowlist. Throws with code 'NOT_ON_ALLOWLIST' if blocked. */
export async function checkAccess(): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/check-access`, { headers })
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.detail || 'Access denied') as Error & { code?: string }
    err.code = body.code || 'NOT_ON_ALLOWLIST'
    throw err
  }
  if (!res.ok) throw new Error('Failed to check access')
}

// Lists
export async function createList(name: string, description?: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, description }),
  })
  if (!res.ok) throw new Error('Failed to create list')
  return res.json()
}

export async function getLists() {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists`, { headers })
  if (!res.ok) throw new Error('Failed to fetch lists')
  return res.json()
}

export async function getList(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch list')
  return res.json()
}

export async function updateList(listId: string, updates: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update list')
  return res.json()
}

export async function deleteList(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete list')
  return res.json()
}

// Getaways
export async function getVillas(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas`, { headers })
  if (!res.ok) throw new Error('Failed to fetch getaways')
  return res.json()
}

export async function updateVilla(listId: string, slug: string, updates: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas/${slug}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update getaway')
  return res.json()
}

export async function deleteVilla(listId: string, slug: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas/${slug}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete getaway')
  return res.json()
}

// Scout
export async function scoutUrl(url: string, listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/scout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url, list_id: listId }),
  })
  if (!res.ok) throw new Error('Scout failed')
  return res.json()
}

export async function scoutPaste(pasted_text: string, listId: string, original_url?: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/scout-paste`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pasted_text, list_id: listId, original_url }),
  })
  if (!res.ok) throw new Error('Scout paste failed')
  return res.json()
}

// Invites
export async function createInvite(listId: string, role: string = 'viewer') {
  const headers = await getAuthHeaders()
  const { data: { user } } = await supabase.auth.getUser()
  const res = await fetch(`${API_URL}/api/lists/${listId}/invites?created_by=${user?.id}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ role, expires_in_days: 30 }),
  })
  if (!res.ok) throw new Error('Failed to create invite')
  return res.json()
}

export async function getInviteDetails(token: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/invites/${token}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch invite')
  return res.json()
}

export async function acceptInvite(token: string) {
  const headers = await getAuthHeaders()
  const { data: { user } } = await supabase.auth.getUser()
  const res = await fetch(`${API_URL}/api/invites/${token}/accept?user_id=${user?.id}`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) throw new Error('Failed to accept invite')
  return res.json()
}

// Members
export async function getListMembers(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/members`, { headers })
  if (!res.ok) throw new Error('Failed to fetch members')
  return res.json()
}

export async function removeListMember(listId: string, userId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/members/${userId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to remove member')
  return res.json()
}

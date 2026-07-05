import { supabase } from './supabase'
import type { GetawayUpdate, POIBase } from './getaway'
import type { POICreate, POIUpdate } from './poi'
import type { BoardSnapshot } from './board'

function normalizeHttpUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `http://${url}`
}

export const API_URL = normalizeHttpUrl(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000')

/** Resolve image URL - only full URLs (e.g. signed Supabase) work; storage paths need signing via API */
export function resolveImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  // Legacy /images/ and raw storage paths (poi_id/filename) - not loadable without signed URL
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
export async function getGetaways(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/getaways`, { headers })
  if (!res.ok) throw new Error('Failed to fetch getaways')
  return res.json()
}

export async function updateGetaway(listId: string, poiId: string, updates: GetawayUpdate) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/getaways/${poiId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update getaway')
  return res.json()
}

export async function deleteGetaway(listId: string, poiId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/getaways/${poiId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete getaway')
  return res.json()
}

// POIs (spine — cork board pins, etc.)
export async function listPois(listId: string, poiType?: string): Promise<POIBase[]> {
  const headers = await getAuthHeaders()
  const qs = poiType ? `?poi_type=${encodeURIComponent(poiType)}` : ''
  const res = await fetch(`${API_URL}/api/lists/${listId}/pois${qs}`, { headers })
  if (!res.ok) throw new Error('Failed to fetch POIs')
  return res.json()
}

export async function getBoard(listId: string): Promise<BoardSnapshot> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/board`, { headers })
  if (!res.ok) throw new Error('Failed to fetch board')
  const data = await res.json()
  return {
    ...data,
    pois: (data.pois || []).map((p: BoardSnapshot['pois'][number]) => ({
      ...p,
      comments: p.comments ?? [],
      votes: p.votes ?? [],
    })),
  }
}

import type { BoardChatPoiSuggestion } from './boardChat'

export type { BoardChatMessage, BoardChatPoiSuggestion } from './boardChat'

export async function sendBoardChatMessage(
  listId: string,
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ reply: string; suggestions: BoardChatPoiSuggestion[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/board/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message,
      history: history.map(({ role, content }) => ({ role, content })),
    }),
  })
  if (!res.ok) {
    const msg = await scoutErrorFromResponse(res, 'Failed to send chat message')
    throw new ApiRequestError(msg, res.status)
  }
  const data = await res.json()
  return {
    reply: data.reply,
    suggestions: data.suggestions ?? [],
  }
}

export async function createPoi(listId: string, body: POICreate): Promise<POIBase> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/pois`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error('Failed to create POI')
  return res.json()
}

export async function updatePoi(
  listId: string,
  poiId: string,
  updates: POIUpdate,
): Promise<POIBase> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/pois/${poiId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update POI')
  const data = await res.json()
  return data.poi
}

export type PoiBoardPosition = {
  id: string
  board_x: number
  board_y: number
}

export async function bulkUpdatePoiPositions(
  listId: string,
  positions: PoiBoardPosition[],
): Promise<{ ok: boolean; updated: number }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/pois/positions`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ positions }),
  })
  if (!res.ok) throw new Error('Failed to save board layout')
  return res.json()
}

export async function deletePoi(listId: string, poiId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/pois/${poiId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete POI')
  return res.json()
}

export class ApiRequestError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

async function scoutErrorFromResponse(res: Response, fallback: string): Promise<string> {
  if (res.status === 429) {
    try {
      const data = await res.json()
      const detail = data?.detail
      if (typeof detail === 'string') return detail
    } catch {
      /* ignore parse error */
    }
    return 'Too many scout requests. Please wait a minute and try again.'
  }
  if (res.status === 402) {
    try {
      const data = await res.json()
      const detail = data?.detail
      if (typeof detail === 'string') return detail
    } catch {
      /* ignore parse error */
    }
    return "You're out of scout credits. Buy a pack to continue."
  }
  return fallback
}

// Scout
export async function scoutUrl(url: string, listId: string, poiId?: string) {
  const headers = await getAuthHeaders()
  const body: Record<string, unknown> = { url, list_id: listId }
  if (poiId) body.poi_id = poiId
  const res = await fetch(`${API_URL}/api/scout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await scoutErrorFromResponse(res, 'Scout failed')
    throw new Error(msg)
  }
  return res.json()
}

export async function scoutPaste(pasted_text: string, listId: string, original_url?: string, poiId?: string) {
  const headers = await getAuthHeaders()
  const body: Record<string, unknown> = { pasted_text, list_id: listId, original_url }
  if (poiId) body.poi_id = poiId
  const res = await fetch(`${API_URL}/api/scout-paste`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const msg = await scoutErrorFromResponse(res, 'Scout paste failed')
    throw new Error(msg)
  }
  return res.json()
}

export async function getScoutQuota(): Promise<{
  credits: number
  can_scout: boolean
}> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/scout-quota`, {
    headers,
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('Failed to fetch scout quota')
  return res.json()
}

export type ScoutPack = {
  id: string
  credits: number
  price_usd: number
  name: string
  description: string
}

export async function getScoutPacks(): Promise<{ packs: ScoutPack[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/scout-packs`, { headers })
  if (!res.ok) throw new Error('Failed to fetch scout packs')
  return res.json()
}

export async function createScoutCheckout(
  packId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ checkout_url: string; session_id: string }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/scout-packs/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ pack_id: packId, success_url: successUrl, cancel_url: cancelUrl }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to create checkout')
  }
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

/** List invite tokens for a list (admin). Used to show current link on Members page. */
export async function getListInvites(listId: string): Promise<{ invites: Array<{ token: string; is_active: boolean; expires_at?: string }> }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/invites`, { headers })
  if (!res.ok) throw new Error('Failed to fetch invites')
  return res.json()
}

/** Revoke an invite token (admin). After this, the link will no longer work. */
export async function revokeInvite(token: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/invites/${token}`, { method: 'DELETE', headers })
  if (!res.ok) throw new Error('Failed to revoke invite')
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

// Votes
export type VoteRecord = { poi_id: string; user_id: string; first_name?: string; avatar_url?: string }

export async function getListVotes(listId: string): Promise<{ votes: VoteRecord[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/votes`, { headers })
  if (!res.ok) throw new Error('Failed to fetch votes')
  return res.json()
}

export async function addVote(listId: string, getawayId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/getaways/${getawayId}/vote`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) throw new Error('Failed to add vote')
  return res.json()
}

export async function removeVote(listId: string, getawayId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/getaways/${getawayId}/vote`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to remove vote')
  return res.json()
}

// Comments (per getaway per list; list members read, owner can edit)
export type CommentRecord = {
  id: string
  poi_id: string
  user_id: string
  body: string
  created_at: string
  updated_at: string
  first_name?: string
  avatar_url?: string
}

export async function getListComments(listId: string): Promise<{ comments: CommentRecord[] }> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/comments`, { headers })
  if (!res.ok) throw new Error('Failed to fetch comments')
  return res.json()
}

export async function createComment(listId: string, getawayId: string, body: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/getaways/${getawayId}/comments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ body }),
  })
  if (!res.ok) throw new Error('Failed to add comment')
  return res.json()
}

export async function updateComment(listId: string, commentId: string, body: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/comments/${commentId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ body }),
  })
  if (!res.ok) throw new Error('Failed to update comment')
  return res.json()
}

export async function deleteComment(listId: string, commentId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/comments/${commentId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete comment')
  return res.json()
}

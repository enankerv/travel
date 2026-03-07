import { supabase } from './supabase'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  return {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
  }
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

// Villas
export async function getVillas(listId: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas`, { headers })
  if (!res.ok) throw new Error('Failed to fetch villas')
  return res.json()
}

export async function updateVilla(listId: string, slug: string, updates: any) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas/${slug}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(updates),
  })
  if (!res.ok) throw new Error('Failed to update villa')
  return res.json()
}

export async function deleteVilla(listId: string, slug: string) {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_URL}/api/lists/${listId}/villas/${slug}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) throw new Error('Failed to delete villa')
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

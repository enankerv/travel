import type { POICreate } from './poi'

export type BoardChatPoiSuggestion = {
  poi_type: 'activity' | 'restaurant' | 'flight' | 'poi'
  title: string
  description?: string | null
  location?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  source_url: string
  thumbnail_url?: string | null
}

export type BoardChatAssistantMessage = {
  role: 'assistant'
  content: string
  suggestions?: BoardChatPoiSuggestion[]
  savedSuggestionIndexes?: number[]
}

export type BoardChatUserMessage = {
  role: 'user'
  content: string
}

export type BoardChatMessage = BoardChatUserMessage | BoardChatAssistantMessage

export const BOARD_CHAT_POI_DRAG_MIME = 'application/x-getawaygather-poi-suggestion'

export function suggestionToPoiCreate(
  suggestion: BoardChatPoiSuggestion,
  board_x: number,
  board_y: number,
): POICreate {
  return {
    poi_type: suggestion.poi_type,
    title: suggestion.title,
    description: suggestion.description ?? undefined,
    location: suggestion.location ?? undefined,
    address: suggestion.address ?? undefined,
    lat: suggestion.lat ?? undefined,
    lng: suggestion.lng ?? undefined,
    source_url: suggestion.source_url ?? undefined,
    board_x,
    board_y,
  }
}

export function randomBoardDropPosition(): { board_x: number; board_y: number } {
  return {
    board_x: 0.42 + Math.random() * 0.16,
    board_y: 0.42 + Math.random() * 0.16,
  }
}

export function suggestionDragPayload(suggestion: BoardChatPoiSuggestion): string {
  return JSON.stringify(suggestion)
}

export function parseSuggestionDragPayload(raw: string): BoardChatPoiSuggestion | null {
  try {
    const data = JSON.parse(raw) as BoardChatPoiSuggestion
    if (!data?.title?.trim()) return null
    const url = data.source_url?.trim()
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) return null
    return { ...data, source_url: url }
  } catch {
    return null
  }
}

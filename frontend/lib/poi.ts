/** POI spine types for the cork board and generic pins. */
export type { POIBase, Getaway } from './getaway'

export type POICreate = {
  poi_type?: 'poi' | 'note' | 'activity' | 'restaurant' | 'flight'
  title?: string | null
  description?: string | null
  location?: string | null
  board_x?: number
  board_y?: number
  board_z?: number
}

export type POIUpdate = {
  title?: string | null
  description?: string | null
  location?: string | null
  board_x?: number
  board_y?: number
  board_z?: number
}

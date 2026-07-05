/** POI spine fields shared by every board pin. */
export type POIBase = {
  id: string
  list_id: string
  user_id?: string | null
  poi_type: string
  title?: string | null
  description?: string | null
  location?: string | null
  address?: string | null
  lat?: number | null
  lng?: number | null
  source_url?: string | null
  thumbnail_url?: string | null
  board_x?: number
  board_y?: number
  board_z?: number
  subgroup_id?: string | null
  images: string[]
  created_at: string
  updated_at: string
}

/** Accommodation subtype of POI (what the list UI shows today). */
export type Getaway = POIBase & {
  poi_type: 'getaway'
  import_status?: 'loading' | 'loaded' | 'thin' | 'error'
  import_error?: string | null
  region?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  max_guests?: number | null
  price?: number | null
  price_currency?: string | null
  price_period?: string | null
  price_note?: string | null
  deposit?: number | null
  amenities?: string[] | null
  included?: string[] | null
  caveats?: string | null
}

/** Fields the listing editor may PUT (matches backend Getaway.Update). */
export type GetawayUpdate = {
  title?: string | null
  location?: string | null
  region?: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  max_guests?: number | null
  price?: number | null
  price_currency?: string | null
  price_period?: string | null
  amenities?: string[] | null
  included?: string[] | null
  description?: string | null
  caveats?: string | null
}

// Address search + reverse geocoding via Photon (photon.komoot.io) — an
// OpenStreetMap-based geocoder that supports search-as-you-type, needs no
// API key, and allows CORS. Fair-use service: keep requests debounced and
// small (the composer debounces 350 ms, min 3 chars, 6 results).
// Data © OpenStreetMap contributors (already attributed on the map).

export interface Place {
  label: string
  lat: number
  lng: number
  type?: string
}

const PHOTON_BASE = 'https://photon.komoot.io'

interface PhotonFeature {
  properties: {
    name?: string
    street?: string
    housenumber?: string
    city?: string
    town?: string
    village?: string
    district?: string
    osm_value?: string
  }
  geometry: { coordinates: [number, number] }
}

function toPlace(f: PhotonFeature): Place | null {
  const p = f.properties
  const street = p.street ? `${p.street}${p.housenumber ? ' ' + p.housenumber : ''}` : undefined
  const locality = p.city ?? p.town ?? p.village ?? p.district
  const parts = [p.name, street, locality].filter(
    (part, i, arr): part is string => Boolean(part) && arr.indexOf(part) === i,
  )
  if (!parts.length || !f.geometry?.coordinates) return null
  const [lng, lat] = f.geometry.coordinates
  return { label: parts.slice(0, 3).join(', '), lat, lng, type: p.osm_value }
}

export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
  opts?: { limit?: number; signal?: AbortSignal },
): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 3) return []
  const params = new URLSearchParams({ q, limit: String(opts?.limit ?? 6) })
  if (near) {
    params.set('lat', near.lat.toFixed(4))
    params.set('lon', near.lng.toFixed(4))
  }
  const res = await fetch(`${PHOTON_BASE}/api/?${params}`, { signal: opts?.signal })
  if (!res.ok) throw new Error(`geocoding failed (${res.status})`)
  const data = (await res.json()) as { features?: PhotonFeature[] }
  return (data.features ?? []).map(toPlace).filter((p): p is Place => p !== null)
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lng) })
  const res = await fetch(`${PHOTON_BASE}/reverse?${params}`)
  if (!res.ok) return null
  const data = (await res.json()) as { features?: PhotonFeature[] }
  const first = data.features?.[0]
  return first ? toPlace(first) : null
}

import type { CreateEventPinInput, LocationSharing, MyProfile, NearbyProfile, Pin } from '../types'
import { getSupabase } from './supabase'

// Typed data layer over the SQL API defined in supabase/migrations/.
// Conventions:
//   - All geo reads/writes go through RPCs; the client never touches raw
//     geography columns (they aren't even selectable — see the migration).
//   - Row shapes are mapped snake_case → camelCase at this boundary; nothing
//     above this file knows Supabase exists.
//   - Every function throws BackendNotConfiguredError when the backend is
//     absent (import { isBackendConfigured } from './supabase' to guard).

export const DEFAULT_RADIUS_M = 5_000

function fail(op: string, message: string): never {
  throw new Error(`${op}: ${message}`)
}

// ─── auth-to-DB bridge (client half) ─────────────────────────────────────
// The DB trigger creates the profile row at signup; this refreshes mutable
// identity fields from the OAuth provider on every sign-in.
export async function upsertMyProfile(input: {
  id: string
  email?: string
  displayName: string
  avatarUrl?: string
}): Promise<void> {
  const { error } = await getSupabase().from('profiles').upsert(
    {
      id: input.id,
      email: input.email ?? null,
      display_name: input.displayName,
      avatar_url: input.avatarUrl ?? null,
    },
    { onConflict: 'id' },
  )
  if (error) fail('upsertMyProfile', error.message)
}

export async function getMyProfile(): Promise<MyProfile | null> {
  const { data, error } = await getSupabase().rpc('get_my_profile')
  if (error) fail('getMyProfile', error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return null
  return {
    id: row.id,
    email: row.email ?? undefined,
    displayName: row.display_name,
    avatarUrl: row.avatar_url ?? undefined,
    interests: row.interests ?? [],
    locationSharing: row.location_sharing as LocationSharing,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    locationUpdatedAt: row.location_updated_at ?? undefined,
  }
}

export async function setMyInterests(interests: string[]): Promise<void> {
  const uid = (await getSupabase().auth.getUser()).data.user?.id
  if (!uid) fail('setMyInterests', 'not authenticated')
  const { error } = await getSupabase().from('profiles').update({ interests }).eq('id', uid)
  if (error) fail('setMyInterests', error.message)
}

export async function setLocationSharing(tier: LocationSharing): Promise<void> {
  const uid = (await getSupabase().auth.getUser()).data.user?.id
  if (!uid) fail('setLocationSharing', 'not authenticated')
  const { error } = await getSupabase()
    .from('profiles')
    .update({ location_sharing: tier })
    .eq('id', uid)
  if (error) fail('setLocationSharing', error.message)
}

// ─── location & geospatial queries ───────────────────────────────────────

export async function updateLocation(lat: number, lng: number): Promise<void> {
  const { error } = await getSupabase().rpc('update_my_location', { lat, lng })
  if (error) fail('updateLocation', error.message)
}

/** "Show me everyone within `radiusM` of these coordinates." Results honor
 *  each member's privacy tier and a 2-hour freshness window (enforced in SQL). */
export async function getNearbyProfiles(
  lat: number,
  lng: number,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<NearbyProfile[]> {
  const { data, error } = await getSupabase().rpc('nearby_profiles', {
    origin_lat: lat,
    origin_lng: lng,
    radius_m: radiusM,
  })
  if (error) fail('getNearbyProfiles', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    avatarUrl: (r.avatar_url as string | null) ?? undefined,
    interests: (r.interests as string[]) ?? [],
    lat: r.lat as number,
    lng: r.lng as number,
    distanceM: r.distance_m as number,
    locationUpdatedAt: r.location_updated_at as string,
  }))
}

export async function getNearbyPins(
  lat: number,
  lng: number,
  radiusM: number = DEFAULT_RADIUS_M,
): Promise<Pin[]> {
  const { data, error } = await getSupabase().rpc('nearby_posts', {
    origin_lat: lat,
    origin_lng: lng,
    radius_m: radiusM,
  })
  if (error) fail('getNearbyPins', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    userId: r.user_id as string,
    authorName: r.author_name as string,
    authorAvatarUrl: (r.author_avatar_url as string | null) ?? undefined,
    title: r.title as string,
    category: r.category as string,
    startsAt: r.starts_at as string,
    durationMin: r.duration_min as number,
    description: (r.description as string | null) ?? undefined,
    venue: (r.venue as string | null) ?? undefined,
    lat: r.lat as number,
    lng: r.lng as number,
    distanceM: r.distance_m as number,
    createdAt: r.created_at as string,
  }))
}

export async function createEventPin(input: CreateEventPinInput): Promise<string> {
  const title = input.title.trim()
  if (!title) fail('createEventPin', 'title is empty')
  const { data, error } = await getSupabase().rpc('create_event_pin', {
    title,
    category: input.category,
    lat: input.lat,
    lng: input.lng,
    starts_at: new Date(Date.now() + input.startsInMin * 60_000).toISOString(),
    duration_min: input.durationMin,
    description: input.description?.trim() || null,
    venue: input.venue?.trim() || null,
  })
  if (error) fail('createEventPin', error.message)
  return data as string
}

// ─── realtime ────────────────────────────────────────────────────────────

/** Fires whenever any user creates a post (RLS-filtered server-side).
 *  The payload's geography column arrives as WKB, so callers should treat
 *  this as an invalidation signal and re-run getNearbyPins for their
 *  viewport. Returns an unsubscribe function. */
export function subscribeToPosts(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel('posts-feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => onChange())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => onChange())
    .subscribe()
  return () => {
    void channel.unsubscribe()
  }
}

/** Ephemeral live positions via Realtime Presence — the mechanism for
 *  member dots on the map (deliberately NOT postgres_changes on profiles;
 *  see the migration's realtime notes). Callers must pass coordinates
 *  already degraded to the user's own privacy tier. */
export interface PresencePeer {
  key: string
  name: string
  avatarUrl?: string
  lat: number
  lng: number
}

export function joinMapPresence(
  self: PresencePeer,
  onPeersChange: (peers: PresencePeer[]) => void,
): { updatePosition: (lat: number, lng: number) => void; leave: () => void } {
  const channel = getSupabase().channel('map-presence', {
    config: { presence: { key: self.key } },
  })

  const emit = () => {
    const state = channel.presenceState<PresencePeer>()
    const peers = Object.values(state)
      .flat()
      .filter((p) => p.key !== self.key)
    onPeersChange(peers)
  }

  channel
    .on('presence', { event: 'sync' }, emit)
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void channel.track(self)
    })

  return {
    updatePosition: (lat, lng) => {
      void channel.track({ ...self, lat, lng })
    },
    leave: () => {
      void channel.untrack()
      void channel.unsubscribe()
    },
  }
}

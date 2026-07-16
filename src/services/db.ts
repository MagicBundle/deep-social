import type {
  Attendee,
  BlockedUser,
  ConnectTarget,
  CreateEventPinInput,
  DirectMessage,
  FriendEntry,
  GuardianSession,
  GuardianStatus,
  HistoryEvent,
  FriendState,
  MyProfile,
  NearbyProfile,
  Pin,
  ProfileHit,
  VisibilityMode,
  Vibe,
} from '../types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabase } from './supabase'
import { notify } from './push'

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
    avatarEmoji: row.avatar_emoji ?? undefined,
    interests: row.interests ?? [],
    visibilityMode: row.visibility_mode as VisibilityMode,
    currentVibe: row.current_vibe ?? undefined,
    instagramHandle: row.instagram_handle ?? undefined,
    lat: row.lat ?? undefined,
    lng: row.lng ?? undefined,
    locationUpdatedAt: row.location_updated_at ?? undefined,
  }
}

/** Set (or clear) the transient "tonight's vibe" tag. Server reads treat it
 *  as expired after 3 hours. */
export async function setMyVibe(vibe: string | null): Promise<void> {
  const uid = (await getSupabase().auth.getUser()).data.user?.id
  if (!uid) fail('setMyVibe', 'not authenticated')
  const { error } = await getSupabase()
    .from('profiles')
    .update({ current_vibe: vibe, vibe_set_at: vibe ? new Date().toISOString() : null })
    .eq('id', uid)
  if (error) fail('setMyVibe', error.message)
}

export async function setMyInterests(interests: string[]): Promise<void> {
  const uid = (await getSupabase().auth.getUser()).data.user?.id
  if (!uid) fail('setMyInterests', 'not authenticated')
  const { error } = await getSupabase().from('profiles').update({ interests }).eq('id', uid)
  if (error) fail('setMyInterests', error.message)
}

export async function setVisibilityMode(mode: VisibilityMode): Promise<void> {
  const uid = (await getSupabase().auth.getUser()).data.user?.id
  if (!uid) fail('setVisibilityMode', 'not authenticated')
  const { error } = await getSupabase()
    .from('profiles')
    .update({ visibility_mode: mode })
    .eq('id', uid)
  if (error) fail('setVisibilityMode', error.message)
}

/** Resolve a single profile by id for the QR handshake Deep Card. Sharing a
 *  QR is explicit consent, so the full profile is shown regardless of mode. */
export async function getConnectTarget(userId: string): Promise<ConnectTarget | null> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('id, display_name, avatar_url, avatar_emoji, interests')
    .eq('id', userId)
    .maybeSingle()
  if (error) fail('getConnectTarget', error.message)
  if (!data) return null
  return {
    id: data.id as string,
    displayName: data.display_name as string,
    avatarUrl: (data.avatar_url as string | null) ?? undefined,
    avatarEmoji: (data.avatar_emoji as string | null) ?? undefined,
    interests: (data.interests as string[]) ?? [],
  }
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
    displayName: (r.display_name as string | null) ?? undefined,
    avatarUrl: (r.avatar_url as string | null) ?? undefined,
    avatarEmoji: (r.avatar_emoji as string | null) ?? undefined,
    interests: (r.interests as string[]) ?? [],
    vibe: (r.vibe as string | null) ?? undefined,
    identified: Boolean(r.identified),
    isFriend: Boolean(r.is_friend),
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
    attendeeCount: (r.attendee_count as number) ?? 0,
    joined: Boolean(r.joined),
    mediaCount: (r.media_count as number) ?? 0,
    lat: r.lat as number,
    lng: r.lng as number,
    distanceM: r.distance_m as number,
    createdAt: r.created_at as string,
  }))
}

// ─── members & friends ───────────────────────────────────────────────────

/** Search real registered members by display name. Server-side RPC so the
 *  block list applies (blocked users are invisible in both directions). */
export async function searchProfiles(query: string): Promise<ProfileHit[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const { data, error } = await getSupabase().rpc('search_members', { q })
  if (error) fail('searchProfiles', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    displayName: r.display_name as string,
    avatarUrl: (r.avatar_url as string | null) ?? undefined,
    avatarEmoji: (r.avatar_emoji as string | null) ?? undefined,
    interests: (r.interests as string[]) ?? [],
  }))
}

// ─── blocking & account deletion (App Store compliance) ──────────────────

export async function blockUser(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('block_user', { target: userId })
  if (error) fail('blockUser', error.message)
}

export async function unblockUser(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('unblock_user', { target: userId })
  if (error) fail('unblockUser', error.message)
}

export async function myBlocks(): Promise<BlockedUser[]> {
  const { data, error } = await getSupabase().rpc('my_blocks')
  if (error) fail('myBlocks', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    userId: r.user_id as string,
    displayName: r.display_name as string,
    avatarUrl: (r.avatar_url as string | null) ?? undefined,
    avatarEmoji: (r.avatar_emoji as string | null) ?? undefined,
    since: r.since as string,
  }))
}

/** Permanently deletes the account server-side (cascades through profile,
 *  pins, attendance, friendships, DMs, media rows, blocks). */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await getSupabase().rpc('delete_my_account')
  if (error) fail('deleteMyAccount', error.message)
}

/** Set (or clear with null) the caller's emoji avatar. */
export async function setMyAvatarEmoji(emoji: string | null): Promise<void> {
  const supabase = getSupabase()
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) fail('setMyAvatarEmoji', 'not authenticated')
  const { error } = await supabase.from('profiles').update({ avatar_emoji: emoji }).eq('id', uid)
  if (error) fail('setMyAvatarEmoji', error.message)
}

/** Set the user's freely-chosen display name (privacy: replaces the real
 *  name that OAuth handed over). Trimmed & clamped to the 40-char DB guard. */
export async function setMyDisplayName(name: string): Promise<void> {
  const supabase = getSupabase()
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) fail('setMyDisplayName', 'not authenticated')
  const clean = name.trim().slice(0, 40)
  if (!clean) fail('setMyDisplayName', 'name cannot be empty')
  const { error } = await supabase.from('profiles').update({ display_name: clean }).eq('id', uid)
  if (error) fail('setMyDisplayName', error.message)
}

/** Normalize a raw Instagram input to a bare handle (no @, no url), or null.
 *  Returns undefined if the text isn't a valid handle so callers can reject. */
export function normalizeInstagram(raw: string): string | null | undefined {
  let h = raw.trim()
  if (!h) return null // empty clears the handle
  // Accept a pasted profile URL or an @-prefixed handle.
  h = h.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '')
  h = h.replace(/^@+/, '').trim()
  return /^[A-Za-z0-9._]{1,30}$/.test(h) ? h : undefined
}

/** Set (or clear, with null) the user's Instagram handle. Friends-only. */
export async function setMyInstagram(handle: string | null): Promise<void> {
  const supabase = getSupabase()
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) fail('setMyInstagram', 'not authenticated')
  const { error } = await supabase.from('profiles').update({ instagram_handle: handle }).eq('id', uid)
  if (error) fail('setMyInstagram', error.message)
}

export async function getMyAvatarEmoji(): Promise<string | null> {
  const supabase = getSupabase()
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('avatar_emoji')
    .eq('id', uid)
    .maybeSingle()
  if (error) fail('getMyAvatarEmoji', error.message)
  return (data?.avatar_emoji as string | null) ?? null
}

/** Send a friend request; requesting someone who already requested you
 *  accepts instead. Returns the resulting relationship status. */
export async function requestFriend(userId: string): Promise<'pending' | 'accepted'> {
  const { data, error } = await getSupabase().rpc('request_friend', { target: userId })
  if (error) fail('requestFriend', error.message)
  return data as 'pending' | 'accepted'
}

export async function respondFriend(requesterId: string, accept: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('respond_friend', {
    requester: requesterId,
    accept,
  })
  if (error) fail('respondFriend', error.message)
}

export async function removeFriend(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('remove_friend', { target: userId })
  if (error) fail('removeFriend', error.message)
}

export async function myFriendships(): Promise<FriendEntry[]> {
  const { data, error } = await getSupabase().rpc('my_friendships')
  if (error) fail('myFriendships', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    userId: r.user_id as string,
    displayName: r.display_name as string,
    avatarUrl: (r.avatar_url as string | null) ?? undefined,
    avatarEmoji: (r.avatar_emoji as string | null) ?? undefined,
    interests: (r.interests as string[]) ?? [],
    state: r.state as FriendState,
    since: r.since as string,
    instagramHandle: (r.instagram_handle as string | null) ?? undefined,
  }))
}

/** Fires on any change to the caller's friendships (RLS-scoped). */
export function subscribeToFriendships(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`friendships-feed-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () =>
      onChange(),
    )
    .subscribe()
  return () => {
    void channel.unsubscribe()
  }
}

// ─── direct messages (friends only) ──────────────────────────────────────

export async function getConversation(friendId: string): Promise<DirectMessage[]> {
  const { data, error } = await getSupabase().rpc('conversation', { friend: friendId })
  if (error) fail('getConversation', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    senderId: r.sender_id as string,
    body: r.body as string,
    createdAt: r.created_at as string,
    mine: Boolean(r.mine),
  }))
}

export async function sendDm(friendId: string, body: string): Promise<string> {
  const text = body.trim()
  if (!text) fail('sendDm', 'empty message')
  const { data, error } = await getSupabase().rpc('send_dm', { recipient: friendId, body: text })
  if (error) fail('sendDm', error.message)
  notify(friendId, 'dm', text) // push the recipient (covers chat + guardian DMs)
  return data as string
}

export async function markDmRead(friendId: string): Promise<void> {
  const { error } = await getSupabase().rpc('mark_dm_read', { friend: friendId })
  if (error) console.warn('[dm] mark read failed:', error.message)
}

/** Map of friendId → unread message count. */
export async function dmUnreadCounts(): Promise<Record<string, number>> {
  const { data, error } = await getSupabase().rpc('dm_unread_counts')
  if (error) fail('dmUnreadCounts', error.message)
  const out: Record<string, number> = {}
  for (const r of data ?? []) out[r.friend_id as string] = r.unread as number
  return out
}

// ─── constellation & guardian mode ───────────────────────────────────────

/** The caller's own attendance history, past events included. */
export async function myEventHistory(): Promise<HistoryEvent[]> {
  const { data, error } = await getSupabase().rpc('my_event_history')
  if (error) fail('myEventHistory', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    title: r.title as string,
    category: r.category as string,
    venue: (r.venue as string | null) ?? undefined,
    authorName: (r.author_name as string | null) ?? undefined,
    startsAt: r.starts_at as string,
    durationMin: r.duration_min as number,
    lat: r.lat as number,
    lng: r.lng as number,
    joinedAt: r.joined_at as string,
  }))
}

/** Count of the caller's own vibe photos (Constellation stat). */
export async function myMediaCount(): Promise<number> {
  const supabase = getSupabase()
  const uid = (await supabase.auth.getUser()).data.user?.id
  if (!uid) return 0
  const { count, error } = await supabase
    .from('media_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', uid)
  if (error) fail('myMediaCount', error.message)
  return count ?? 0
}

export async function startGuardian(
  guardianId: string,
  minutes: number,
  note?: string,
): Promise<string> {
  const { data, error } = await getSupabase().rpc('start_guardian', {
    guardian: guardianId,
    minutes,
    note: note ?? null,
  })
  if (error) fail('startGuardian', error.message)
  return data as string
}

export async function endGuardian(sessionId: string, safe: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('end_guardian', { session_id: sessionId, safe })
  if (error) fail('endGuardian', error.message)
}

export async function myGuardianSessions(): Promise<GuardianSession[]> {
  const { data, error } = await getSupabase().rpc('my_guardian_sessions')
  if (error) fail('myGuardianSessions', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    role: r.role as 'protege' | 'guardian',
    otherId: r.other_id as string,
    otherName: r.other_name as string,
    otherAvatarUrl: (r.other_avatar_url as string | null) ?? undefined,
    otherAvatarEmoji: (r.other_avatar_emoji as string | null) ?? undefined,
    note: (r.note as string | null) ?? undefined,
    status: r.status as GuardianStatus,
    startedAt: r.started_at as string,
    endsAt: r.ends_at as string,
  }))
}

/** Fires on any change to the caller's guardian sessions (RLS-scoped). */
export function subscribeToGuardianSessions(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`guardian-feed-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'guardian_sessions' }, () =>
      onChange(),
    )
    .subscribe()
  return () => {
    void channel.unsubscribe()
  }
}

// ─── Hot Layer: heartbeats (increment 1) ─────────────────────────────────
// Ephemeral position/vibe events over a Broadcast channel — deliberately
// NOT postgres_changes (no DB write per heartbeat). Today nothing consumes
// them; the simulation engine (increment 2) subscribes to this stream.
// Privacy parity with nearby_profiles: callers must pass observer positions
// already grid-snapped (snapForObserver), and ghosts must not publish.

export interface Heartbeat {
  userId: string
  lat: number
  lng: number
  vibe: string | null
  visibility: 'observer' | 'beacon'
  at: string
}

/** ~500 m grid snap, matching the server's ST_SnapToGrid(…, 0.005). */
export function snapForObserver(v: number): number {
  return Math.round(v / 0.005) * 0.005
}

let hbChannel: ReturnType<SupabaseClient['channel']> | null = null
let hbReady = false

export function publishHeartbeat(hb: Omit<Heartbeat, 'at'>): void {
  const supabase = getSupabase()
  if (!hbChannel) {
    hbChannel = supabase.channel('hot-heartbeats')
    hbChannel.subscribe((status) => {
      hbReady = status === 'SUBSCRIBED'
    })
  }
  if (!hbReady) return // channel still joining; the next beat will land
  void hbChannel.send({
    type: 'broadcast',
    event: 'heartbeat',
    payload: { ...hb, at: new Date().toISOString() } satisfies Heartbeat,
  })
}

/** Fires on any DM the caller sends or receives (RLS-scoped). */
export function subscribeToDirectMessages(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`dm-feed-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_messages' }, () =>
      onChange(),
    )
    .subscribe()
  return () => {
    void channel.unsubscribe()
  }
}

// ─── attendance ──────────────────────────────────────────────────────────

/** Join a pin; returns the server's attendee count. Idempotent. */
export async function joinMeetup(postId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('join_meetup', { post_id: postId })
  if (error) fail('joinMeetup', error.message)
  return data as number
}

/** Who's going to a pin. The RPC applies the visibility ladder server-side:
 *  you, your friends and beacons come back named; observers and ghosts are
 *  anonymous with no userId (so they can't be looked up by name). */
export async function pinAttendees(postId: string): Promise<Attendee[]> {
  const { data, error } = await getSupabase().rpc('pin_attendees', { p_post: postId })
  if (error) fail('pinAttendees', error.message)
  return (data ?? []).map((r: Record<string, unknown>) => ({
    userId: (r.user_id as string | null) ?? undefined,
    displayName: (r.display_name as string | null) ?? undefined,
    avatarUrl: (r.avatar_url as string | null) ?? undefined,
    avatarEmoji: (r.avatar_emoji as string | null) ?? undefined,
    identified: Boolean(r.identified),
    isFriend: Boolean(r.is_friend),
  }))
}

export async function leaveMeetup(postId: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('leave_meetup', { post_id: postId })
  if (error) fail('leaveMeetup', error.message)
  return data as number
}

// ─── vibe checks (photos on pins) ────────────────────────────────────────

const VIBES_BUCKET = 'vibes'

export async function listVibes(postId: string): Promise<Vibe[]> {
  const supabase = getSupabase()
  const [{ data, error }, { data: userData }] = await Promise.all([
    supabase
      .from('media_attachments')
      .select('id, storage_path, user_id, created_at, profiles(display_name)')
      .eq('post_id', postId)
      .order('created_at', { ascending: false }),
    supabase.auth.getUser(),
  ])
  if (error) fail('listVibes', error.message)
  const myId = userData.user?.id
  return (data ?? []).map((r) => {
    const profile = r.profiles as { display_name?: string } | { display_name?: string }[] | null
    const authorName = Array.isArray(profile) ? profile[0]?.display_name : profile?.display_name
    return {
      id: r.id as string,
      url: supabase.storage.from(VIBES_BUCKET).getPublicUrl(r.storage_path as string).data
        .publicUrl,
      authorName,
      createdAt: r.created_at as string,
      mine: r.user_id === myId,
    }
  })
}

/** Upload a processed (canvas re-encoded) JPEG and attach it to a pin.
 *  RLS/storage policies enforce that only attendees can do this. */
export async function addVibe(postId: string, image: Blob): Promise<string> {
  const supabase = getSupabase()
  const path = `${postId}/${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await supabase.storage
    .from(VIBES_BUCKET)
    .upload(path, image, { contentType: 'image/jpeg', upsert: false })
  if (uploadError) fail('addVibe', uploadError.message)
  const { data, error } = await supabase.rpc('add_vibe_media', {
    post_id: postId,
    storage_path: path,
  })
  if (error) {
    // Don't strand an orphaned file if the row insert was rejected.
    void supabase.storage.from(VIBES_BUCKET).remove([path])
    fail('addVibe', error.message)
  }
  return data as string
}

export async function reportVibe(mediaId: string, reason?: string): Promise<void> {
  const { error } = await getSupabase().rpc('report_media', {
    media_id: mediaId,
    reason: reason ?? null,
  })
  if (error) fail('reportVibe', error.message)
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

/** Invalidation signal for the pins layer: fires on pin create/delete,
 *  attendee-count changes (posts UPDATE), and new vibe photos. Callers
 *  re-run getNearbyPins for their viewport. Returns an unsubscribe fn. */
export function subscribeToPosts(onChange: () => void): () => void {
  const channel = getSupabase()
    .channel(`posts-feed-${crypto.randomUUID()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => onChange())
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'posts' }, () => onChange())
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, () => onChange())
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'media_attachments' }, () =>
      onChange(),
    )
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

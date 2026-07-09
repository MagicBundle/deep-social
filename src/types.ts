export interface Interest {
  id: string
  label: string
  emoji: string
  color: string
}

export type MemberStatus = 'roaming' | 'heading' | 'at-event'

export interface Member {
  id: string
  name: string
  avatar: string
  interests: string[]
  lat: number
  lng: number
  heading: number
  speed: number
  status: MemberStatus
  planEventId?: string
  activity: string
}

export interface SocialEvent {
  id: string
  title: string
  venue: string
  category: string
  lat: number
  lng: number
  startsInMin: number
  durationMin: number
  description: string
  attendees: string[]
  /** true for user-created pins (local or synced from the backend) */
  isPin?: boolean
  authorName?: string
  /** server-side truth for remote pins; overrides attendees.length displays */
  attendeeCount?: number
  mediaCount?: number
}

export interface ChatMessage {
  id: string
  channelId: string
  authorName: string
  avatar: string
  text: string
  ts: number
  mine?: boolean
}

export type Provider = 'apple' | 'google' | 'facebook' | 'guest'

export interface Session {
  name: string
  provider: Provider
  avatar: string
  /** Supabase user id, present for real (backend) sessions — used for QR */
  id?: string
  email?: string
  picture?: string
  /** user-picked emoji avatar; takes precedence over the provider photo */
  avatarEmoji?: string
  /** true when the session came from real OAuth rather than the demo mock */
  real?: boolean
}

export interface World {
  members: Member[]
  events: SocialEvent[]
}

// ─── Data backbone (Supabase/PostGIS) ───────────────────────────────────

/** A member near a queried point, as returned by the nearby_profiles RPC.
 *  Coordinates and identity already reflect the member's visibility mode:
 *  `identified` false means an anonymous observer dot (name/avatar withheld,
 *  interests + fuzzed location only). */
export interface NearbyProfile {
  id: string
  displayName?: string
  avatarUrl?: string
  avatarEmoji?: string
  interests: string[]
  identified: boolean
  isFriend: boolean
  lat: number
  lng: number
  distanceM: number
  locationUpdatedAt: string
}

/** An event pin near a queried point, from the nearby_posts RPC. */
export interface Pin {
  id: string
  userId: string
  authorName: string
  authorAvatarUrl?: string
  title: string
  category: string
  startsAt: string
  durationMin: number
  description?: string
  venue?: string
  attendeeCount: number
  /** whether the current caller is an attendee (from the RPC) */
  joined: boolean
  mediaCount: number
  lat: number
  lng: number
  distanceM: number
  createdAt: string
}

/** A real registered member, as found by profile search. */
export interface ProfileHit {
  id: string
  displayName: string
  avatarUrl?: string
  avatarEmoji?: string
  interests: string[]
}

/** A direct message between two friends. */
export interface DirectMessage {
  id: string
  senderId: string
  body: string
  createdAt: string
  mine: boolean
}

export type FriendState = 'friend' | 'incoming' | 'outgoing'

export interface FriendEntry {
  userId: string
  displayName: string
  avatarUrl?: string
  avatarEmoji?: string
  interests: string[]
  state: FriendState
  since: string
}

/** A photo attached to an event pin. */
export interface Vibe {
  id: string
  url: string
  authorName?: string
  createdAt: string
  mine: boolean
}

export interface CreateEventPinInput {
  title: string
  category: string
  lat: number
  lng: number
  /** minutes from now; 0 = starts now */
  startsInMin: number
  durationMin: number
  description?: string
  venue?: string
}

/** Visibility to strangers: ghost = invisible, observer = anonymous dot,
 *  beacon = full profile. Accepted friends always see you regardless. */
export type VisibilityMode = 'ghost' | 'observer' | 'beacon'

/** The signed-in user's own profile row (includes private fields). */
export interface MyProfile {
  id: string
  email?: string
  displayName: string
  avatarUrl?: string
  avatarEmoji?: string
  interests: string[]
  visibilityMode: VisibilityMode
  lat?: number
  lng?: number
  locationUpdatedAt?: string
}

/** A profile resolved by id for the QR "Deep Card" (in-person handshake). */
export interface ConnectTarget {
  id: string
  displayName: string
  avatarUrl?: string
  avatarEmoji?: string
  interests: string[]
}

export interface MapFocus {
  lat: number
  lng: number
  zoom: number
  nonce: number
}

/** What the map renders: everything, only friends, or only events. */
export type MapLayer = 'both' | 'friends' | 'events'

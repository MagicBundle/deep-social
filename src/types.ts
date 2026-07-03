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
  email?: string
  picture?: string
  /** true when the session came from real OAuth rather than the demo mock */
  real?: boolean
}

export interface World {
  members: Member[]
  events: SocialEvent[]
}

// ─── Data backbone (Supabase/PostGIS) ───────────────────────────────────

/** A member near a queried point, as returned by the nearby_profiles RPC.
 *  Coordinates already reflect the member's privacy tier (precise/fuzzed). */
export interface NearbyProfile {
  id: string
  displayName: string
  avatarUrl?: string
  interests: string[]
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

export type LocationSharing = 'precise' | 'fuzzed' | 'off'

/** The signed-in user's own profile row (includes private fields). */
export interface MyProfile {
  id: string
  email?: string
  displayName: string
  avatarUrl?: string
  interests: string[]
  locationSharing: LocationSharing
  lat?: number
  lng?: number
  locationUpdatedAt?: string
}

export interface MapFocus {
  lat: number
  lng: number
  zoom: number
  nonce: number
}

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

export interface MapFocus {
  lat: number
  lng: number
  zoom: number
  nonce: number
}

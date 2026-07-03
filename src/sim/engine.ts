import { useEffect, useState } from 'react'
import type { Member, SocialEvent, World } from '../types'
import { EVENTS, MEMBERS } from '../data/mock'

// Stand-in for a realtime backend: every tick, simulated members wander the
// city or walk toward the event they plan to attend. In production this state
// would arrive over a WebSocket from opted-in location sharing.

const BBOX = { minLat: 48.832, maxLat: 48.892, minLng: 2.275, maxLng: 2.415 }
const TICK_MS = 1500
const ARRIVE_DIST = 0.0012

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

interface Arrival {
  memberId: string
  eventId: string
  eventTitle: string
}

function stepMember(m: Member, events: SocialEvent[], arrivals: Arrival[]): Member {
  if (m.status === 'at-event') {
    // Occasionally leave the event and wander off again
    if (Math.random() < 0.008) {
      return { ...m, status: 'roaming', planEventId: undefined, activity: 'exploring the city' }
    }
    return m
  }

  let heading = m.heading
  const target = m.planEventId ? events.find((e) => e.id === m.planEventId) : undefined

  if (target) {
    const dLat = target.lat - m.lat
    const dLng = target.lng - m.lng
    if (Math.hypot(dLat, dLng) < ARRIVE_DIST) {
      arrivals.push({ memberId: m.id, eventId: target.id, eventTitle: target.title })
      return {
        ...m,
        lat: target.lat + rnd(-2, 2) * 1e-4,
        lng: target.lng + rnd(-2, 2) * 1e-4,
        status: 'at-event',
        activity: `at ${target.title}`,
      }
    }
    heading = Math.atan2(dLat, dLng) + rnd(-0.2, 0.2)
  } else {
    heading += rnd(-0.6, 0.6)
  }

  let lat = m.lat + Math.sin(heading) * m.speed
  let lng = m.lng + Math.cos(heading) * m.speed
  if (lat < BBOX.minLat || lat > BBOX.maxLat) {
    heading = -heading
    lat = Math.min(Math.max(lat, BBOX.minLat), BBOX.maxLat)
  }
  if (lng < BBOX.minLng || lng > BBOX.maxLng) {
    heading = Math.PI - heading
    lng = Math.min(Math.max(lng, BBOX.minLng), BBOX.maxLng)
  }
  return { ...m, lat, lng, heading }
}

export function useSimulation(active: boolean): World {
  const [world, setWorld] = useState<World>({ members: MEMBERS, events: EVENTS })

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setWorld((w) => {
        const arrivals: Arrival[] = []
        const members = w.members.map((m) => stepMember(m, w.events, arrivals))
        let events = w.events
        if (arrivals.length) {
          events = w.events.map((e) => {
            const joining = arrivals
              .filter((a) => a.eventId === e.id && !e.attendees.includes(a.memberId))
              .map((a) => a.memberId)
            return joining.length ? { ...e, attendees: [...e.attendees, ...joining] } : e
          })
        }
        return { members, events }
      })
    }, TICK_MS)
    return () => clearInterval(id)
  }, [active])

  return world
}

export function timeLabel(e: SocialEvent): string {
  if (e.startsInMin <= 0) return 'LIVE'
  if (e.startsInMin < 60) return `in ${e.startsInMin} min`
  const h = Math.round(e.startsInMin / 60)
  return `in ${h} h`
}

export const isLive = (e: SocialEvent) => e.startsInMin <= 0

/** The Supabase row id behind a synced pin, or null for sim/local events. */
export const remotePinId = (eventId: string): string | null =>
  eventId.startsWith('pin-') ? eventId.slice(4) : null

/** Attendee count to display: server truth for synced pins, local math else. */
export const attendingCount = (e: SocialEvent, joinedByMe: boolean): number =>
  e.attendeeCount ?? e.attendees.length + (joinedByMe ? 1 : 0)

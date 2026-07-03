import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, MapFocus, Pin, Provider, Session, SocialEvent } from './types'
import {
  isBackendConfigured,
  loadSession,
  onBackendAuthChange,
  restoreBackendSession,
  saveSession,
  signOutEverywhere,
} from './auth'
import { CHAT_REPLIES, CHAT_SEEDS, CITY_CENTER } from './data/mock'
import { createEventPin, getNearbyPins, subscribeToPosts } from './services/db'
import { isLive, useSimulation } from './sim/engine'
import LoginScreen from './components/LoginScreen'
import TopBar, { type SearchResult } from './components/TopBar'
import SidePanel, { type PanelTab } from './components/SidePanel'
import MapView from './components/MapView'
import EventCard from './components/EventCard'
import ChatDrawer from './components/ChatDrawer'
import PinComposer, { type PinFormValues } from './components/PinComposer'

interface Toast {
  id: number
  text: string
}

const PROVIDER_NAME: Record<Provider, string> = {
  apple: 'Apple',
  google: 'Google',
  facebook: 'Meta',
  guest: 'guest mode',
}

let uid = 0
const nextId = () => ++uid

function pinToEvent(p: Pin): SocialEvent {
  return {
    id: `pin-${p.id}`,
    title: p.title,
    venue: p.venue ?? (p.authorName ? `Pinned by ${p.authorName}` : 'Community pin'),
    category: p.category,
    lat: p.lat,
    lng: p.lng,
    startsInMin: Math.round((new Date(p.startsAt).getTime() - Date.now()) / 60_000),
    durationMin: p.durationMin,
    description: p.description ?? '',
    attendees: [],
    isPin: true,
    authorName: p.authorName,
  }
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession())
  const world = useSimulation(session !== null)

  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<PanelTab>('events')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [chatEventId, setChatEventId] = useState<string | null>(null)
  const [joined, setJoined] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  // User-created event pins: synced from the backend for real sessions,
  // local-only in demo mode. Merged with sim events for every consumer.
  const [userPins, setUserPins] = useState<SocialEvent[]>([])
  const [pinMode, setPinMode] = useState(false)
  const [pinDraft, setPinDraft] = useState<{ lat: number; lng: number } | null>(null)

  const displayWorld = {
    members: world.members,
    events: [...userPins, ...world.events],
  }
  const worldRef = useRef(displayWorld)
  worldRef.current = displayWorld
  const backendLive = isBackendConfigured() && Boolean(session?.real)

  const toast = (text: string) => {
    const id = nextId()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }

  const flyTo = (lat: number, lng: number, zoom = 15) =>
    setFocus({ lat, lng, zoom, nonce: nextId() })

  const handleLogin = (newSession: Session) => {
    setSession(newSession)
    saveSession(newSession)
    toast(
      newSession.provider === 'guest'
        ? 'Exploring as guest — join an event to get started'
        : newSession.real
          ? `Signed in with ${PROVIDER_NAME[newSession.provider]} as ${newSession.name} ✓`
          : `Signed in with ${PROVIDER_NAME[newSession.provider]} ✓ (demo mode)`,
    )
  }

  const handleSignOut = () => {
    void signOutEverywhere()
    setSession(null)
  }

  // Backend session bootstrap: after the Supabase OAuth redirect (or on any
  // later visit while the Supabase session is valid), adopt it as the app
  // session. onBackendAuthChange also clears state on remote sign-out.
  useEffect(() => {
    if (!isBackendConfigured()) return
    restoreBackendSession()
      .then((s) => {
        if (s) setSession(s)
      })
      .catch((e) => console.warn('[auth] session restore failed:', e))
    return onBackendAuthChange((s) => setSession(s))
  }, [])

  // Shared pins: initial load around the demo city + realtime invalidation.
  // Requires a real session — the RPCs are authenticated-only by design.
  useEffect(() => {
    if (!backendLive) return
    let cancelled = false
    const refresh = () => {
      getNearbyPins(CITY_CENTER.lat, CITY_CENTER.lng, 15_000)
        .then((pins) => {
          if (cancelled) return
          setUserPins((prev) => {
            const remote = pins.map(pinToEvent)
            const remoteIds = new Set(remote.map((e) => e.id))
            const localOnly = prev.filter(
              (p) => p.id.startsWith('local-') && !remoteIds.has(p.id),
            )
            return [...remote, ...localOnly]
          })
        })
        .catch((e) => console.warn('[pins] fetch failed:', e))
    }
    refresh()
    const unsubscribe = subscribeToPosts(refresh)
    return () => {
      cancelled = true
      unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backendLive])

  // Esc exits pin-drop mode / closes the composer
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinMode(false)
        setPinDraft(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handlePickLocation = (lat: number, lng: number) => {
    setPinDraft({ lat, lng })
    setPinMode(false)
  }

  const handleCreatePin = async (values: PinFormValues) => {
    if (!pinDraft || !session) return
    const spot = pinDraft
    setPinDraft(null)
    let id = `local-${nextId()}`
    if (backendLive) {
      try {
        const remoteId = await createEventPin({
          title: values.title,
          category: values.category,
          lat: spot.lat,
          lng: spot.lng,
          startsInMin: values.startsInMin,
          durationMin: values.durationMin,
          description: values.description || undefined,
          venue: values.venue || undefined,
        })
        id = `pin-${remoteId}`
        toast('Pinned to the live map 🌍 — everyone nearby can see it')
      } catch (e) {
        console.warn('[pins] backend create failed:', e)
        toast('Could not sync the pin — kept locally (is migration 0002 applied?)')
      }
    } else {
      toast('Pinned! Local only in demo mode — Google sign-in publishes for real')
    }
    const event: SocialEvent = {
      id,
      title: values.title,
      venue: values.venue ?? `Pinned by ${session.name}`,
      category: values.category,
      lat: spot.lat,
      lng: spot.lng,
      startsInMin: values.startsInMin,
      durationMin: values.durationMin,
      description: values.description,
      attendees: [],
      isPin: true,
      authorName: session.name,
    }
    setUserPins((prev) => [event, ...prev.filter((p) => p.id !== id)])
    setJoined((prev) => new Set(prev).add(id))
    setSelectedEventId(id)
  }

  const selectEvent = (id: string) => {
    setSelectedEventId(id)
    const e = worldRef.current.events.find((ev) => ev.id === id)
    if (e) flyTo(e.lat, e.lng, 15)
  }

  const toggleFilter = (id: string) => {
    setFilters((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const seedChannel = (eventId: string) => {
    setMessages((prev) => {
      if (prev[eventId]?.length) return prev
      const event = worldRef.current.events.find((e) => e.id === eventId)
      if (!event) return prev
      const seeds = CHAT_SEEDS[event.category] ?? []
      const authors = event.attendees
        .map((id) => worldRef.current.members.find((m) => m.id === id))
        .filter((m): m is NonNullable<typeof m> => Boolean(m))
      const seeded: ChatMessage[] = seeds.slice(0, 3).map((text, i) => {
        const author = authors[i % Math.max(authors.length, 1)]
        return {
          id: `c${nextId()}`,
          channelId: eventId,
          authorName: author?.name ?? 'Organizer',
          avatar: author?.avatar ?? '📣',
          text,
          ts: Date.now() - (3 - i) * 60_000,
        }
      })
      return { ...prev, [eventId]: seeded }
    })
  }

  const openChat = (eventId: string) => {
    seedChannel(eventId)
    setChatEventId(eventId)
  }

  // Ambient chat: while a channel is open, attendees occasionally post.
  useEffect(() => {
    if (!chatEventId) return
    const id = setInterval(() => {
      if (Math.random() > 0.45) return
      const event = worldRef.current.events.find((e) => e.id === chatEventId)
      if (!event || !event.attendees.length) return
      const authorId = event.attendees[Math.floor(Math.random() * event.attendees.length)]
      const author = worldRef.current.members.find((m) => m.id === authorId)
      if (!author) return
      const pool = [...(CHAT_SEEDS[event.category] ?? []), ...CHAT_REPLIES]
      const text = pool[Math.floor(Math.random() * pool.length)]
      setMessages((prev) => ({
        ...prev,
        [chatEventId]: [
          ...(prev[chatEventId] ?? []),
          {
            id: `c${nextId()}`,
            channelId: chatEventId,
            authorName: author.name,
            avatar: author.avatar,
            text,
            ts: Date.now(),
          },
        ],
      }))
    }, 8000)
    return () => clearInterval(id)
  }, [chatEventId])

  const sendMessage = (text: string) => {
    if (!chatEventId || !session) return
    const channel = chatEventId
    setMessages((prev) => ({
      ...prev,
      [channel]: [
        ...(prev[channel] ?? []),
        {
          id: `c${nextId()}`,
          channelId: channel,
          authorName: session.name,
          avatar: session.avatar,
          text,
          ts: Date.now(),
          mine: true,
        },
      ],
    }))
    // Simulated reply, as if over the realtime channel
    setTimeout(() => {
      const event = worldRef.current.events.find((e) => e.id === channel)
      const authorId = event?.attendees[Math.floor(Math.random() * (event?.attendees.length || 1))]
      const author = worldRef.current.members.find((m) => m.id === authorId)
      setMessages((prev) => ({
        ...prev,
        [channel]: [
          ...(prev[channel] ?? []),
          {
            id: `c${nextId()}`,
            channelId: channel,
            authorName: author?.name ?? 'Organizer',
            avatar: author?.avatar ?? '📣',
            text: CHAT_REPLIES[Math.floor(Math.random() * CHAT_REPLIES.length)],
            ts: Date.now(),
          },
        ],
      }))
    }, 1200 + Math.random() * 2200)
  }

  const handleJoin = (eventId: string) => {
    if (joined.has(eventId)) {
      openChat(eventId)
      return
    }
    setJoined((prev) => new Set(prev).add(eventId))
    const e = worldRef.current.events.find((ev) => ev.id === eventId)
    toast(`You're in! ${e?.title ?? 'Meetup'} added to My meetups 🎉`)
    openChat(eventId)
  }

  const handleSearchPick = (r: SearchResult) => {
    if (r.kind === 'interest') {
      setFilters((prev) => new Set(prev).add(r.id))
      toast('Map filtered — tap the chip again to clear')
    } else if (r.kind === 'event') {
      selectEvent(r.id)
    } else {
      const m = worldRef.current.members.find((mm) => mm.id === r.id)
      if (m) flyTo(m.lat, m.lng, 15)
    }
  }

  if (!session) return <LoginScreen onLogin={handleLogin} />

  const selectedEvent = displayWorld.events.find((e) => e.id === selectedEventId) ?? null
  const chatEvent = displayWorld.events.find((e) => e.id === chatEventId) ?? null
  const liveCount = displayWorld.events.filter(isLive).length

  return (
    <div className={`app${chatEvent ? ' chat-open' : ''}`}>
      <MapView
        world={displayWorld}
        filters={filters}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
        focus={focus}
        pinMode={pinMode}
        draftPin={pinDraft}
        onPickLocation={handlePickLocation}
      />

      <TopBar
        session={session}
        world={displayWorld}
        liveCount={liveCount}
        onPick={handleSearchPick}
        onSignOut={handleSignOut}
      />

      <SidePanel
        world={displayWorld}
        filters={filters}
        onToggleFilter={toggleFilter}
        tab={tab}
        onTab={setTab}
        joined={joined}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
      />

      <button
        className={`fab-pin${pinMode ? ' cancel' : ''}`}
        onClick={() => {
          setPinMode((m) => !m)
          setPinDraft(null)
        }}
      >
        {pinMode ? '✕ Cancel' : '📍 Pin event'}
      </button>

      {pinMode && !pinDraft && (
        <div className="pin-hint">Click the map where your event happens · Esc to cancel</div>
      )}

      {pinDraft && session && (
        <PinComposer
          location={pinDraft}
          live={backendLive}
          onLocationChange={(lat, lng) => {
            setPinDraft({ lat, lng })
            flyTo(lat, lng, 15)
          }}
          onCreate={handleCreatePin}
          onCancel={() => setPinDraft(null)}
          onRepickOnMap={() => {
            setPinDraft(null)
            setPinMode(true)
          }}
        />
      )}

      {selectedEvent && (
        <EventCard
          event={selectedEvent}
          world={displayWorld}
          joined={joined.has(selectedEvent.id)}
          onJoin={() => handleJoin(selectedEvent.id)}
          onChat={() => openChat(selectedEvent.id)}
          onClose={() => setSelectedEventId(null)}
        />
      )}

      {chatEvent && (
        <ChatDrawer
          event={chatEvent}
          messages={messages[chatEvent.id] ?? []}
          attendeeCount={chatEvent.attendees.length + (joined.has(chatEvent.id) ? 1 : 0)}
          onSend={sendMessage}
          onClose={() => setChatEventId(null)}
        />
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

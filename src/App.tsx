import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, MapFocus, Provider, Session } from './types'
import { CHAT_REPLIES, CHAT_SEEDS } from './data/mock'
import { isLive, useSimulation } from './sim/engine'
import LoginScreen from './components/LoginScreen'
import TopBar, { type SearchResult } from './components/TopBar'
import SidePanel, { type PanelTab } from './components/SidePanel'
import MapView from './components/MapView'
import EventCard from './components/EventCard'
import ChatDrawer from './components/ChatDrawer'

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

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const world = useSimulation(session !== null)

  const [filters, setFilters] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<PanelTab>('events')
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [chatEventId, setChatEventId] = useState<string | null>(null)
  const [joined, setJoined] = useState<Set<string>>(new Set())
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [focus, setFocus] = useState<MapFocus | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const worldRef = useRef(world)
  worldRef.current = world

  const toast = (text: string) => {
    const id = nextId()
    setToasts((t) => [...t, { id, text }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }

  const flyTo = (lat: number, lng: number, zoom = 15) =>
    setFocus({ lat, lng, zoom, nonce: nextId() })

  const handleLogin = (provider: Provider) => {
    setSession({ name: 'Jérôme', provider, avatar: '😎' })
    toast(
      provider === 'guest'
        ? 'Exploring as guest — join an event to get started'
        : `Signed in with ${PROVIDER_NAME[provider]} ✓ (prototype mock)`,
    )
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

  const selectedEvent = world.events.find((e) => e.id === selectedEventId) ?? null
  const chatEvent = world.events.find((e) => e.id === chatEventId) ?? null
  const liveCount = world.events.filter(isLive).length

  return (
    <div className={`app${chatEvent ? ' chat-open' : ''}`}>
      <MapView
        world={world}
        filters={filters}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
        focus={focus}
      />

      <TopBar
        session={session}
        world={world}
        liveCount={liveCount}
        onPick={handleSearchPick}
        onSignOut={() => setSession(null)}
      />

      <SidePanel
        world={world}
        filters={filters}
        onToggleFilter={toggleFilter}
        tab={tab}
        onTab={setTab}
        joined={joined}
        selectedEventId={selectedEventId}
        onSelectEvent={selectEvent}
      />

      {selectedEvent && (
        <EventCard
          event={selectedEvent}
          world={world}
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

import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProfileHit, Session, World } from '../types'
import { INTERESTS, INTEREST_BY_ID, interestFor } from '../data/mock'
import { timeLabel } from '../sim/engine'
import { searchProfiles } from '../services/db'

export interface SearchResult {
  kind: 'event' | 'member' | 'interest'
  id: string
  emoji: string
  label: string
  sub: string
  color: string
}

interface Props {
  session: Session
  world: World
  liveCount: number
  backendLive: boolean
  onPick: (r: SearchResult) => void
  onAddFriend: (profile: ProfileHit) => void
  onSignOut: () => void
}

const PROVIDER_BADGE: Record<string, string> = {
  apple: ' Apple',
  google: 'G Google',
  facebook: '∞ Meta',
  guest: '👤 Guest',
}

export default function TopBar({
  session,
  world,
  liveCount,
  backendLive,
  onPick,
  onAddFriend,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Real registered members, searched in the database (the local results
  // below only cover the simulated demo world).
  const [members, setMembers] = useState<ProfileHit[]>([])
  useEffect(() => {
    if (!backendLive || query.trim().length < 2) {
      setMembers([])
      return
    }
    const t = setTimeout(() => {
      searchProfiles(query)
        .then(setMembers)
        .catch((e) => console.warn('[search] profile search failed:', e))
    }, 300)
    return () => clearTimeout(t)
  }, [query, backendLive])

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const out: SearchResult[] = []
    for (const i of INTERESTS) {
      if (i.label.toLowerCase().includes(q)) {
        out.push({ kind: 'interest', id: i.id, emoji: i.emoji, label: i.label, sub: 'Interest — tap to filter the map', color: i.color })
      }
    }
    for (const e of world.events) {
      const interest = interestFor(e.category)
      if (`${e.title} ${e.venue} ${interest.label}`.toLowerCase().includes(q)) {
        out.push({
          kind: 'event',
          id: e.id,
          emoji: interest.emoji,
          label: e.title,
          sub: `${e.venue} · ${timeLabel(e)} · ${e.attendees.length} going`,
          color: interest.color,
        })
      }
    }
    for (const m of world.members) {
      const interestLabels = m.interests.map((i) => INTEREST_BY_ID[i].label).join(' ')
      if (`${m.name} ${interestLabels}`.toLowerCase().includes(q)) {
        out.push({
          kind: 'member',
          id: m.id,
          emoji: m.avatar,
          label: m.name,
          sub: m.activity,
          color: INTEREST_BY_ID[m.interests[0]].color,
        })
      }
    }
    return out.slice(0, 8)
  }, [query, world])

  const pick = (r: SearchResult) => {
    onPick(r)
    setQuery('')
    inputRef.current?.blur()
  }

  return (
    <header className="topbar">
      <div className="brand">
        <div className="logo-mark small">◍</div>
        <span className="brand-name">
          Deep<span>Social</span>
        </span>
      </div>

      <div className="search-wrap">
        <span className="search-icon">⌕</span>
        <input
          ref={inputRef}
          value={query}
          placeholder="Search events, people, interests…"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && results.length) pick(results[0])
            if (e.key === 'Escape') setQuery('')
          }}
        />
        {(results.length > 0 || members.length > 0) && (
          <div className="search-results">
            {members.length > 0 && <div className="sr-section">Members</div>}
            {members.map((m) => (
              <button
                key={`profile-${m.id}`}
                className="search-result"
                onClick={() => {
                  onAddFriend(m)
                  setQuery('')
                  inputRef.current?.blur()
                }}
              >
                <span className="sr-emoji sr-avatar">
                  {m.avatarUrl ? <img src={m.avatarUrl} alt="" referrerPolicy="no-referrer" /> : '👤'}
                </span>
                <span className="sr-text">
                  <strong>{m.displayName}</strong>
                  <small>
                    {m.interests.length
                      ? m.interests.map((i) => INTEREST_BY_ID[i]?.label ?? i).join(', ')
                      : 'Deep Social member'}
                  </small>
                </span>
                <span className="sr-kind add">+ add</span>
              </button>
            ))}
            {results.length > 0 && members.length > 0 && (
              <div className="sr-section">On the map</div>
            )}
            {results.map((r) => (
              <button key={`${r.kind}-${r.id}`} className="search-result" onClick={() => pick(r)}>
                <span className="sr-emoji" style={{ background: `${r.color}22`, borderColor: r.color }}>
                  {r.emoji}
                </span>
                <span className="sr-text">
                  <strong>{r.label}</strong>
                  <small>{r.sub}</small>
                </span>
                <span className="sr-kind">{r.kind}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="topbar-right">
        <div className="live-indicator">
          <span className="live-dot" />
          {liveCount} live now
        </div>
        <div className="avatar-menu">
          <button className="avatar-btn" onClick={() => setMenuOpen((o) => !o)}>
            {session.picture ? <img src={session.picture} alt={session.name} referrerPolicy="no-referrer" /> : session.avatar}
          </button>
          {menuOpen && (
            <div className="avatar-dropdown">
              <div className="avatar-row">
                <strong>{session.name}</strong>
                {session.email && <small>{session.email}</small>}
                <small>via {PROVIDER_BADGE[session.provider]}{session.real ? '' : ' (demo)'}</small>
              </div>
              <button onClick={onSignOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

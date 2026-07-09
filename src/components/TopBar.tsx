import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProfileHit, Session, VisibilityMode, World } from '../types'
import type { PanelTab } from './SidePanel'
import { AVATAR_EMOJIS, INTERESTS, INTEREST_BY_ID, interestFor } from '../data/mock'
import { timeLabel } from '../sim/engine'
import { searchProfiles } from '../services/db'

const VISIBILITY_OPTIONS: { mode: VisibilityMode; emoji: string; label: string; desc: string }[] = [
  { mode: 'ghost', emoji: '👻', label: 'Ghost', desc: 'Invisible to strangers on the map' },
  { mode: 'observer', emoji: '🔭', label: 'Observer', desc: 'Anonymous dot — interests only, no name' },
  { mode: 'beacon', emoji: '📡', label: 'Beacon', desc: 'Full profile visible to people nearby' },
]

export interface MenuStats {
  friendCount: number
  requestCount: number
  unreadDms: number
  meetupCount: number
  nextEventLabel: string | null
}

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
  stats: MenuStats
  visibilityMode: VisibilityMode
  myVibe: string | null
  onPick: (r: SearchResult) => void
  onAddFriend: (profile: ProfileHit) => void
  onNavigateTab: (tab: PanelTab) => void
  onPickAvatar: (emoji: string | null) => void
  onSetVisibility: (mode: VisibilityMode) => void
  onSetVibe: (vibe: string | null) => void
  onSharePresence: () => void
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
  stats,
  visibilityMode,
  myVibe,
  onPick,
  onAddFriend,
  onNavigateTab,
  onPickAvatar,
  onSetVisibility,
  onSetVibe,
  onSharePresence,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [vibeOpen, setVibeOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const backendUser = Boolean(session.real && session.id)

  const goTab = (tab: PanelTab) => {
    setMenuOpen(false)
    setAvatarPickerOpen(false)
    onNavigateTab(tab)
  }

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
                  {m.avatarEmoji ??
                    (m.avatarUrl ? <img src={m.avatarUrl} alt="" referrerPolicy="no-referrer" /> : '👤')}
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
            {session.avatarEmoji ? (
              session.avatarEmoji
            ) : session.picture ? (
              <img src={session.picture} alt={session.name} referrerPolicy="no-referrer" />
            ) : (
              session.avatar
            )}
          </button>
          {menuOpen && (
            <div className="avatar-dropdown">
              <div className="avatar-row">
                <strong>{session.name}</strong>
                {session.email && <small>{session.email}</small>}
                <small>via {PROVIDER_BADGE[session.provider]}{session.real ? '' : ' (demo)'}</small>
              </div>

              <button className="menu-row" onClick={() => goTab('friends')}>
                <span>👥 Friends</span>
                <small>
                  {stats.friendCount}
                  {stats.requestCount > 0 && (
                    <em className="menu-alert"> · {stats.requestCount} request{stats.requestCount > 1 ? 's' : ''}!</em>
                  )}
                  {stats.unreadDms > 0 && (
                    <em className="menu-alert"> · {stats.unreadDms} 💬</em>
                  )}
                </small>
              </button>

              <button className="menu-row" onClick={() => goTab('mine')}>
                <span>📅 My meetups</span>
                <small>
                  {stats.meetupCount}
                  {stats.nextEventLabel ? ` · next: ${stats.nextEventLabel}` : ''}
                </small>
              </button>

              <button className="menu-row" onClick={() => setAvatarPickerOpen((o) => !o)}>
                <span>🎭 Avatar</span>
                <small>{session.avatarEmoji ?? (session.picture ? 'your photo' : session.avatar)} · change</small>
              </button>

              {avatarPickerOpen && (
                <div className="avatar-grid">
                  {AVATAR_EMOJIS.map((e) => (
                    <button
                      key={e}
                      className={session.avatarEmoji === e ? 'active' : ''}
                      onClick={() => onPickAvatar(e)}
                    >
                      {e}
                    </button>
                  ))}
                  {session.picture && session.avatarEmoji && (
                    <button className="avatar-reset" onClick={() => onPickAvatar(null)}>
                      Use my photo instead
                    </button>
                  )}
                </div>
              )}

              {backendUser && (
                <>
                  <button className="menu-row" onClick={() => setVibeOpen((o) => !o)}>
                    <span>⚡ Tonight's vibe</span>
                    <small>
                      {myVibe
                        ? `${interestFor(myVibe).emoji} ${interestFor(myVibe).label} · fades in 3 h`
                        : 'not set · tell people what you’re up for'}
                    </small>
                  </button>

                  {vibeOpen && (
                    <div className="vibe-grid">
                      {INTERESTS.map((i) => (
                        <button
                          key={i.id}
                          className={`chip${myVibe === i.id ? ' active' : ''}`}
                          style={{ ['--c' as string]: i.color }}
                          onClick={() => onSetVibe(myVibe === i.id ? null : i.id)}
                        >
                          {i.emoji} {i.label}
                        </button>
                      ))}
                      {myVibe && (
                        <button className="vibe-clear" onClick={() => onSetVibe(null)}>
                          Clear vibe
                        </button>
                      )}
                    </div>
                  )}

                  <button className="menu-row" onClick={() => setVisibilityOpen((o) => !o)}>
                    <span>🔭 Privacy &amp; visibility</span>
                    <small>
                      {VISIBILITY_OPTIONS.find((v) => v.mode === visibilityMode)?.label ?? 'Ghost'} ·
                      change
                    </small>
                  </button>

                  {visibilityOpen && (
                    <div className="visibility-grid">
                      {VISIBILITY_OPTIONS.map((v) => (
                        <button
                          key={v.mode}
                          className={`visibility-opt${visibilityMode === v.mode ? ' active' : ''}`}
                          onClick={() => onSetVisibility(v.mode)}
                        >
                          <span className="vis-emoji">{v.emoji}</span>
                          <span className="vis-text">
                            <strong>{v.label}</strong>
                            <small>{v.desc}</small>
                          </span>
                          {visibilityMode === v.mode && <span className="vis-check">✓</span>}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    className="menu-row"
                    onClick={() => {
                      setMenuOpen(false)
                      onSharePresence()
                    }}
                  >
                    <span>📡 Share my presence</span>
                    <small>Show a QR to connect in person</small>
                  </button>
                </>
              )}

              <button onClick={onSignOut}>Sign out</button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

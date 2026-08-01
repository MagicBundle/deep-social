import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ProfileHit, Session, VisibilityMode, World } from '../types'
import type { PanelTab } from './SidePanel'
import { AVATAR_EMOJIS, INTERESTS, INTEREST_BY_ID, interestFor } from '../data/mock'
import { timeLabel } from '../sim/engine'
import { searchProfiles, normalizeInstagram } from '../services/db'

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
  onLogoHome: () => void
  onInvite: () => void
  onPickAvatar: (emoji: string | null) => void
  onSetName: (name: string) => void
  instagramHandle?: string
  onSetInstagram: (handle: string | null) => void
  myInterests: string[]
  onOpenInterests: () => void
  onSetVisibility: (mode: VisibilityMode) => void
  onSetVibe: (vibe: string | null) => void
  onSharePresence: () => void
  onOpenConstellation: () => void
  onOpenGuardian: () => void
  onOpenBlocked: () => void
  onDeleteAccount: () => void
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
  onLogoHome,
  onInvite,
  onPickAvatar,
  onSetName,
  instagramHandle,
  onSetInstagram,
  myInterests,
  onOpenInterests,
  onSetVisibility,
  onSetVibe,
  onSharePresence,
  onOpenConstellation,
  onOpenGuardian,
  onOpenBlocked,
  onDeleteAccount,
  onSignOut,
}: Props) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [visibilityOpen, setVisibilityOpen] = useState(false)
  const [vibeOpen, setVibeOpen] = useState(false)
  const [nameOpen, setNameOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [igOpen, setIgOpen] = useState(false)
  const [igDraft, setIgDraft] = useState('')
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
          sub: `${m.activity} · demo member`,
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
      <button
        className="brand"
        onClick={onLogoHome}
        title="Back to you, back to now"
        aria-label="Reset the map: center on you, clear filters, back to now"
      >
        <div className="logo-mark small">◍</div>
        <span className="brand-name">
          Deep<span>Social</span>
        </span>
      </button>

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
                <span className="sr-kind">{r.kind === 'member' ? 'demo' : r.kind}</span>
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

          {createPortal(
            <>
          {menuOpen && (
            <>
              <div className="menu-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="avatar-dropdown">
                <div className="menu-handle" />

                <div className="avatar-row">
                  <span className="menu-avatar">
                    {session.avatarEmoji ? (
                      session.avatarEmoji
                    ) : session.picture ? (
                      <img src={session.picture} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      session.avatar
                    )}
                  </span>
                  <span className="menu-id">
                    <strong>{session.name}</strong>
                    {session.email && <small>{session.email}</small>}
                    <small>
                      via {PROVIDER_BADGE[session.provider]}
                      {session.real ? '' : ' (demo)'}
                    </small>
                  </span>
                </div>

                {backendUser && (
                  <>
                    <div className="menu-section">Presence</div>
                    <button
                      className="menu-row"
                      onClick={() => {
                        setNameDraft(session.name)
                        setNameOpen(true)
                      }}
                    >
                      <span className="mr-label">🏷️ Display name</span>
                      <span className="mr-state set">{session.name}</span>
                    </button>
                    <button
                      className="menu-row"
                      onClick={() => {
                        setIgDraft(instagramHandle ?? '')
                        setIgOpen(true)
                      }}
                    >
                      <span className="mr-label">📸 Instagram</span>
                      <span className={`mr-state${instagramHandle ? ' set' : ''}`}>
                        {instagramHandle ? `@${instagramHandle}` : 'Add'}
                      </span>
                    </button>
                    <button
                      className="menu-row"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenInterests()
                      }}
                    >
                      <span className="mr-label">🎯 Interests</span>
                      <span className={`mr-state${myInterests.length ? ' set' : ''}`}>
                        {myInterests.length
                          ? myInterests
                              .slice(0, 4)
                              .map((i) => INTEREST_BY_ID[i]?.emoji ?? '')
                              .join(' ')
                          : 'Not set'}
                      </span>
                    </button>
                    <button className="menu-row" onClick={() => setVibeOpen(true)}>
                      <span className="mr-label">⚡ Tonight&apos;s vibe</span>
                      <span className={`mr-state${myVibe ? ' set' : ''}`}>
                        {myVibe
                          ? `${interestFor(myVibe).emoji} ${interestFor(myVibe).label}`
                          : 'Not set'}
                      </span>
                    </button>
                    <button className="menu-row" onClick={() => setVisibilityOpen(true)}>
                      <span className="mr-label">🔭 Privacy &amp; visibility</span>
                      <span className="mr-state set">
                        {VISIBILITY_OPTIONS.find((v) => v.mode === visibilityMode)?.emoji}{' '}
                        {VISIBILITY_OPTIONS.find((v) => v.mode === visibilityMode)?.label ?? 'Ghost'}
                      </span>
                    </button>
                    <button className="menu-row" onClick={() => setAvatarPickerOpen(true)}>
                      <span className="mr-label">🎭 Avatar</span>
                      <span className="mr-state set">
                        {session.avatarEmoji ?? (session.picture ? 'Photo' : session.avatar)}
                      </span>
                    </button>
                  </>
                )}

                <div className="menu-section">Network</div>
                <button className="menu-row" onClick={() => goTab('friends')}>
                  <span className="mr-label">👥 Friends</span>
                  <span className="mr-state">
                    {stats.friendCount}
                    {stats.requestCount > 0 && (
                      <em className="menu-alert"> · {stats.requestCount}!</em>
                    )}
                    {stats.unreadDms > 0 && <em className="menu-alert"> · {stats.unreadDms} 💬</em>}
                  </span>
                </button>
                <button className="menu-row" onClick={() => goTab('mine')}>
                  <span className="mr-label">🎟️ My meetups</span>
                  <span className="mr-state">{stats.meetupCount}</span>
                </button>
                {backendUser && (
                  <button
                    className="menu-row"
                    onClick={() => {
                      setMenuOpen(false)
                      onInvite()
                    }}
                  >
                    <span className="mr-label">💌 Invite a friend</span>
                    <span className="mr-state">
                      <span className="mr-chevron">›</span>
                    </span>
                  </button>
                )}

                {backendUser && (
                  <>
                    <div className="menu-section">Tools &amp; safety</div>
                    <button
                      className="menu-row"
                      onClick={() => {
                        setMenuOpen(false)
                        onSharePresence()
                      }}
                    >
                      <span className="mr-label">📡 Share my presence</span>
                      <span className="mr-chevron">›</span>
                    </button>
                    <button
                      className="menu-row"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenConstellation()
                      }}
                    >
                      <span className="mr-label">🌌 Constellation</span>
                      <span className="mr-chevron">›</span>
                    </button>
                    <button
                      className="menu-row"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenGuardian()
                      }}
                    >
                      <span className="mr-label">🛡️ Guardian mode</span>
                      <span className="mr-chevron">›</span>
                    </button>

                    <div className="menu-section">Account</div>
                    <button
                      className="menu-row"
                      onClick={() => {
                        setMenuOpen(false)
                        onOpenBlocked()
                      }}
                    >
                      <span className="mr-label">🚫 Blocked users</span>
                      <span className="mr-chevron">›</span>
                    </button>
                  </>
                )}

                <div className="menu-foot">
                  <button className="menu-signout" onClick={onSignOut}>
                    Sign out
                  </button>
                  {backendUser && (
                    <button
                      className="menu-delete"
                      onClick={() => {
                        setMenuOpen(false)
                        onDeleteAccount()
                      }}
                    >
                      🗑️ Delete account
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

          {vibeOpen && (
            <div className="composer-backdrop" onClick={() => setVibeOpen(false)}>
              <div className="pin-composer picker-modal" onClick={(e) => e.stopPropagation()}>
                <button className="card-close" onClick={() => setVibeOpen(false)} aria-label="Close">
                  ×
                </button>
                <h3>⚡ Tonight&apos;s vibe</h3>
                <p className="composer-sub">Tell people nearby what you&apos;re up for — fades after 3 h.</p>
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
                </div>
                {myVibe && (
                  <button className="vibe-clear" onClick={() => onSetVibe(null)}>
                    Clear vibe
                  </button>
                )}
              </div>
            </div>
          )}

          {visibilityOpen && (
            <div className="composer-backdrop" onClick={() => setVisibilityOpen(false)}>
              <div className="pin-composer picker-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="card-close"
                  onClick={() => setVisibilityOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                <h3>🔭 Privacy &amp; visibility</h3>
                <p className="composer-sub">
                  Controls what strangers see. Friends always see your full profile.
                </p>
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
              </div>
            </div>
          )}

          {avatarPickerOpen && (
            <div className="composer-backdrop" onClick={() => setAvatarPickerOpen(false)}>
              <div className="pin-composer picker-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="card-close"
                  onClick={() => setAvatarPickerOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                <h3>🎭 Your avatar</h3>
                <p className="composer-sub">Pick an animal — it&apos;s how you appear to everyone.</p>
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
                </div>
                {session.picture && session.avatarEmoji && (
                  <button className="avatar-reset" onClick={() => onPickAvatar(null)}>
                    Use my photo instead
                  </button>
                )}
              </div>
            </div>
          )}
          {nameOpen && (
            <div className="composer-backdrop" onClick={() => setNameOpen(false)}>
              <div className="pin-composer picker-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="card-close"
                  onClick={() => setNameOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                <h3>🏷️ Display name</h3>
                <p className="composer-sub">
                  This is how everyone sees you. Use your real name or a nickname — a nickname
                  keeps you anonymous.
                </p>
                <form
                  className="name-edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const clean = nameDraft.trim()
                    if (clean) onSetName(clean)
                    setNameOpen(false)
                  }}
                >
                  <input
                    className="name-input"
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    maxLength={40}
                    autoFocus
                    placeholder="Your name or nickname"
                    aria-label="Display name"
                  />
                  <div className="name-edit-foot">
                    <span className="name-count">{nameDraft.trim().length}/40</span>
                    <button type="submit" className="name-save" disabled={!nameDraft.trim()}>
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
          {igOpen && (
            <div className="composer-backdrop" onClick={() => setIgOpen(false)}>
              <div className="pin-composer picker-modal" onClick={(e) => e.stopPropagation()}>
                <button
                  className="card-close"
                  onClick={() => setIgOpen(false)}
                  aria-label="Close"
                >
                  ×
                </button>
                <h3>📸 Instagram</h3>
                <p className="composer-sub">
                  Only your accepted friends can see this. Leave it empty to remove it.
                </p>
                <form
                  className="name-edit"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const norm = normalizeInstagram(igDraft)
                    if (norm !== undefined) {
                      onSetInstagram(norm)
                      setIgOpen(false)
                    }
                  }}
                >
                  <div className="ig-input-wrap">
                    <span className="ig-at">@</span>
                    <input
                      className="name-input ig-input"
                      value={igDraft}
                      onChange={(e) => setIgDraft(e.target.value)}
                      maxLength={80}
                      autoFocus
                      placeholder="yourhandle"
                      aria-label="Instagram handle"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                  </div>
                  {igDraft.trim() !== '' && normalizeInstagram(igDraft) === undefined && (
                    <span className="ig-invalid">
                      Letters, numbers, periods and underscores only.
                    </span>
                  )}
                  <div className="name-edit-foot">
                    <span className="name-count">
                      {instagramHandle && igDraft.trim() === '' ? 'Will remove your handle' : ''}
                    </span>
                    <button
                      type="submit"
                      className="name-save"
                      disabled={normalizeInstagram(igDraft) === undefined}
                    >
                      Save
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
            </>,
            document.body,
          )}
        </div>
      </div>
    </header>
  )
}

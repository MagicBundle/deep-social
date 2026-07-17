import { useEffect, useRef, useState } from 'react'
import type { FriendEntry, NearbyProfile, World } from '../types'
import { INTEREST_BY_ID, INTERESTS, interestFor } from '../data/mock'
import { attendingCount, isLive, timeLabel } from '../sim/engine'
import InterestChips from './InterestChips'

const DISCOVER_RADIUS_KM = 50

/** Great-circle distance — used to scope demo members to the discovery
 *  radius (real members arrive with a server-computed distance). */
const kmBetween = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const d = Math.PI / 180
  const s =
    Math.sin(((b.lat - a.lat) * d) / 2) ** 2 +
    Math.cos(a.lat * d) * Math.cos(b.lat * d) * Math.sin(((b.lng - a.lng) * d) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(s))
}

/** How many of the wanted interests this person shares (their transient
 *  vibe counts too — it's tonight's interest). */
const sharedCount = (wanted: Set<string>, interests: string[], vibe?: string) => {
  let n = interests.filter((i) => wanted.has(i)).length
  if (vibe && wanted.has(vibe) && !interests.includes(vibe)) n++
  return n
}

export type PanelTab = 'events' | 'people' | 'friends' | 'mine'

/** Mobile bottom-sheet states (CSS ignores these on desktop):
 *  peek = handle + summary only (~80% of the map visible). */
type SheetState = 'peek' | 'half' | 'full'
const SHEET_UP: Record<SheetState, SheetState> = { peek: 'half', half: 'full', full: 'full' }
const SHEET_DOWN: Record<SheetState, SheetState> = { full: 'half', half: 'peek', peek: 'peek' }
const SWIPE_THRESHOLD_PX = 36

interface Props {
  world: World
  filters: Set<string>
  onToggleFilter: (id: string) => void
  tab: PanelTab
  onTab: (t: PanelTab) => void
  joined: Set<string>
  selectedEventId: string | null
  onSelectEvent: (id: string) => void
  friends: FriendEntry[]
  backendLive: boolean
  dmUnread: Record<string, number>
  people: NearbyProfile[]
  onSelectPerson: (id: string) => void
  /** the user's saved interests — seed the Discover chips and stay in sync */
  myInterests: string[]
  onSetInterests: (ids: string[]) => void
  mePos: { lat: number; lng: number }
  onRespondFriend: (userId: string, accept: boolean) => void
  onRemoveFriend: (userId: string) => void
  onOpenFriendChat: (friend: FriendEntry) => void
  onOpenProfile: (friend: FriendEntry) => void
  /** bump to force the mobile sheet open (e.g. profile-menu navigation) */
  openSignal: number
}

export default function SidePanel({
  world,
  filters,
  onToggleFilter,
  tab,
  onTab,
  joined,
  selectedEventId,
  onSelectEvent,
  friends,
  backendLive,
  dmUnread,
  people,
  onSelectPerson,
  myInterests,
  onSetInterests,
  mePos,
  onRespondFriend,
  onRemoveFriend,
  onOpenFriendChat,
  onOpenProfile,
  openSignal,
}: Props) {
  const [sheet, setSheet] = useState<SheetState>('peek')

  useEffect(() => {
    if (openSignal > 0) setSheet('half')
  }, [openSignal])
  const swipe = useRef<{ startY: number; lastY: number; moved: boolean } | null>(null)

  const onHandleTouchStart = (e: React.TouchEvent) => {
    const y = e.touches[0].clientY
    swipe.current = { startY: y, lastY: y, moved: false }
  }
  const onHandleTouchMove = (e: React.TouchEvent) => {
    if (!swipe.current) return
    swipe.current.lastY = e.touches[0].clientY
    if (Math.abs(swipe.current.lastY - swipe.current.startY) > 8) swipe.current.moved = true
  }
  const onHandleTouchEnd = () => {
    if (!swipe.current) return
    const delta = swipe.current.lastY - swipe.current.startY
    if (delta < -SWIPE_THRESHOLD_PX) setSheet((s) => SHEET_UP[s])
    else if (delta > SWIPE_THRESHOLD_PX) setSheet((s) => SHEET_DOWN[s])
    // leave swipe.current set briefly so the synthetic click can see `moved`
    setTimeout(() => (swipe.current = null), 300)
  }
  const onHandleClick = () => {
    if (swipe.current?.moved) return
    setSheet((s) => (s === 'peek' ? 'half' : 'peek'))
  }

  // Selecting anything from the list: get the sheet out of the way so the
  // map fly-to and the event card are visible.
  const selectAndReveal = (id: string) => {
    setSheet('peek')
    onSelectEvent(id)
  }

  const matchesFilter = (categories: string[]) =>
    filters.size === 0 || categories.some((c) => filters.has(c))

  const events = world.events
    .filter((e) => matchesFilter([e.category]))
    .sort((a, b) => a.startsInMin - b.startsInMin)

  const liveCount = world.events.filter(isLive).length

  const simPeople = world.members
    .filter((m) => matchesFilter(m.interests))
    .sort((a, b) => (a.status === 'heading' ? -1 : 1) - (b.status === 'heading' ? -1 : 1))

  const peopleNearby = people.filter((p) => matchesFilter(p.interests))

  // ── Discover: shared interests within 50 km ─────────────────────────────
  // The chips double as the user's saved profile interests — matching is
  // two-sided, so picking chips is what makes YOU discoverable too.
  const [discover, setDiscover] = useState<Set<string>>(() => new Set(myInterests))
  const interestsKey = myInterests.join(',')
  useEffect(() => {
    setDiscover(new Set(myInterests))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestsKey])

  const toggleDiscover = (id: string) => {
    setDiscover((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      onSetInterests([...next])
      return next
    })
  }

  // Real members: server already applied the visibility ladder, blocks and
  // the 2 h freshness window; the 60 km feed is scoped down to 50 km here.
  const discovered = people
    .map((p) => ({ p, shared: sharedCount(discover, p.interests, p.vibe) }))
    .filter(({ p, shared }) => shared > 0 && p.distanceM <= DISCOVER_RADIUS_KM * 1000)
    .sort((a, b) => b.shared - a.shared || a.p.distanceM - b.p.distanceM)

  const discoveredSim = world.members
    .map((m) => ({ m, shared: sharedCount(discover, m.interests), km: kmBetween(mePos, m) }))
    .filter(({ shared, km }) => shared > 0 && km <= DISCOVER_RADIUS_KM)
    .sort((a, b) => b.shared - a.shared || a.km - b.km)
    .slice(0, 6)

  const mine = world.events.filter((e) => joined.has(e.id))

  const incoming = friends.filter((f) => f.state === 'incoming')
  const accepted = friends.filter((f) => f.state === 'friend')
  const outgoing = friends.filter((f) => f.state === 'outgoing')
  const friendBadge = incoming.length > 0 ? ` (${incoming.length}!)` : accepted.length > 0 ? ` (${accepted.length})` : ''

  const friendRow = (f: FriendEntry, actions: React.ReactNode, onClick?: () => void) => {
    const unread = dmUnread[f.userId] ?? 0
    const avatar = f.avatarEmoji ?? (f.avatarUrl ? (
      <img className="row-avatar" src={f.avatarUrl} alt="" referrerPolicy="no-referrer" />
    ) : (
      '👤'
    ))
    // Identity (avatar + name) opens the profile; the rest of the row keeps
    // its primary action (chat for accepted friends).
    const openProfile = (e: React.MouseEvent) => {
      e.stopPropagation()
      onOpenProfile(f)
    }
    return (
      <div
        key={f.userId}
        className={`person-row${onClick ? ' clickable' : ''}`}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
      >
        <span className="row-emoji person identity-link" onClick={openProfile} title="View profile">
          {avatar}
          {unread > 0 && <span className="unread-dot">{unread}</span>}
        </span>
        <span className="row-text">
          <strong className="identity-link" onClick={openProfile} title="View profile">
            {f.displayName}
          </strong>
          <small>
            {unread > 0
              ? `${unread} new message${unread > 1 ? 's' : ''}`
              : f.interests.length
                ? f.interests.map((i) => INTEREST_BY_ID[i]?.label ?? i).join(', ')
                : 'Deep Social member'}
          </small>
        </span>
        {actions}
      </div>
    )
  }

  return (
    <aside className={`side-panel sheet-${sheet}`}>
      <div
        className="sheet-handle"
        onTouchStart={onHandleTouchStart}
        onTouchMove={onHandleTouchMove}
        onTouchEnd={onHandleTouchEnd}
        onClick={onHandleClick}
        role="button"
        aria-label="Expand or collapse the events panel"
      >
        <span className="handle-bar" />
        <span className="sheet-summary">
          {liveCount} live now · {events.length} events nearby
        </span>
      </div>

      <div className="chips">
        <InterestChips filters={filters} onToggle={onToggleFilter} />
      </div>

      <div className="panel-tabs">
        <button className={tab === 'events' ? 'active' : ''} onClick={() => onTab('events')}>
          Happening
        </button>
        <button className={tab === 'people' ? 'active' : ''} onClick={() => onTab('people')}>
          People
        </button>
        <button className={tab === 'friends' ? 'active' : ''} onClick={() => onTab('friends')}>
          Friends{friendBadge}
        </button>
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => onTab('mine')}>
          Mine{joined.size > 0 ? ` (${joined.size})` : ''}
        </button>
      </div>

      <div className="panel-list">
        {tab === 'events' &&
          events.map((e) => {
            const interest = interestFor(e.category)
            return (
              <button
                key={e.id}
                className={`event-row${e.id === selectedEventId ? ' selected' : ''}`}
                onClick={() => selectAndReveal(e.id)}
              >
                <span className="row-emoji" style={{ background: `${interest.color}22`, borderColor: interest.color }}>
                  {interest.emoji}
                </span>
                <span className="row-text">
                  <strong>
                    {e.title}
                    {joined.has(e.id) && <em className="joined-tick"> ✓</em>}
                  </strong>
                  <small>
                    {e.venue} · {attendingCount(e, joined.has(e.id))} going
                  </small>
                </span>
                <span className={`row-time${isLive(e) ? ' live' : ''}`}>{timeLabel(e)}</span>
              </button>
            )
          })}

        {tab === 'people' && (
          <>
            <div className="friend-section">Discover — shared interests · {DISCOVER_RADIUS_KM} km</div>
            <div className="discover-chips">
              {INTERESTS.map((i) => (
                <button
                  key={i.id}
                  className={`chip${discover.has(i.id) ? ' active' : ''}`}
                  style={{ ['--c' as string]: i.color }}
                  onClick={() => toggleDiscover(i.id)}
                >
                  {i.emoji} {i.label}
                </button>
              ))}
            </div>
            {discover.size === 0 ? (
              <p className="discover-hint">
                Pick what you&apos;re into — you&apos;ll see people within {DISCOVER_RADIUS_KM} km
                who share it, and they can find you.
              </p>
            ) : (
              <>
                {discovered.map(({ p, shared }) => {
                  const matchedLabels = [
                    ...p.interests.filter((i) => discover.has(i)),
                    ...(p.vibe && discover.has(p.vibe) && !p.interests.includes(p.vibe)
                      ? [p.vibe]
                      : []),
                  ]
                    .map((i) => INTEREST_BY_ID[i]?.label ?? i)
                    .join(', ')
                  return (
                    <div
                      key={`disc-${p.id}`}
                      className="person-row clickable"
                      onClick={() => {
                        setSheet('peek')
                        onSelectPerson(p.id)
                      }}
                      role="button"
                    >
                      <span className="row-emoji person">
                        {p.identified ? (
                          p.avatarEmoji ??
                          (p.avatarUrl ? (
                            <img className="row-avatar" src={p.avatarUrl} alt="" referrerPolicy="no-referrer" />
                          ) : (
                            '👤'
                          ))
                        ) : (
                          '🔭'
                        )}
                      </span>
                      <span className="row-text">
                        <strong>
                          {p.identified ? p.displayName : 'Someone nearby'}
                          {p.isFriend && <em className="joined-tick"> ✓</em>}
                        </strong>
                        <small>
                          ~{(p.distanceM / 1000).toFixed(1)} km · {matchedLabels}
                        </small>
                      </span>
                      <span className="shared-badge">{shared} shared</span>
                    </div>
                  )
                })}
                {discoveredSim.map(({ m, shared, km }) => (
                  <div key={`disc-sim-${m.id}`} className="person-row">
                    <span className="row-emoji person">{m.avatar}</span>
                    <span className="row-text">
                      <strong>
                        {m.name} <em className="demo-tag">demo</em>
                      </strong>
                      <small>
                        ~{km.toFixed(1)} km ·{' '}
                        {m.interests
                          .filter((i) => discover.has(i))
                          .map((i) => INTEREST_BY_ID[i]?.label ?? i)
                          .join(', ')}
                      </small>
                    </span>
                    <span className="shared-badge">{shared} shared</span>
                  </div>
                ))}
                {discovered.length === 0 && discoveredSim.length === 0 && (
                  <p className="discover-hint">
                    No one within {DISCOVER_RADIUS_KM} km shares these right now — presence is
                    live, check back tonight.
                  </p>
                )}
              </>
            )}
          </>
        )}

        {tab === 'people' && peopleNearby.length > 0 && (
          <>
            <div className="friend-section">Nearby now — real members</div>
            {peopleNearby.map((p) => (
              <div
                key={p.id}
                className="person-row clickable"
                onClick={() => {
                  setSheet('peek')
                  onSelectPerson(p.id)
                }}
                role="button"
              >
                <span className="row-emoji person">
                  {p.identified ? (
                    p.avatarEmoji ??
                    (p.avatarUrl ? (
                      <img className="row-avatar" src={p.avatarUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      '👤'
                    ))
                  ) : (
                    '🔭'
                  )}
                </span>
                <span className="row-text">
                  <strong>
                    {p.identified ? p.displayName : 'Someone nearby'}
                    {p.isFriend && <em className="joined-tick"> ✓</em>}
                  </strong>
                  <small>
                    ~{(p.distanceM / 1000).toFixed(1)} km ·{' '}
                    {p.vibe
                      ? `⚡ ${interestFor(p.vibe).label}`
                      : p.interests.slice(0, 3).map((i) => INTEREST_BY_ID[i]?.label ?? i).join(', ') ||
                        'no interests yet'}
                  </small>
                </span>
              </div>
            ))}
          </>
        )}
        {tab === 'people' && simPeople.length > 0 && (
          <div className="friend-section">Demo world — simulated people</div>
        )}
        {tab === 'people' &&
          simPeople.map((m) => (
            <div key={m.id} className="person-row">
              <span className="row-emoji person">{m.avatar}</span>
              <span className="row-text">
                <strong>
                  {m.name} <em className="demo-tag">demo</em>
                </strong>
                <small className={m.status === 'heading' ? 'heading-to' : ''}>
                  {m.status === 'heading' ? `→ ${m.activity.replace('heading to ', '')}` : m.activity}
                </small>
              </span>
              <span className="row-interests">
                {m.interests.slice(0, 3).map((i) => (
                  <i key={i} className="int-dot" style={{ background: INTEREST_BY_ID[i].color }} title={INTEREST_BY_ID[i].label} />
                ))}
              </span>
            </div>
          ))}

        {tab === 'friends' &&
          (!backendLive ? (
            <p className="empty-state">
              Sign in with <strong>Google</strong> to find members and add friends.
            </p>
          ) : friends.length === 0 ? (
            <p className="empty-state">
              No friends yet. Search for people by name in the top bar and tap <strong>+ add</strong>.
            </p>
          ) : (
            <>
              {incoming.length > 0 && <div className="friend-section">Requests</div>}
              {incoming.map((f) =>
                friendRow(
                  f,
                  <span className="friend-actions">
                    <button
                      className="friend-accept"
                      title="Accept"
                      onClick={() => onRespondFriend(f.userId, true)}
                    >
                      ✓
                    </button>
                    <button
                      className="friend-decline"
                      title="Decline"
                      onClick={() => onRespondFriend(f.userId, false)}
                    >
                      ✕
                    </button>
                  </span>,
                ),
              )}
              {accepted.length > 0 && <div className="friend-section">Friends</div>}
              {accepted.map((f) =>
                friendRow(
                  f,
                  <span className="friend-actions">
                    <button
                      className="friend-chat"
                      title={`Message ${f.displayName}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenFriendChat(f)
                      }}
                    >
                      💬
                    </button>
                    <button
                      className="friend-remove"
                      title={`Remove ${f.displayName}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFriend(f.userId)
                      }}
                    >
                      ✕
                    </button>
                  </span>,
                  () => onOpenFriendChat(f),
                ),
              )}
              {outgoing.length > 0 && <div className="friend-section">Sent</div>}
              {outgoing.map((f) => friendRow(f, <span className="pending-tag">pending…</span>))}
            </>
          ))}

        {tab === 'mine' &&
          (mine.length === 0 ? (
            <p className="empty-state">
              No meetups yet. Tap an event on the map and hit <strong>Join meetup</strong>.
            </p>
          ) : (
            mine.map((e) => {
              const interest = interestFor(e.category)
              return (
                <button key={e.id} className="event-row" onClick={() => selectAndReveal(e.id)}>
                  <span className="row-emoji" style={{ background: `${interest.color}22`, borderColor: interest.color }}>
                    {interest.emoji}
                  </span>
                  <span className="row-text">
                    <strong>{e.title}</strong>
                    <small>
                      {e.venue} · {attendingCount(e, true)} going
                    </small>
                  </span>
                  <span className={`row-time${isLive(e) ? ' live' : ''}`}>{timeLabel(e)}</span>
                </button>
              )
            })
          ))}
      </div>
    </aside>
  )
}

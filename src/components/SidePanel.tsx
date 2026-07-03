import { useRef, useState } from 'react'
import type { World } from '../types'
import { INTEREST_BY_ID, interestFor } from '../data/mock'
import { attendingCount, isLive, timeLabel } from '../sim/engine'
import InterestChips from './InterestChips'

export type PanelTab = 'events' | 'people' | 'mine'

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
}: Props) {
  const [sheet, setSheet] = useState<SheetState>('peek')
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

  const people = world.members
    .filter((m) => matchesFilter(m.interests))
    .sort((a, b) => (a.status === 'heading' ? -1 : 1) - (b.status === 'heading' ? -1 : 1))

  const mine = world.events.filter((e) => joined.has(e.id))

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
        <button className={tab === 'mine' ? 'active' : ''} onClick={() => onTab('mine')}>
          My meetups{joined.size > 0 ? ` (${joined.size})` : ''}
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

        {tab === 'people' &&
          people.map((m) => (
            <div key={m.id} className="person-row">
              <span className="row-emoji person">{m.avatar}</span>
              <span className="row-text">
                <strong>{m.name}</strong>
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

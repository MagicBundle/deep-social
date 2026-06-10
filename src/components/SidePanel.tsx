import type { World } from '../types'
import { INTERESTS, INTEREST_BY_ID } from '../data/mock'
import { isLive, timeLabel } from '../sim/engine'

export type PanelTab = 'events' | 'people' | 'mine'

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
  const matchesFilter = (categories: string[]) =>
    filters.size === 0 || categories.some((c) => filters.has(c))

  const events = world.events
    .filter((e) => matchesFilter([e.category]))
    .sort((a, b) => a.startsInMin - b.startsInMin)

  const people = world.members
    .filter((m) => matchesFilter(m.interests))
    .sort((a, b) => (a.status === 'heading' ? -1 : 1) - (b.status === 'heading' ? -1 : 1))

  const mine = world.events.filter((e) => joined.has(e.id))

  return (
    <aside className="side-panel">
      <div className="chips">
        {INTERESTS.map((i) => (
          <button
            key={i.id}
            className={`chip${filters.has(i.id) ? ' active' : ''}`}
            style={{ ['--c' as string]: i.color }}
            onClick={() => onToggleFilter(i.id)}
          >
            {i.emoji} {i.label}
          </button>
        ))}
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
            const interest = INTEREST_BY_ID[e.category]
            return (
              <button
                key={e.id}
                className={`event-row${e.id === selectedEventId ? ' selected' : ''}`}
                onClick={() => onSelectEvent(e.id)}
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
                    {e.venue} · {e.attendees.length + (joined.has(e.id) ? 1 : 0)} going
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
              const interest = INTEREST_BY_ID[e.category]
              return (
                <button key={e.id} className="event-row" onClick={() => onSelectEvent(e.id)}>
                  <span className="row-emoji" style={{ background: `${interest.color}22`, borderColor: interest.color }}>
                    {interest.emoji}
                  </span>
                  <span className="row-text">
                    <strong>{e.title}</strong>
                    <small>
                      {e.venue} · {e.attendees.length + 1} going
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

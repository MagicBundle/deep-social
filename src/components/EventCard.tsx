import type { SocialEvent, World } from '../types'
import { INTEREST_BY_ID } from '../data/mock'
import { isLive, timeLabel } from '../sim/engine'

interface Props {
  event: SocialEvent
  world: World
  joined: boolean
  onJoin: () => void
  onChat: () => void
  onClose: () => void
}

export default function EventCard({ event, world, joined, onJoin, onChat, onClose }: Props) {
  const interest = INTEREST_BY_ID[event.category]
  const attendees = event.attendees
    .map((id) => world.members.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
  const count = attendees.length + (joined ? 1 : 0)

  return (
    <div className="event-card" style={{ ['--c' as string]: interest.color }}>
      <button className="card-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="card-head">
        <span className="row-emoji big" style={{ background: `${interest.color}22`, borderColor: interest.color }}>
          {interest.emoji}
        </span>
        <div>
          <h3>{event.title}</h3>
          <p className="card-meta">
            {event.venue} · <span className={isLive(event) ? 'live-text' : ''}>{timeLabel(event)}</span> ·{' '}
            {interest.label}
          </p>
        </div>
      </div>
      <p className="card-desc">{event.description}</p>
      <div className="card-foot">
        <div className="avatar-stack" title={attendees.map((a) => a.name).join(', ')}>
          {attendees.slice(0, 6).map((a) => (
            <span key={a.id}>{a.avatar}</span>
          ))}
          <small>{count} going</small>
        </div>
        <div className="card-actions">
          <button className={`btn-join${joined ? ' joined' : ''}`} onClick={onJoin}>
            {joined ? 'Joined ✓' : 'Join meetup'}
          </button>
          <button className="btn-chat" onClick={onChat}>
            💬 Chat
          </button>
        </div>
      </div>
    </div>
  )
}

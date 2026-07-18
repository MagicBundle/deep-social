import { useEffect, useState } from 'react'
import type { Attendee, SocialEvent, Vibe, World } from '../types'
import { interestFor } from '../data/mock'
import { attendingCount, isLive, remotePinId, timeLabel } from '../sim/engine'
import { listVibes, pinAttendees, reportVibe } from '../services/db'
import { downloadIcs } from '../services/calendar'
import { shareEvent } from '../services/share'

interface Props {
  event: SocialEvent
  world: World
  joined: boolean
  backendLive: boolean
  onJoin: () => void
  onChat: () => void
  onVibeCheck: () => void
  onNavigate: (lat: number, lng: number, label: string) => void
  onNotify: (text: string) => void
  onOpenAttendee: (a: Attendee) => void
  /** report this pin (real backend pins only) */
  onReport: (pinId: string) => void
  onClose: () => void
}

export default function EventCard({
  event,
  world,
  joined,
  backendLive,
  onJoin,
  onChat,
  onVibeCheck,
  onNavigate,
  onNotify,
  onOpenAttendee,
  onReport,
  onClose,
}: Props) {
  const interest = interestFor(event.category)
  const attendees = event.attendees
    .map((id) => world.members.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
  const count = attendingCount(event, joined)

  const pinId = remotePinId(event.id)
  const vibesEnabled = backendLive && pinId !== null
  const [vibes, setVibes] = useState<Vibe[]>([])
  const [reported, setReported] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!vibesEnabled || !pinId) {
      setVibes([])
      return
    }
    let cancelled = false
    listVibes(pinId)
      .then((v) => {
        if (!cancelled) setVibes(v)
      })
      .catch((e) => console.warn('[vibes] fetch failed:', e))
    return () => {
      cancelled = true
    }
    // mediaCount in deps: realtime bumps it -> refetch the strip
  }, [vibesEnabled, pinId, event.mediaCount])

  // Who's going (real pins only — sim events have no backend attendance).
  // attendee_count in deps: joining/leaving re-fetches the faces.
  const [going, setGoing] = useState<Attendee[]>([])
  useEffect(() => {
    if (!vibesEnabled || !pinId) {
      setGoing([])
      return
    }
    let cancelled = false
    pinAttendees(pinId)
      .then((a) => {
        if (!cancelled) setGoing(a)
      })
      .catch((e) => console.warn('[attendees] fetch failed:', e))
    return () => {
      cancelled = true
    }
  }, [vibesEnabled, pinId, event.attendeeCount, joined])

  const report = (vibe: Vibe) => {
    if (!pinId || reported.has(vibe.id)) return
    setReported((prev) => new Set(prev).add(vibe.id))
    reportVibe(vibe.id)
      .then(() => onNotify('Reported — thanks for flagging it'))
      .catch(() => onNotify('Could not send the report, try again later'))
  }

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
            {event.isPin && event.authorName ? ` · by ${event.authorName}` : ''}
          </p>
        </div>
      </div>

      {vibes.length > 0 && (
        <div className="vibe-strip">
          {vibes.map((v) => (
            <figure key={v.id} className="vibe-item">
              <img src={v.url} alt={`Vibe photo by ${v.authorName ?? 'a member'}`} loading="lazy" />
              <figcaption>
                <span>{v.authorName ?? 'Member'}</span>
                {!v.mine && (
                  <button
                    className="vibe-report"
                    title="Report this photo"
                    disabled={reported.has(v.id)}
                    onClick={() => report(v)}
                  >
                    {reported.has(v.id) ? '✓' : '⚑'}
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      <p className="card-desc">{event.description}</p>
      <div className="card-foot">
        {going.length > 0 ? (
          // Real pin: faces come from the server, already filtered through
          // the visibility ladder. Identified people open their profile;
          // anonymous ones are a head-count and stay untappable.
          <div className="avatar-stack">
            {going.slice(0, 6).map((a, i) =>
              a.identified ? (
                <button
                  key={a.userId}
                  className={`att-face${a.isFriend ? ' friend' : ''}`}
                  title={`${a.displayName ?? 'Member'}${a.isFriend ? ' · friend' : ''}`}
                  aria-label={`Open ${a.displayName ?? 'member'}'s profile`}
                  onClick={() => onOpenAttendee(a)}
                >
                  {a.avatarEmoji ??
                    (a.avatarUrl ? (
                      <img src={a.avatarUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      '👤'
                    ))}
                </button>
              ) : (
                <span
                  key={`anon-${i}`}
                  className="att-face anon"
                  title="Someone going — they keep their profile private"
                >
                  🔭
                </span>
              ),
            )}
            <small>{count} going</small>
          </div>
        ) : (
          <div className="avatar-stack" title={attendees.map((a) => `${a.name} (demo)`).join(', ')}>
            {attendees.slice(0, 6).map((a) => (
              <span key={a.id}>{a.avatar}</span>
            ))}
            <small>
              {count} going{attendees.length > 0 && <em className="demo-tag">demo</em>}
            </small>
          </div>
        )}
        <div className="card-actions">
          <button
            className="icon-btn"
            title="Add to calendar"
            aria-label="Add to calendar"
            onClick={() => {
              downloadIcs(event)
              onNotify('Calendar file downloaded 📅')
            }}
          >
            📅
          </button>
          <button
            className="icon-btn"
            title="Walking directions"
            aria-label="Get directions"
            onClick={() => onNavigate(event.lat, event.lng, event.title)}
          >
            🗺️
          </button>
          {vibesEnabled && pinId && (
            <button
              className="icon-btn"
              title="Report this event"
              aria-label="Report this event"
              onClick={() => onReport(pinId)}
            >
              ⚑
            </button>
          )}
          <button
            className="icon-btn"
            title="Share (WhatsApp & more)"
            aria-label="Share event"
            onClick={() => {
              shareEvent(event)
                .then((how) =>
                  onNotify(how === 'whatsapp' ? 'Opening WhatsApp to share 📤' : 'Shared 📤'),
                )
                .catch(() => {})
            }}
          >
            📤
          </button>
          <button className={`btn-join${joined ? ' joined' : ''}`} onClick={onJoin}>
            {joined ? 'Joined ✓' : 'Join meetup'}
          </button>
          {vibesEnabled && joined && (
            <button className="btn-chat" onClick={onVibeCheck}>
              📸 Vibe
            </button>
          )}
          <button className="btn-chat" onClick={onChat}>
            💬 Chat
          </button>
        </div>
      </div>
    </div>
  )
}

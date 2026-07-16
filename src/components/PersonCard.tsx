import type { FriendState, NearbyProfile } from '../types'
import { INTEREST_BY_ID, interestFor } from '../data/mock'

interface Props {
  person: NearbyProfile
  friendState: FriendState | null
  onConnect: () => void
  onAccept: () => void
  onMessage: () => void
  onNavigate: (lat: number, lng: number, label: string) => void
  onBlock: () => void
  onClose: () => void
}

// Bottom card for a real person tapped on the map. Observers stay anonymous
// (interests + rough distance only) with a "Request connection" action;
// beacons and friends show the full profile.
export default function PersonCard({
  person,
  friendState,
  onConnect,
  onAccept,
  onMessage,
  onNavigate,
  onBlock,
  onClose,
}: Props) {
  const km = (person.distanceM / 1000).toFixed(1)
  const modeLabel = person.isFriend
    ? 'Friend'
    : person.identified
      ? 'Beacon · sharing openly'
      : 'Observer · anonymous'

  const avatar = person.identified
    ? (person.avatarEmoji ?? (person.avatarUrl ? undefined : '👤'))
    : '🔭'

  return (
    <div className="event-card person-card" style={{ ['--c' as string]: person.isFriend ? '#4ade80' : '#22d3ee' }}>
      <button className="card-close" onClick={onClose} aria-label="Close">
        ×
      </button>
      <div className="card-head">
        <span className="pc-avatar">
          {avatar ?? <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        </span>
        <div>
          <h3>{person.identified ? person.displayName : 'Someone nearby'}</h3>
          <p className="card-meta">
            ~{km} km away · {modeLabel}
          </p>
        </div>
      </div>

      {person.vibe && (
        <p className="pc-vibe">
          ⚡ Tonight: {interestFor(person.vibe).emoji} <strong>{interestFor(person.vibe).label}</strong>
        </p>
      )}

      {person.interests.length > 0 && (
        <div className="deep-interests pc-interests">
          {person.interests.slice(0, 5).map((i) => {
            const interest = INTEREST_BY_ID[i]
            return (
              <span
                key={i}
                className="deep-chip"
                style={{ ['--c' as string]: interest?.color ?? '#94a3b8' }}
              >
                {interest ? `${interest.emoji} ${interest.label}` : i}
              </span>
            )
          })}
        </div>
      )}

      {!person.identified && (
        <p className="pc-hint">
          They're in observer mode — send a request and they'll see <em>your</em> profile and can
          choose to connect.
        </p>
      )}

      <div className="card-foot pc-foot">
        <button
          className="icon-btn"
          title={person.identified ? 'Walking directions' : 'Directions to their approximate area'}
          aria-label="Get directions"
          onClick={() =>
            onNavigate(
              person.lat,
              person.lng,
              person.identified
                ? (person.displayName ?? 'this member')
                : 'their approximate area',
            )
          }
        >
          🗺️
        </button>
        {friendState === 'friend' ? (
          <button className="btn-join" onClick={onMessage}>
            💬 Message
          </button>
        ) : friendState === 'incoming' ? (
          <button className="btn-join" onClick={onAccept}>
            ✓ Accept their request
          </button>
        ) : friendState === 'outgoing' ? (
          <button className="btn-chat" disabled>
            Request sent ✓
          </button>
        ) : (
          <button className="btn-join" onClick={onConnect}>
            {person.identified ? '➕ Add friend' : '🔗 Request connection'}
          </button>
        )}
      </div>

      <button className="fp-remove pc-block" onClick={onBlock}>
        Block {person.identified ? (person.displayName ?? 'this member') : 'this person'}
      </button>
    </div>
  )
}

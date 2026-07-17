import type { FriendEntry, NearbyProfile, ProfileState } from '../types'
import { INTEREST_BY_ID, interestFor } from '../data/mock'

/** A friend, or a stranger met through an event's attendee list (state
 *  'none'): same profile surface, different actions. */
export type ProfilePerson = Omit<FriendEntry, 'state' | 'since'> & {
  state: ProfileState
  since?: string
}

interface Props {
  friend: ProfilePerson
  myInterests: string[]
  /** live presence entry when this friend is currently visible nearby */
  nearby: NearbyProfile | null
  onMessage: () => void
  onShowOnMap: () => void
  onNavigate: (lat: number, lng: number, label: string) => void
  onAccept: () => void
  onDecline: () => void
  onConnect: () => void
  onRemove: () => void
  onBlock: () => void
  onClose: () => void
}

// Minimal user profile, opened from a friend's avatar/name. Deliberately
// small — the seam for a richer profile later (bio, mutuals, shared events).
export default function FriendProfileModal({
  friend,
  myInterests,
  nearby,
  onMessage,
  onShowOnMap,
  onNavigate,
  onAccept,
  onDecline,
  onConnect,
  onRemove,
  onBlock,
  onClose,
}: Props) {
  const avatar = friend.avatarEmoji ?? (friend.avatarUrl ? undefined : '👤')

  // What you have in common — a live vibe counts as tonight's interest.
  const mine = new Set(myInterests)
  const shared = [
    ...friend.interests.filter((i) => mine.has(i)),
    ...(nearby?.vibe && mine.has(nearby.vibe) && !friend.interests.includes(nearby.vibe)
      ? [nearby.vibe]
      : []),
  ]
  const sharedSet = new Set(shared)
  const orderedInterests = [
    ...friend.interests.filter((i) => sharedSet.has(i)),
    ...friend.interests.filter((i) => !sharedSet.has(i)),
  ]

  const since = friend.since ? new Date(friend.since) : null
  const sinceLabel =
    since && !Number.isNaN(since.getTime())
      ? since.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : null

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer deep-card friend-profile" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="deep-avatar">
          {avatar ?? <img src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        </div>
        <h3 className="deep-name">{friend.displayName}</h3>

        <p className="fp-meta">
          {friend.state === 'friend'
            ? sinceLabel
              ? `Friends since ${sinceLabel}`
              : 'Friends'
            : friend.state === 'incoming'
              ? 'Wants to connect with you'
              : friend.state === 'outgoing'
                ? 'Friend request pending'
                : 'Going to this event'}
          {nearby && ` · ~${(nearby.distanceM / 1000).toFixed(1)} km away`}
        </p>

        {nearby?.vibe && (
          <p className="pc-vibe">
            ⚡ Tonight: {interestFor(nearby.vibe).emoji}{' '}
            <strong>{interestFor(nearby.vibe).label}</strong>
          </p>
        )}

        {shared.length > 0 && (
          <p className="you-both">
            ✨ You both:{' '}
            <strong>
              {shared
                .map((i) => {
                  const interest = INTEREST_BY_ID[i]
                  return interest ? `${interest.emoji} ${interest.label}` : i
                })
                .join(' · ')}
            </strong>
          </p>
        )}

        {orderedInterests.length > 0 && (
          <div className="deep-interests">
            {orderedInterests.slice(0, 6).map((i) => {
              const interest = INTEREST_BY_ID[i]
              return (
                <span
                  key={i}
                  className={`deep-chip${sharedSet.has(i) ? ' shared' : ''}`}
                  style={{ ['--c' as string]: interest?.color ?? '#94a3b8' }}
                >
                  {interest ? `${interest.emoji} ${interest.label}` : i}
                </span>
              )
            })}
          </div>
        )}

        {friend.state === 'friend' && friend.instagramHandle && (
          <button
            className="fp-instagram"
            onClick={() =>
              window.open(
                `https://instagram.com/${friend.instagramHandle}`,
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
            <span className="ig-glyph">📸</span> @{friend.instagramHandle}
          </button>
        )}

        <div className="composer-actions fp-actions">
          {friend.state === 'friend' && (
            <>
              {nearby && (
                <button className="btn-chat" onClick={onShowOnMap}>
                  📍 Show on map
                </button>
              )}
              {nearby && (
                <button
                  className="btn-chat"
                  onClick={() => onNavigate(nearby.lat, nearby.lng, friend.displayName)}
                >
                  🗺️ Directions
                </button>
              )}
              <button className="btn-join" onClick={onMessage}>
                💬 Message
              </button>
            </>
          )}
          {friend.state === 'incoming' && (
            <>
              <button className="btn-chat" onClick={onDecline}>
                Decline
              </button>
              <button className="btn-join" onClick={onAccept}>
                ✓ Accept
              </button>
            </>
          )}
          {friend.state === 'outgoing' && (
            <button className="btn-chat" disabled>
              Request sent ✓
            </button>
          )}
          {friend.state === 'none' && (
            <button className="btn-join" onClick={onConnect}>
              ➕ Add friend
            </button>
          )}
        </div>

        {friend.state === 'none' && (
          <p className="fp-note">Chat unlocks once you&apos;re friends.</p>
        )}

        <div className="fp-danger">
          {friend.state === 'friend' && (
            <button className="fp-remove" onClick={onRemove}>
              Remove friend
            </button>
          )}
          <button className="fp-remove" onClick={onBlock}>
            Block {friend.displayName}
          </button>
        </div>
      </div>
    </div>
  )
}

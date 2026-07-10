import type { FriendEntry, NearbyProfile } from '../types'
import { INTEREST_BY_ID, interestFor } from '../data/mock'

interface Props {
  friend: FriendEntry
  /** live presence entry when this friend is currently visible nearby */
  nearby: NearbyProfile | null
  onMessage: () => void
  onShowOnMap: () => void
  onAccept: () => void
  onDecline: () => void
  onRemove: () => void
  onBlock: () => void
  onClose: () => void
}

// Minimal user profile, opened from a friend's avatar/name. Deliberately
// small — the seam for a richer profile later (bio, mutuals, shared events).
export default function FriendProfileModal({
  friend,
  nearby,
  onMessage,
  onShowOnMap,
  onAccept,
  onDecline,
  onRemove,
  onBlock,
  onClose,
}: Props) {
  const avatar = friend.avatarEmoji ?? (friend.avatarUrl ? undefined : '👤')
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
              : 'Friend request pending'}
          {nearby && ` · ~${(nearby.distanceM / 1000).toFixed(1)} km away`}
        </p>

        {nearby?.vibe && (
          <p className="pc-vibe">
            ⚡ Tonight: {interestFor(nearby.vibe).emoji}{' '}
            <strong>{interestFor(nearby.vibe).label}</strong>
          </p>
        )}

        {friend.interests.length > 0 && (
          <div className="deep-interests">
            {friend.interests.slice(0, 6).map((i) => {
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

        <div className="composer-actions fp-actions">
          {friend.state === 'friend' && (
            <>
              {nearby && (
                <button className="btn-chat" onClick={onShowOnMap}>
                  📍 Show on map
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
        </div>

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

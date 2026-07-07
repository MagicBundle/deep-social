import type { ConnectTarget } from '../types'
import { INTEREST_BY_ID } from '../data/mock'

export type ConnectOutcome = 'sent' | 'connected' | 'error'

interface Props {
  target: ConnectTarget
  outcome: ConnectOutcome
  errorText?: string
  onMessage?: () => void
  onClose: () => void
}

const OUTCOME_LABEL: Record<ConnectOutcome, string> = {
  sent: 'Connection request sent',
  connected: "You're connected 🎉",
  error: 'Could not connect',
}

// Appears after scanning someone's QR: their full profile (sharing the QR is
// explicit consent), plus the result of the auto-sent connection request.
export default function DeepCard({ target, outcome, errorText, onMessage, onClose }: Props) {
  const avatar = target.avatarEmoji ?? (target.avatarUrl ? undefined : '👤')

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer deep-card" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="deep-avatar">
          {avatar ?? <img src={target.avatarUrl} alt="" referrerPolicy="no-referrer" />}
        </div>
        <h3 className="deep-name">{target.displayName}</h3>

        {target.interests.length > 0 && (
          <div className="deep-interests">
            {target.interests.map((i) => {
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

        <div className={`deep-status ${outcome}`}>
          {OUTCOME_LABEL[outcome]}
          {outcome === 'error' && errorText ? `: ${errorText}` : ''}
        </div>

        <div className="composer-actions">
          {outcome === 'connected' && onMessage && (
            <button className="btn-chat" onClick={onMessage}>
              💬 Message
            </button>
          )}
          <button className="btn-join" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

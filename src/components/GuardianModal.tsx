import { useState } from 'react'
import type { FriendEntry } from '../types'

interface Props {
  friends: FriendEntry[]
  onStart: (guardian: FriendEntry, minutes: number, note: string) => Promise<void>
  onClose: () => void
}

const DURATIONS = [
  { label: '1 h', min: 60 },
  { label: '2 h', min: 120 },
  { label: '4 h', min: 240 },
]

// Guardian mode: pick a friend to watch over you during a meetup. They can
// already see you precisely (friends bypass visibility); this adds the
// explicit ritual — a start message, an SOS button, and a check-in.
export default function GuardianModal({ friends, onStart, onClose }: Props) {
  const accepted = friends.filter((f) => f.state === 'friend')
  const [guardianId, setGuardianId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(120)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    const g = accepted.find((f) => f.userId === guardianId)
    if (!g) return
    setBusy(true)
    setError(null)
    try {
      await onStart(g, minutes, note.trim())
    } catch (e) {
      setBusy(false)
      setError((e as Error).message)
    }
  }

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer guardian-modal" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>🛡️ Guardian mode</h3>
        <p className="composer-sub">
          Meeting someone new? Pick a friend to watch over you. They'll see you live on the map,
          get a message when you start, and an alert if you don't check in.
        </p>
        <p className="guardian-disclaimer">
          ⚠️ Guardian is a convenience feature, not a safety guarantee. It depends on your phone's
          battery and signal and can be delayed or fail. Don't rely on it in an emergency — call
          your local emergency number (112 in the EU).
        </p>

        {accepted.length === 0 ? (
          <p className="empty-state">
            You need at least one accepted friend to use guardian mode. Add friends via search or
            the QR handshake first.
          </p>
        ) : (
          <>
            <label className="composer-label">Who watches over you?</label>
            {accepted.map((f) => (
              <div
                key={f.userId}
                className={`person-row clickable${guardianId === f.userId ? ' selected-guardian' : ''}`}
                onClick={() => setGuardianId(f.userId)}
                role="button"
              >
                <span className="row-emoji person">
                  {f.avatarEmoji ??
                    (f.avatarUrl ? (
                      <img className="row-avatar" src={f.avatarUrl} alt="" referrerPolicy="no-referrer" />
                    ) : (
                      '👤'
                    ))}
                </span>
                <span className="row-text">
                  <strong>{f.displayName}</strong>
                </span>
                {guardianId === f.userId && <span className="vis-check">✓</span>}
              </div>
            ))}

            <label className="composer-label">For how long?</label>
            <div className="composer-seg">
              {DURATIONS.map((d) => (
                <button
                  key={d.min}
                  className={minutes === d.min ? 'active' : ''}
                  onClick={() => setMinutes(d.min)}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <label className="composer-label" htmlFor="guardian-note">
              Where are you going? <span className="optional">(optional)</span>
            </label>
            <input
              id="guardian-note"
              className="composer-input"
              maxLength={200}
              placeholder="e.g. Coffee at Knopes with someone from the app"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            {error && <p className="login-status error">{error}</p>}

            <div className="composer-actions">
              <button className="btn-chat" onClick={onClose} disabled={busy}>
                Cancel
              </button>
              <button className="btn-join" disabled={!guardianId || busy} onClick={() => void start()}>
                {busy ? 'Starting…' : '🛡️ Start watching over me'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

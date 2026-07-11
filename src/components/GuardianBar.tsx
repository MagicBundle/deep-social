import { useState } from 'react'
import type { GuardianSession } from '../types'

interface Props {
  sessions: GuardianSession[]
  onSafe: (s: GuardianSession) => void
  onSOS: (s: GuardianSession) => void
  onLocate: (s: GuardianSession) => void
  onDismiss: (id: string) => void
}

const hhmm = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })

// Persistent pills over the map while guardian sessions are live: the
// protégé gets check-in/SOS controls; the guardian sees who they're
// watching, with escalating styling if the window expires or SOS fires.
export default function GuardianBar({ sessions, onSafe, onSOS, onLocate, onDismiss }: Props) {
  const [armed, setArmed] = useState(false)
  const now = Date.now()

  const mine = sessions.find((s) => s.role === 'protege' && s.status === 'active')
  const watching = sessions
    .filter((s) => s.role === 'guardian')
    .filter((s) => s.status === 'alarm' || s.status === 'active')
    .sort((a, b) => {
      const rank = (s: GuardianSession) =>
        s.status === 'alarm' ? 0 : new Date(s.endsAt).getTime() < now ? 1 : 2
      return rank(a) - rank(b)
    })[0]

  if (!mine && !watching) return null

  return (
    <div className="guardian-bar">
      {mine && (
        <div className="guardian-pill mine">
          🛡️ Guarded by {mine.otherName} until {hhmm(mine.endsAt)}
          <button className="gp-safe" onClick={() => onSafe(mine)}>
            ✓ I'm safe
          </button>
          <button
            className={`gp-sos${armed ? ' armed' : ''}`}
            onClick={() => {
              if (!armed) {
                setArmed(true)
                setTimeout(() => setArmed(false), 5000)
              } else {
                setArmed(false)
                onSOS(mine)
              }
            }}
          >
            {armed ? 'Tap again: SOS' : '🚨'}
          </button>
        </div>
      )}
      {watching && watching.status === 'alarm' && (
        <div className="guardian-pill alarm">
          🚨 {watching.otherName} triggered an alert!
          <button className="gp-safe" onClick={() => onLocate(watching)}>
            📍 Locate
          </button>
          <button className="gp-dismiss" onClick={() => onDismiss(watching.id)}>
            ✕
          </button>
        </div>
      )}
      {watching && watching.status === 'active' && new Date(watching.endsAt).getTime() < now && (
        <div className="guardian-pill overdue">
          ⚠️ {watching.otherName} hasn't checked in ({hhmm(watching.endsAt)})
          <button className="gp-safe" onClick={() => onLocate(watching)}>
            📍 Locate
          </button>
          <button className="gp-dismiss" onClick={() => onDismiss(watching.id)}>
            ✕
          </button>
        </div>
      )}
      {watching && watching.status === 'active' && new Date(watching.endsAt).getTime() >= now && (
        <div className="guardian-pill watching">
          🛡️ Watching over {watching.otherName} until {hhmm(watching.endsAt)}
          <button className="gp-safe" onClick={() => onLocate(watching)}>
            📍
          </button>
        </div>
      )}
    </div>
  )
}

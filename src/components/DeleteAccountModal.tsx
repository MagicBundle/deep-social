import { useState } from 'react'

interface Props {
  onConfirm: () => Promise<void>
  onClose: () => void
}

// App Store 5.1.1: in-app account deletion. Two-tap arming instead of
// type-to-confirm (kinder on mobile), with an explicit list of what goes.
export default function DeleteAccountModal({ onConfirm, onClose }: Props) {
  const [armed, setArmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const act = async () => {
    if (!armed) {
      setArmed(true)
      setTimeout(() => setArmed(false), 6000)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onConfirm()
    } catch (e) {
      setBusy(false)
      setArmed(false)
      setError((e as Error).message)
    }
  }

  return (
    <div className="composer-backdrop" onClick={busy ? undefined : onClose}>
      <div className="pin-composer delete-modal" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>🗑️ Delete your account</h3>
        <p className="composer-sub">
          This is permanent and takes effect immediately. It removes your profile, your event
          pins, your photos, your attendance, your friendships, and your messages. There is no
          undo.
        </p>

        {error && <p className="login-status error">{error}</p>}

        <div className="composer-actions">
          <button className="btn-chat" onClick={onClose} disabled={busy}>
            Keep my account
          </button>
          <button className={`btn-delete${armed ? ' armed' : ''}`} onClick={() => void act()} disabled={busy}>
            {busy ? 'Deleting…' : armed ? 'Tap again to permanently delete' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  )
}

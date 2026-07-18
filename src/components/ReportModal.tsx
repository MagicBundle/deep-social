import { useState } from 'react'

export interface ReportTarget {
  kind: 'media' | 'pin' | 'profile' | 'dm'
  targetId: string
  /** what the user sees they're reporting, e.g. a pin title or a name */
  label: string
}

interface Props {
  target: ReportTarget
  /** performs the actual report; throwing keeps the modal open */
  onSubmit: (reason: string) => Promise<void>
  onClose: () => void
}

const KIND_NOUN: Record<ReportTarget['kind'], string> = {
  media: 'this photo',
  pin: 'this event',
  profile: 'this person',
  dm: 'this conversation',
}

const REASONS = [
  'Illegal content',
  'Harassment or hate',
  'Sexual content involving minors',
  'Spam or scam',
  'Impersonation',
  'Other',
]

// DSA notice-and-action entry point, shared by every reportable surface.
// One tap-reason + optional detail; reports are reviewed within 24 h (the
// commitment made in the Terms of Use).
export default function ReportModal({ target, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState<string | null>(null)
  const [detail, setDetail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    try {
      const text = detail.trim() ? `${reason} — ${detail.trim()}` : reason
      await onSubmit(text.slice(0, 300))
      onClose()
    } catch (e) {
      console.warn('[report] failed:', e)
      setError('Could not send the report — please try again.')
      setBusy(false)
    }
  }

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer picker-modal" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>⚑ Report {KIND_NOUN[target.kind]}</h3>
        <p className="composer-sub">
          Reporting <strong>{target.label}</strong>. Reports are reviewed within 24 hours; the
          reported person is not told who reported them.
        </p>
        <div className="report-reasons">
          {REASONS.map((r) => (
            <button
              key={r}
              className={`chip${reason === r ? ' active' : ''}`}
              style={{ ['--c' as string]: '#f43f5e' }}
              onClick={() => setReason(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <textarea
          className="composer-input report-detail"
          rows={2}
          maxLength={240}
          placeholder="Anything that helps us act fast (optional)"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
        />
        {error && <p className="report-error">{error}</p>}
        <div className="name-edit-foot">
          <span className="name-count">{reason ? '' : 'Pick a reason'}</span>
          <button className="name-save report-send" disabled={!reason || busy} onClick={submit}>
            {busy ? 'Sending…' : 'Send report'}
          </button>
        </div>
      </div>
    </div>
  )
}

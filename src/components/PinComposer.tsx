import { useState } from 'react'
import { INTERESTS } from '../data/mock'

export interface PinFormValues {
  title: string
  category: string
  startsInMin: number
  durationMin: number
  description: string
}

interface Props {
  location: { lat: number; lng: number }
  live: boolean
  onCreate: (values: PinFormValues) => void
  onCancel: () => void
}

const START_OPTIONS = [
  { label: 'Now', min: 0 },
  { label: 'In 1 h', min: 60 },
  { label: 'In 3 h', min: 180 },
]

const DURATION_OPTIONS = [
  { label: '1 h', min: 60 },
  { label: '2 h', min: 120 },
  { label: '3 h', min: 180 },
]

export default function PinComposer({ location, live, onCreate, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [startsInMin, setStartsInMin] = useState(0)
  const [durationMin, setDurationMin] = useState(120)
  const [description, setDescription] = useState('')

  const valid = title.trim().length > 0 && category !== null

  const submit = () => {
    if (!valid) return
    onCreate({ title: title.trim(), category: category!, startsInMin, durationMin, description })
  }

  return (
    <div className="composer-backdrop" onClick={onCancel}>
      <div className="pin-composer" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onCancel} aria-label="Close">
          ×
        </button>
        <h3>📍 Pin your event</h3>
        <p className="composer-sub">
          At {location.lat.toFixed(4)}, {location.lng.toFixed(4)} ·{' '}
          {live ? 'visible to everyone on the live map' : 'local only (demo session)'}
        </p>

        <label className="composer-label">What kind of get-together?</label>
        <div className="composer-chips">
          {INTERESTS.map((i) => (
            <button
              key={i.id}
              className={`chip${category === i.id ? ' active' : ''}`}
              style={{ ['--c' as string]: i.color }}
              onClick={() => setCategory(i.id)}
            >
              {i.emoji} {i.label}
            </button>
          ))}
        </div>

        <label className="composer-label" htmlFor="pin-title">
          Call it something
        </label>
        <input
          id="pin-title"
          className="composer-input"
          value={title}
          maxLength={80}
          placeholder="e.g. Pétanque & picnic, all levels"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          autoFocus
        />

        <div className="composer-row">
          <div>
            <label className="composer-label">Starts</label>
            <div className="composer-seg">
              {START_OPTIONS.map((o) => (
                <button
                  key={o.min}
                  className={startsInMin === o.min ? 'active' : ''}
                  onClick={() => setStartsInMin(o.min)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="composer-label">For about</label>
            <div className="composer-seg">
              {DURATION_OPTIONS.map((o) => (
                <button
                  key={o.min}
                  className={durationMin === o.min ? 'active' : ''}
                  onClick={() => setDurationMin(o.min)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <label className="composer-label" htmlFor="pin-desc">
          Details <span className="optional">(optional)</span>
        </label>
        <textarea
          id="pin-desc"
          className="composer-input"
          rows={2}
          maxLength={500}
          placeholder="Meeting point, what to bring, who it's for…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="composer-actions">
          <button className="btn-chat" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn-join" disabled={!valid} onClick={submit}>
            Pin it 📍
          </button>
        </div>
      </div>
    </div>
  )
}

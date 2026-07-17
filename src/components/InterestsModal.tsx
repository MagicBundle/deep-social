import { INTERESTS } from '../data/mock'

interface Props {
  myInterests: string[]
  onToggle: (id: string) => void
  onClose: () => void
}

// The single home of "my interests" (feature A of the declutter): set them
// here, and Discover + the "You both" strips read them everywhere else.
// Saves on every toggle — no confirm step to forget. Toggles send one id;
// the parent owns list arithmetic (rapid taps must not clobber each other).
export default function InterestsModal({ myInterests, onToggle, onClose }: Props) {
  const mine = new Set(myInterests)

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer picker-modal" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>🎯 My interests</h3>
        <p className="composer-sub">
          These power Discover: people within 50 km who share one can find you — and you them.
        </p>
        <div className="interests-grid">
          {INTERESTS.map((i) => (
            <button
              key={i.id}
              className={`chip${mine.has(i.id) ? ' active' : ''}`}
              style={{ ['--c' as string]: i.color }}
              onClick={() => onToggle(i.id)}
            >
              {i.emoji} {i.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

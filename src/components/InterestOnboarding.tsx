import { useEffect, useRef } from 'react'
import { INTERESTS } from '../data/mock'

interface Props {
  myInterests: string[]
  onToggle: (id: string) => void
  onDone: () => void
}

// First-run interest picker, shown once right after a real sign-in when the
// profile has no interests yet. Discover matching is two-sided: without
// interests a new user is both undiscoverable and shown an empty Discover —
// the app's connective tissue never switches on. This bootstraps it.
//
// A11y: this modal is APP-initiated (not user-initiated), so it must be a
// real dialog — focus lands inside, Tab is trapped (the topbar underneath
// is visually hidden but would otherwise stay focusable), Escape skips.
export default function InterestOnboarding({ myInterests, onToggle, onDone }: Props) {
  const picked = myInterests.length
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    cardRef.current?.focus()
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onDone()
      return
    }
    if (e.key !== 'Tab') return
    // Trap Tab inside the card: without this, focus escapes to the app
    // beneath the backdrop (invisible but operable — incl. the menu).
    const focusables = Array.from(
      cardRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [],
    )
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === cardRef.current)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="composer-backdrop onboard-backdrop" onKeyDown={onKeyDown}>
      <div
        ref={cardRef}
        className="pin-composer picker-modal onboard-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ob-title"
        tabIndex={-1}
      >
        <h3 id="ob-title">What are you into?</h3>
        <p className="composer-sub">
          Pick at least one interest — they make you discoverable. While your location is on,
          people within 50&nbsp;km who share one can find you (as an anonymous dot by default),
          and you them. Change them anytime under 🎯 in your profile.
        </p>
        <div className="interests-grid">
          {INTERESTS.map((i) => (
            <button
              key={i.id}
              className={`chip${myInterests.includes(i.id) ? ' active' : ''}`}
              style={{ ['--c' as string]: i.color }}
              onClick={() => onToggle(i.id)}
            >
              {i.emoji} {i.label}
            </button>
          ))}
        </div>
        <button className="onboard-cta" disabled={picked === 0} onClick={onDone}>
          {picked === 0 ? 'Continue' : `Show me my city → (${picked} picked)`}
        </button>
        {/* Skip only while nothing is picked: chip taps persist immediately,
            so once you've picked, "skip" would be a lie — the CTA is the
            only honest exit. */}
        {picked === 0 && (
          <button className="onboard-skip" onClick={onDone}>
            Skip for now — just browsing
          </button>
        )}
      </div>
    </div>
  )
}

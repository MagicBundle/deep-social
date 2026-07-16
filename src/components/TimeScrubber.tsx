import type { SocialEvent } from '../types'

interface Props {
  offsetMin: number
  onChange: (min: number) => void
  events: SocialEvent[]
}

export const SCRUB_MAX_MIN = 720 // 12 h horizon — a night out, not a calendar

/** Is this event running at now + offset minutes? */
export function liveAtOffset(e: SocialEvent, offsetMin: number): boolean {
  return e.startsInMin <= offsetMin && e.startsInMin + e.durationMin > offsetMin
}

/** Already finished by now + offset minutes? */
export function overByOffset(e: SocialEvent, offsetMin: number): boolean {
  return e.startsInMin + e.durationMin <= offsetMin
}

const phaseEmoji = (d: Date) => {
  const h = d.getHours()
  if (h >= 5 && h < 11) return '🌅'
  if (h >= 11 && h < 17) return '☀️'
  if (h >= 17 && h < 22) return '🌆'
  return '🌙'
}

// The map's time machine: scrub forward through the next 12 hours to see
// which events will be on. Presence dots dim while scrubbed — people are
// only ever shown "now".
export default function TimeScrubber({ offsetMin, onChange, events }: Props) {
  const scrubbed = offsetMin > 0
  const at = new Date(Date.now() + offsetMin * 60_000)
  const timeLabel = scrubbed
    ? at.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : 'Now'
  const liveCount = events.filter((e) => liveAtOffset(e, offsetMin)).length

  return (
    <div className={`time-scrubber${scrubbed ? ' scrubbed' : ''}`}>
      <button
        className="ts-label"
        onClick={() => onChange(0)}
        disabled={!scrubbed}
        title={scrubbed ? 'Back to now' : undefined}
        aria-label={scrubbed ? `Showing ${timeLabel} — back to now` : 'Showing now'}
      >
        <span className="ts-phase">{phaseEmoji(at)}</span>
        <span className="ts-time">{timeLabel}</span>
        {scrubbed && <span className="ts-reset">×</span>}
      </button>
      <input
        type="range"
        className="ts-range"
        min={0}
        max={SCRUB_MAX_MIN}
        step={15}
        value={offsetMin}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Scrub map time up to 12 hours ahead"
      />
      <span className={`ts-live${liveCount > 0 ? ' on' : ''}`}>
        {liveCount > 0 ? `${liveCount} on` : 'quiet'}
      </span>
    </div>
  )
}

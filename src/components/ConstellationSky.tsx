import { useMemo } from 'react'
import type { HistoryEvent } from '../types'
import { interestFor } from '../data/mock'

interface Props {
  /** [monthKey, events] pairs; any order — the sky sorts chronologically */
  months: [string, HistoryEvent[]][]
  selectedId: string | null
  onPick: (h: HistoryEvent) => void
}

// ── deterministic layout ──────────────────────────────────────────────────
// The same history must draw the same sky every time — it's the user's own
// night sky, it shouldn't reshuffle between visits. Everything below is
// seeded from stable ids; nothing is stored.

const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/** mulberry32 PRNG — tiny, deterministic, good enough for star jitter */
const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Each month's figure gets a name from its dominant interest. */
const FIGURE_NAMES: Record<string, string> = {
  music: 'The Guitarist',
  running: 'The Runner',
  food: 'The Feast',
  tech: 'The Circuit',
  art: 'The Palette',
  football: 'The Striker',
  nightlife: 'The Mirror Ball',
  photo: 'The Lens',
  gaming: 'The Player',
  yoga: 'The Lotus',
}
const figureName = (events: HistoryEvent[]): string => {
  const counts = new Map<string, number>()
  for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return FIGURE_NAMES[top] ?? 'The Wanderer'
}

const monthShort = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

const CELL_W = 236
const CELL_H = 205
const VIEW_W = 720

interface Star {
  ev: HistoryEvent
  x: number
  y: number
  r: number
}

interface Figure {
  key: string
  name: string
  color: string
  label: string
  labelX: number
  labelY: number
  stars: Star[]
}

function buildFigures(months: [string, HistoryEvent[]][]): { figures: Figure[]; height: number } {
  const sorted = [...months].sort((a, b) => a[0].localeCompare(b[0]))
  const n = sorted.length
  const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3
  const rows = Math.ceil(n / cols)
  const height = rows * CELL_H + 30
  const gridW = cols * CELL_W
  const offsetX = (VIEW_W - gridW) / 2

  const figures = sorted.map(([key, events], i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const jitter = rng(hash(key))
    const cx = offsetX + col * CELL_W + CELL_W / 2 + (jitter() - 0.5) * 24
    const cy = row * CELL_H + CELL_H / 2 + (jitter() - 0.5) * 18 + 6

    const ordered = [...events].sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    const maxR = Math.min(CELL_W, CELL_H) / 2 - 34
    const stars: Star[] = ordered.map((ev, j) => {
      const r = rng(hash(ev.id))
      if (ordered.length === 1) {
        return { ev, x: cx + (r() - 0.5) * 30, y: cy + (r() - 0.5) * 30, r: 4 + r() * 1.5 }
      }
      // around a loose ellipse, in chronological order — an open, organic
      // connect-the-dots figure that never self-crosses badly
      const angle = -Math.PI / 2 + (j / ordered.length) * Math.PI * 2 + (r() - 0.5) * 0.7
      const rad = maxR * (0.55 + r() * 0.4)
      return {
        ev,
        x: cx + Math.cos(angle) * rad,
        y: cy + Math.sin(angle) * rad * 0.82,
        r: 3.2 + r() * 2.2,
      }
    })

    const dominant = interestFor(
      [...events].sort(
        (a, b) =>
          events.filter((e) => e.category === b.category).length -
          events.filter((e) => e.category === a.category).length,
      )[0].category,
    )

    return {
      key,
      name: figureName(events),
      color: dominant.color,
      label: monthShort(key),
      labelX: cx,
      labelY: cy + CELL_H / 2 - 14,
      stars,
    }
  })

  return { figures, height }
}

/** ~70 faint backdrop stars, fixed seed — depth, not data. */
function backdrop(height: number): { x: number; y: number; r: number; o: number }[] {
  const r = rng(20260716)
  return Array.from({ length: 70 }, () => ({
    x: r() * VIEW_W,
    y: r() * height,
    r: 0.5 + r() * 1.1,
    o: 0.12 + r() * 0.3,
  }))
}

// Months as constellations: each month's meetups become one connect-the-
// dots figure, named for its dominant interest. The sky fills as life in
// the city accumulates. Fully legible with zero animation by design.
export default function ConstellationSky({ months, selectedId, onPick }: Props) {
  const { figures, height } = useMemo(() => buildFigures(months), [months])
  const dust = useMemo(() => backdrop(height), [height])

  return (
    <svg
      className="sky"
      viewBox={`0 0 ${VIEW_W} ${height}`}
      role="img"
      aria-label={`Your constellation: ${figures.length} month${figures.length === 1 ? '' : 's'} of meetups drawn as star figures`}
    >
      {dust.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#fff" opacity={d.o} />
      ))}

      {figures.map((f) => (
        <g key={f.key}>
          {f.stars.length > 1 && (
            <polyline
              className="sky-line"
              points={f.stars.map((s) => `${s.x},${s.y}`).join(' ')}
              fill="none"
              stroke={f.color}
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          )}
          {f.stars.map((s) => {
            const c = interestFor(s.ev.category)
            const sel = s.ev.id === selectedId
            return (
              <g
                key={s.ev.id}
                className="sky-star"
                onClick={() => onPick(s.ev)}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${s.ev.title} · ${new Date(s.ev.startsAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}</title>
                {/* generous invisible hit area for fingers */}
                <circle cx={s.x} cy={s.y} r={16} fill="transparent" />
                <circle className="sky-halo" cx={s.x} cy={s.y} r={s.r * 2.8} fill={c.color} opacity="0.16" />
                <circle cx={s.x} cy={s.y} r={s.r} fill={c.color} />
                <circle cx={s.x} cy={s.y} r={s.r * 0.45} fill="#fff" opacity="0.9" />
                {sel && (
                  <circle
                    cx={s.x}
                    cy={s.y}
                    r={s.r + 6}
                    fill="none"
                    stroke="#fff"
                    strokeOpacity="0.85"
                    strokeWidth="1.3"
                    strokeDasharray="3 3"
                  />
                )}
              </g>
            )
          })}
          <text className="sky-name" x={f.labelX} y={f.labelY} textAnchor="middle" fill={f.color}>
            {f.name}
          </text>
          <text
            className="sky-month"
            x={f.labelX}
            y={f.labelY + 13}
            textAnchor="middle"
            fill="var(--muted)"
          >
            {f.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

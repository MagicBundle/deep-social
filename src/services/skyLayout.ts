import type { HistoryEvent } from '../types'
import { interestFor } from '../data/mock'

// ── deterministic constellation layout ────────────────────────────────────
// Shared by the in-app sky (ConstellationSky) and the shareable recap card
// (services/recap). The same history must draw the same sky every time —
// it's the user's own night sky, it shouldn't reshuffle between visits.
// Everything is seeded from stable ids; nothing is stored.

export const hash = (s: string) => {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

/** mulberry32 PRNG — tiny, deterministic, good enough for star jitter */
export const rng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) >>> 0
  let t = seed
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/** Each month's figure gets a name from its dominant interest. */
export const FIGURE_NAMES: Record<string, string> = {
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

export const figureName = (events: HistoryEvent[]): string => {
  const counts = new Map<string, number>()
  for (const e of events) counts.set(e.category, (counts.get(e.category) ?? 0) + 1)
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return FIGURE_NAMES[top] ?? 'The Wanderer'
}

export const monthShort = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

export const monthLong = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

export const CELL_W = 236
export const CELL_H = 205
export const VIEW_W = 720

export interface Star {
  ev: HistoryEvent
  x: number
  y: number
  r: number
}

export interface Figure {
  key: string
  name: string
  color: string
  label: string
  labelX: number
  labelY: number
  stars: Star[]
}

export function buildFigures(months: [string, HistoryEvent[]][]): {
  figures: Figure[]
  height: number
} {
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

/** Faint backdrop stars, fixed seed — depth, not data. */
export function backdrop(
  height: number,
  count = 70,
  width = VIEW_W,
): { x: number; y: number; r: number; o: number }[] {
  const r = rng(20260716)
  return Array.from({ length: count }, () => ({
    x: r() * width,
    y: r() * height,
    r: 0.5 + r() * 1.1,
    o: 0.12 + r() * 0.3,
  }))
}

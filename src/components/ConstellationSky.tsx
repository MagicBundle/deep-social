import { useMemo } from 'react'
import type { HistoryEvent } from '../types'
import { interestFor } from '../data/mock'
import { backdrop, buildFigures, VIEW_W } from '../services/skyLayout'

interface Props {
  /** [monthKey, events] pairs; any order — the sky sorts chronologically */
  months: [string, HistoryEvent[]][]
  selectedId: string | null
  onPick: (h: HistoryEvent) => void
}

// Months as constellations: each month's meetups become one connect-the-
// dots figure, named for its dominant interest. The sky fills as life in
// the city accumulates. Layout lives in services/skyLayout (shared with
// the recap card). Fully legible with zero animation by design.
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

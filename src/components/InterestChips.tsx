import { INTERESTS } from '../data/mock'

interface Props {
  filters: Set<string>
  onToggle: (id: string) => void
}

export default function InterestChips({ filters, onToggle }: Props) {
  return (
    <>
      {INTERESTS.map((i) => (
        <button
          key={i.id}
          className={`chip${filters.has(i.id) ? ' active' : ''}`}
          style={{ ['--c' as string]: i.color }}
          onClick={() => onToggle(i.id)}
        >
          {i.emoji} {i.label}
        </button>
      ))}
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { INTERESTS } from '../data/mock'
import { reverseGeocode, searchPlaces, type Place } from '../services/geocoding'

export interface PinFormValues {
  title: string
  category: string
  startsInMin: number
  durationMin: number
  description: string
  venue: string | null
}

interface Props {
  location: { lat: number; lng: number }
  live: boolean
  onLocationChange: (lat: number, lng: number) => void
  onCreate: (values: PinFormValues) => void
  onCancel: () => void
  onRepickOnMap: () => void
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

const SEARCH_DEBOUNCE_MS = 350

export default function PinComposer({
  location,
  live,
  onLocationChange,
  onCreate,
  onCancel,
  onRepickOnMap,
}: Props) {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [startsInMin, setStartsInMin] = useState(0)
  const [durationMin, setDurationMin] = useState(120)
  const [description, setDescription] = useState('')

  // Location naming: reverse-geocoded from the map click, replaceable via
  // address search (which also moves the draft pin).
  const [venue, setVenue] = useState<string | null>(null)
  const [resolving, setResolving] = useState(true)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    setResolving(true)
    reverseGeocode(location.lat, location.lng)
      .then((place) => {
        if (!cancelled) setVenue((v) => v ?? place?.label ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setResolving(false)
      })
    return () => {
      cancelled = true
    }
    // Only for the spot picked on the map; search picks set venue directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    abortRef.current?.abort()
    if (query.trim().length < 3) {
      setResults([])
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    const t = setTimeout(() => {
      searchPlaces(query, location, { signal: controller.signal })
        .then(setResults)
        .catch(() => {})
    }, SEARCH_DEBOUNCE_MS)
    return () => {
      clearTimeout(t)
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const pickPlace = (place: Place) => {
    setVenue(place.label)
    setQuery('')
    setResults([])
    onLocationChange(place.lat, place.lng)
  }

  const valid = title.trim().length > 0 && category !== null

  const submit = () => {
    if (!valid) return
    onCreate({
      title: title.trim(),
      category: category!,
      startsInMin,
      durationMin,
      description,
      venue,
    })
  }

  return (
    <div className="composer-backdrop" onClick={onCancel}>
      <div className="pin-composer" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onCancel} aria-label="Close">
          ×
        </button>
        <h3>📍 Pin your event</h3>
        <p className="composer-sub">
          {live ? 'Visible to everyone on the live map' : 'Local only (demo session)'}
        </p>

        <label className="composer-label" htmlFor="pin-where">
          Where
        </label>
        <div className="composer-where">
          <input
            id="pin-where"
            className="composer-input"
            value={query}
            placeholder="Search an address or place…"
            onChange={(e) => setQuery(e.target.value)}
          />
          {results.length > 0 && (
            <div className="where-results">
              {results.map((r, i) => (
                <button key={`${r.lat}-${r.lng}-${i}`} onClick={() => pickPlace(r)}>
                  <span className="where-emoji">📍</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="where-current">
          📍{' '}
          {venue ??
            (resolving
              ? 'Finding the address…'
              : `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`)}
          <button className="where-repick" onClick={onRepickOnMap}>
            pick on map instead
          </button>
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

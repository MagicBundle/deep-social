import { useEffect, useMemo, useState } from 'react'
import type { FriendEntry, HistoryEvent } from '../types'
import { interestFor } from '../data/mock'
import { myEventHistory, myMediaCount } from '../services/db'

interface Props {
  friends: FriendEntry[]
  onFlyTo: (lat: number, lng: number) => void
  onNotify: (text: string) => void
  onClose: () => void
}

const monthKey = (iso: string) => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
}

// Your city as memory: everything you've joined, everyone you've met,
// drawn from data the app already stores. Private — only your own rows.
export default function ConstellationModal({ friends, onFlyTo, onNotify, onClose }: Props) {
  const [history, setHistory] = useState<HistoryEvent[] | null>(null)
  const [photoCount, setPhotoCount] = useState(0)

  useEffect(() => {
    myEventHistory()
      .then(setHistory)
      .catch(() => {
        setHistory([])
        onNotify('Could not load your history')
      })
    myMediaCount()
      .then(setPhotoCount)
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const accepted = friends.filter((f) => f.state === 'friend')

  const months = useMemo(() => {
    const map = new Map<string, HistoryEvent[]>()
    for (const h of history ?? []) {
      const k = monthKey(h.startsAt)
      map.set(k, [...(map.get(k) ?? []), h])
    }
    return [...map.entries()]
  }, [history])

  const firstSeen = useMemo(() => {
    const dates = [
      ...(history ?? []).map((h) => h.joinedAt),
      ...accepted.map((f) => f.since),
    ].filter(Boolean)
    if (!dates.length) return null
    return new Date(dates.reduce((a, b) => (a < b ? a : b)))
  }, [history, accepted])

  const shareRecap = () => {
    const now = new Date()
    const k = monthKey(now.toISOString())
    const thisMonth = months.find(([m]) => m === k)?.[1].length ?? 0
    const text = `My ${now.toLocaleDateString(undefined, { month: 'long' })} on Deep Social 🌌 ${thisMonth} meetup${thisMonth === 1 ? '' : 's'}, ${accepted.length} friend${accepted.length === 1 ? '' : 's'}, ${photoCount} vibe photo${photoCount === 1 ? '' : 's'}.`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text).then(() => onNotify('Recap copied 🌌')).catch(() => {})
    }
  }

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer constellation" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>🌌 Your constellation</h3>
        <p className="composer-sub">
          Your city as memory — private, only you can see this.
          {firstSeen &&
            ` Here since ${firstSeen.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.`}
        </p>

        <div className="cons-stats">
          <div>
            <strong>{history?.length ?? '…'}</strong>
            <small>meetups</small>
          </div>
          <div>
            <strong>{accepted.length}</strong>
            <small>friends</small>
          </div>
          <div>
            <strong>{photoCount}</strong>
            <small>vibe photos</small>
          </div>
        </div>

        {history !== null && history.length === 0 ? (
          <p className="empty-state">
            Nothing here yet — join an event on the map and your constellation begins. ✨
          </p>
        ) : (
          months.map(([key, events]) => (
            <div key={key}>
              <div className="friend-section">{monthLabel(key)}</div>
              {events.map((h) => {
                const interest = interestFor(h.category)
                return (
                  <div key={h.id} className="person-row">
                    <span
                      className="row-emoji"
                      style={{ background: `${interest.color}22`, borderColor: interest.color }}
                    >
                      {interest.emoji}
                    </span>
                    <span className="row-text">
                      <strong>{h.title}</strong>
                      <small>
                        {new Date(h.startsAt).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'short',
                        })}
                        {h.venue ? ` · ${h.venue}` : ''}
                      </small>
                    </span>
                    <button
                      className="friend-chat"
                      title="Show on map"
                      onClick={() => onFlyTo(h.lat, h.lng)}
                    >
                      📍
                    </button>
                  </div>
                )
              })}
            </div>
          ))
        )}

        <div className="composer-actions">
          <button className="btn-chat" onClick={shareRecap}>
            📤 Share this month's recap
          </button>
        </div>
      </div>
    </div>
  )
}

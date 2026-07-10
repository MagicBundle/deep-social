import { useEffect, useState } from 'react'
import type { BlockedUser } from '../types'
import { myBlocks, unblockUser } from '../services/db'

interface Props {
  onNotify: (text: string) => void
  onClose: () => void
}

export default function BlockedUsersModal({ onNotify, onClose }: Props) {
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null)

  const load = () => {
    myBlocks()
      .then(setBlocked)
      .catch(() => {
        setBlocked([])
        onNotify('Could not load blocked users')
      })
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const unblock = (u: BlockedUser) => {
    unblockUser(u.userId)
      .then(() => {
        onNotify(`${u.displayName} unblocked`)
        load()
      })
      .catch(() => onNotify('Could not unblock, try again'))
  }

  return (
    <div className="composer-backdrop" onClick={onClose}>
      <div className="pin-composer blocked-modal" onClick={(e) => e.stopPropagation()}>
        <button className="card-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <h3>🚫 Blocked users</h3>
        <p className="composer-sub">
          Blocked people can't see you, find you, or contact you — and they aren't told.
        </p>

        {blocked === null ? (
          <p className="empty-state">Loading…</p>
        ) : blocked.length === 0 ? (
          <p className="empty-state">You haven't blocked anyone.</p>
        ) : (
          blocked.map((u) => (
            <div key={u.userId} className="person-row">
              <span className="row-emoji person">
                {u.avatarEmoji ??
                  (u.avatarUrl ? (
                    <img className="row-avatar" src={u.avatarUrl} alt="" referrerPolicy="no-referrer" />
                  ) : (
                    '👤'
                  ))}
              </span>
              <span className="row-text">
                <strong>{u.displayName}</strong>
                <small>blocked {new Date(u.since).toLocaleDateString()}</small>
              </span>
              <button className="btn-chat" onClick={() => unblock(u)}>
                Unblock
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

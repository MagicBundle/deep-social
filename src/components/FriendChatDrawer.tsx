import { useEffect, useRef, useState } from 'react'
import type { DirectMessage, FriendEntry } from '../types'
import { getConversation, markDmRead, sendDm, subscribeToDirectMessages } from '../services/db'

interface Props {
  friend: FriendEntry
  onReport: () => void
  onClose: () => void
}

export default function FriendChatDrawer({ friend, onReport, onClose }: Props) {
  const [messages, setMessages] = useState<DirectMessage[]>([])
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const load = () => {
    getConversation(friend.userId)
      .then((m) => {
        setMessages(m)
        void markDmRead(friend.userId)
      })
      .catch((e) => setError((e as Error).message))
  }

  // Reload on open and on any realtime DM event (RLS-scoped to this user).
  useEffect(() => {
    load()
    return subscribeToDirectMessages(load)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend.userId])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setError(null)
    // Optimistic append; realtime reload will reconcile with the server row.
    const optimistic: DirectMessage = {
      id: `tmp-${Date.now()}`,
      senderId: friend.userId, // placeholder; mine flag drives rendering
      body: text,
      createdAt: new Date().toISOString(),
      mine: true,
    }
    setMessages((prev) => [...prev, optimistic])
    try {
      await sendDm(friend.userId, text)
      load()
    } catch (e) {
      setError((e as Error).message)
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setDraft(text)
    }
  }

  const avatar = friend.avatarEmoji ?? (friend.avatarUrl ? undefined : '👤')

  return (
    <div className="chat-drawer">
      <div className="chat-head" style={{ ['--c' as string]: '#22d3ee' }}>
        <div className="dm-head">
          <span className="dm-avatar">
            {avatar ?? <img src={friend.avatarUrl} alt="" referrerPolicy="no-referrer" />}
          </span>
          <div>
            <strong>{friend.displayName}</strong>
            <small>Direct message · friends</small>
          </div>
        </div>
        <button
          className="dm-report"
          onClick={onReport}
          title="Report this conversation"
          aria-label="Report this conversation"
        >
          ⚑
        </button>
        <button className="card-close" onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </div>

      <div className="chat-list" ref={listRef}>
        {messages.length === 0 && !error && (
          <p className="dm-empty">Say hi to {friend.displayName} 👋</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg${m.mine ? ' mine' : ''}`}>
            <div className="chat-bubble">{m.body}</div>
          </div>
        ))}
      </div>

      {error && <p className="dm-error">{error}</p>}

      <div className="chat-input">
        <input
          value={draft}
          placeholder={`Message ${friend.displayName}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void send()}
        />
        <button onClick={() => void send()} aria-label="Send">
          ➤
        </button>
      </div>
    </div>
  )
}

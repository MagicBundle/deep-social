import { useEffect, useRef, useState } from 'react'
import type { ChatMessage, SocialEvent } from '../types'
import { INTEREST_BY_ID } from '../data/mock'

interface Props {
  event: SocialEvent
  messages: ChatMessage[]
  attendeeCount: number
  onSend: (text: string) => void
  onClose: () => void
}

export default function ChatDrawer({ event, messages, attendeeCount, onSend, onClose }: Props) {
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const interest = INTEREST_BY_ID[event.category]

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const send = () => {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  return (
    <div className="chat-drawer">
      <div className="chat-head" style={{ ['--c' as string]: interest.color }}>
        <div>
          <strong>
            {interest.emoji} {event.title}
          </strong>
          <small>{attendeeCount} in this meetup · interest chat</small>
        </div>
        <button className="card-close" onClick={onClose} aria-label="Close chat">
          ×
        </button>
      </div>

      <div className="chat-list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg${m.mine ? ' mine' : ''}`}>
            {!m.mine && <span className="chat-avatar">{m.avatar}</span>}
            <div className="chat-bubble">
              {!m.mine && (
                <small className="chat-author">
                  {m.authorName} <em className="demo-tag">demo</em>
                </small>
              )}
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="chat-input">
        <input
          value={draft}
          placeholder={`Message ${event.title}…`}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
        />
        <button onClick={send} aria-label="Send">
          ➤
        </button>
      </div>
    </div>
  )
}

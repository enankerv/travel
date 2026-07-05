'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { sendBoardChatMessage, ApiRequestError, type BoardChatMessage } from '@/lib/api'
import {
  dispatchScoutOptimisticDecrement,
  dispatchScoutOptimisticRefund,
} from './ScoutCredits'
import ScoutCreditCost from './ScoutCreditCost'

function ChatMessageBody({
  role,
  content,
}: {
  role: BoardChatMessage['role']
  content: string
}) {
  if (role === 'user') {
    return <div className="board-chat__message-body">{content}</div>
  }

  return (
    <div className="board-chat__message-body board-chat__markdown">
      <ReactMarkdown
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default function BoardChatPanel({ listId }: { listId: string }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<BoardChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending, open])

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return

    const userMessage: BoardChatMessage = { role: 'user', content: text }
    const history = messages
    setDraft('')
    setError('')
    setMessages((prev) => [...prev, userMessage])
    setSending(true)
    dispatchScoutOptimisticDecrement()

    try {
      const { reply } = await sendBoardChatMessage(listId, text, history)
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 402) {
        dispatchScoutOptimisticRefund()
        setError(err.message)
      } else {
        setError(
          err instanceof Error ? err.message : 'Failed to send message',
        )
      }
      setMessages((prev) => prev.slice(0, -1))
      setDraft(text)
    } finally {
      setSending(false)
    }
  }, [draft, listId, messages, sending])

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className={`board-chat${open ? ' board-chat--open' : ''}`}>
      {open ? (
        <div className="board-chat__panel" role="dialog" aria-label="Board chat">
          <div className="board-chat__header">
            <h3 className="board-chat__title">Chat</h3>
            <button
              type="button"
              className="board-chat__close"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>

          <div ref={scrollRef} className="board-chat__messages">
            {messages.length === 0 && !sending && (
              <p className="board-chat__empty">
                Ask about this trip — activities, logistics, ideas. History clears when
                you leave the board.
              </p>
            )}
            {messages.map((msg, i) => (
              <div
                key={`${msg.role}-${i}`}
                className={`board-chat__message board-chat__message--${msg.role}`}
              >
                <span className="board-chat__message-label">
                  {msg.role === 'user' ? 'You' : 'Assistant'}
                </span>
                <ChatMessageBody role={msg.role} content={msg.content} />
              </div>
            ))}
            {sending && (
              <div className="board-chat__message board-chat__message--assistant">
                <span className="board-chat__message-label">Assistant</span>
                <div className="board-chat__message-body board-chat__message-body--pending">
                  …
                </div>
              </div>
            )}
          </div>

          {error && <p className="board-chat__error">{error}</p>}

          <form
            className="board-chat__composer"
            onSubmit={(e) => {
              e.preventDefault()
              void send()
            }}
          >
            <div className="board-chat__composer-bar">
              <textarea
                ref={inputRef}
                className="board-chat__input"
                rows={2}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Message…"
                disabled={sending}
              />
              <ScoutCreditCost />
              <button
                type="submit"
                className="board-chat__send"
                disabled={sending || !draft.trim()}
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <button
          type="button"
          className="board-chat__toggle"
          onClick={() => setOpen(true)}
          aria-label="Open chat (1 scout credit per message)"
        >
          <span>Chat</span>
          <ScoutCreditCost />
        </button>
      )}
    </div>
  )
}

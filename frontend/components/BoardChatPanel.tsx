'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { createPoi, sendBoardChatMessage, ApiRequestError } from '@/lib/api'
import { useBoardContext } from '@/lib/BoardContext'
import {
  type BoardChatMessage,
  type BoardChatPoiSuggestion,
  randomBoardDropPosition,
  suggestionToPoiCreate,
} from '@/lib/boardChat'
import type { BoardPoi } from '@/lib/board'
import {
  dispatchScoutOptimisticDecrement,
  dispatchScoutOptimisticRefund,
} from './ScoutCredits'
import ScoutCreditCost from './ScoutCreditCost'
import ChatPoiSuggestionCard from './ChatPoiSuggestionCard'

function ChatMessageBody({ content }: { content: string }) {
  if (!content.trim()) return null

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

function historyForApi(messages: BoardChatMessage[]) {
  return messages.map(({ role, content }) => ({ role, content }))
}

export default function BoardChatPanel({ listId }: { listId: string }) {
  const { setPois, setError } = useBoardContext()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<BoardChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
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

  const saveSuggestion = useCallback(
    async (messageIndex: number, suggestionIndex: number, suggestion: BoardChatPoiSuggestion) => {
      const key = `${messageIndex}:${suggestionIndex}`
      setSavingKey(key)
      const { board_x, board_y } = randomBoardDropPosition()
      try {
        const poi = await createPoi(listId, suggestionToPoiCreate(suggestion, board_x, board_y))
        setPois((prev) => {
          if (prev.some((p) => p.id === poi.id)) return prev
          return [...prev, { ...poi, comments: [], votes: [] } as BoardPoi]
        })
        setMessages((prev) =>
          prev.map((msg, i) => {
            if (i !== messageIndex || msg.role !== 'assistant') return msg
            const saved = new Set(msg.savedSuggestionIndexes ?? [])
            saved.add(suggestionIndex)
            return { ...msg, savedSuggestionIndexes: [...saved] }
          }),
        )
      } catch {
        setError('Failed to add suggestion to board')
      } finally {
        setSavingKey(null)
      }
    },
    [listId, setPois, setError],
  )

  const send = useCallback(async () => {
    const text = draft.trim()
    if (!text || sending) return

    const userMessage: BoardChatMessage = { role: 'user', content: text }
    const history = messages
    setDraft('')
    setChatError('')
    setMessages((prev) => [...prev, userMessage])
    setSending(true)
    dispatchScoutOptimisticDecrement()

    try {
      const { reply, suggestions } = await sendBoardChatMessage(
        listId,
        text,
        historyForApi(history),
      )
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: reply,
          suggestions: suggestions.length > 0 ? suggestions : undefined,
          savedSuggestionIndexes: [],
        },
      ])
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 402) {
        dispatchScoutOptimisticRefund()
        setChatError(err.message)
      } else {
        setChatError(
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
                Ask about this trip — activities, logistics, ideas. Suggested places
                appear as polaroids you can add to the board. History clears when you
                leave.
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
                {msg.role === 'user' ? (
                  <div className="board-chat__message-body">{msg.content}</div>
                ) : (
                  <>
                    <ChatMessageBody content={msg.content} />
                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="board-chat__suggestions">
                        {msg.suggestions.map((suggestion, suggestionIndex) => {
                          const saved = msg.savedSuggestionIndexes?.includes(suggestionIndex)
                          const key = `${i}:${suggestionIndex}`
                          return (
                            <ChatPoiSuggestionCard
                              key={key}
                              suggestion={suggestion}
                              saved={saved}
                              saving={savingKey === key}
                              onSave={() =>
                                void saveSuggestion(i, suggestionIndex, suggestion)
                              }
                            />
                          )
                        })}
                      </div>
                    )}
                  </>
                )}
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

          {chatError && <p className="board-chat__error">{chatError}</p>}

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

'use client'

import type { KeyboardEvent, RefObject } from 'react'
import ReactMarkdown from 'react-markdown'
import type { BoardChatPoiSuggestion } from '@/lib/boardChat'
import type { BoardChatMessage } from '@/lib/boardChat'
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

export default function BoardChatBody({
  messagesClassName,
  composerClassName,
  messages,
  sending,
  chatError,
  draft,
  setDraft,
  savingKey,
  scrollRef,
  inputRef,
  send,
  saveSuggestion,
  onKeyDown,
}: {
  messagesClassName: string
  composerClassName: string
  messages: BoardChatMessage[]
  sending: boolean
  chatError: string
  draft: string
  setDraft: (value: string) => void
  savingKey: string | null
  scrollRef: RefObject<HTMLDivElement>
  inputRef: RefObject<HTMLTextAreaElement>
  send: () => void | Promise<void>
  saveSuggestion: (
    messageIndex: number,
    suggestionIndex: number,
    suggestion: BoardChatPoiSuggestion,
  ) => void | Promise<void>
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void
}) {
  return (
    <>
      <div ref={scrollRef} className={messagesClassName}>
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
        className={composerClassName}
        onSubmit={(e) => {
          e.preventDefault()
          void send()
        }}
      >
        <div className="board-chat__composer-bar">
          <textarea
            ref={inputRef}
            className="board-chat__input"
            rows={3}
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
    </>
  )
}

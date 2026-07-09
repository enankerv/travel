'use client'

import { useEffect } from 'react'
import type { useBoardChat } from '@/hooks/useBoardChat'
import BoardChatBody from './BoardChatBody'

type BoardChatState = ReturnType<typeof useBoardChat>

export default function BoardChatSheet({
  chat,
  onClose,
}: {
  chat: BoardChatState
  onClose: () => void
}) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  return (
    <div className="board-chat-sheet" role="dialog" aria-modal="true" aria-label="Board chat">
      <div
        className="board-chat-sheet__backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="board-chat-sheet__panel">
        <div className="board-chat-sheet__header">
          <h2 className="board-chat-sheet__title">Chat</h2>
          <button
            type="button"
            className="board-chat-sheet__close"
            onClick={onClose}
            aria-label="Close chat"
          >
            ×
          </button>
        </div>
        <BoardChatBody
          {...chat}
          messagesClassName="board-chat-sheet__messages"
          composerClassName="board-chat-sheet__composer"
        />
      </div>
    </div>
  )
}

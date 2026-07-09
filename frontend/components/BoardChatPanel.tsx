'use client'

import type { useBoardChat } from '@/hooks/useBoardChat'
import BoardChatBody from './BoardChatBody'

type BoardChatState = ReturnType<typeof useBoardChat>

export default function BoardChatPanel({
  chat,
  onClose,
}: {
  chat: BoardChatState
  onClose: () => void
}) {
  return (
    <div className="board-chat-sidebar" role="dialog" aria-label="Board chat">
      <div className="board-chat-sidebar__header">
        <h3 className="board-chat-sidebar__title">Chat</h3>
        <button
          type="button"
          className="board-chat-sidebar__close"
          onClick={onClose}
          aria-label="Close chat"
        >
          ×
        </button>
      </div>
      <BoardChatBody
        {...chat}
        messagesClassName="board-chat-sidebar__messages"
        composerClassName="board-chat-sidebar__composer"
      />
    </div>
  )
}

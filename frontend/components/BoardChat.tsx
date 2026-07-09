'use client'

import { useBoardChat } from '@/hooks/useBoardChat'
import { useIsMobile } from '@/hooks/useIsMobile'
import BoardChatPanel from './BoardChatPanel'
import BoardChatSheet from './BoardChatSheet'

export default function BoardChat({
  listId,
  isOpen,
  onClose,
  onSendingChange,
}: {
  listId: string
  isOpen: boolean
  onClose: () => void
  onSendingChange?: (sending: boolean) => void
}) {
  const isMobile = useIsMobile()
  const chat = useBoardChat({ listId, isOpen, onSendingChange })

  if (!isOpen) return null

  if (isMobile) {
    return <BoardChatSheet chat={chat} onClose={onClose} />
  }

  return <BoardChatPanel chat={chat} onClose={onClose} />
}

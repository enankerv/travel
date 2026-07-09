'use client'

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'
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
} from '@/components/ScoutCredits'

function historyForApi(messages: BoardChatMessage[]) {
  return messages.map(({ role, content }) => ({ role, content }))
}

export function useBoardChat({
  listId,
  isOpen,
  onSendingChange,
}: {
  listId: string
  isOpen: boolean
  onSendingChange?: (sending: boolean) => void
}) {
  const { setPois, setError } = useBoardContext()
  const [messages, setMessages] = useState<BoardChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!isOpen) return
    inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, sending, isOpen])

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

  useEffect(() => {
    onSendingChange?.(sending)
  }, [sending, onSendingChange])

  useEffect(() => {
    if (!isOpen) onSendingChange?.(false)
  }, [isOpen, onSendingChange])

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

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  return {
    messages,
    draft,
    setDraft,
    sending,
    chatError,
    savingKey,
    scrollRef,
    inputRef,
    send,
    saveSuggestion,
    onKeyDown,
  }
}

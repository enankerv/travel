'use client'

import { useCallback, useEffect, useState } from 'react'
import { getListMembers } from '@/lib/api'
import Modal from './Modal'
import ListMembersTab from './ListMembersTab'

export default function ListMembersModal({
  isOpen,
  onClose,
  listId,
  currentUserId,
  onLeaveList,
  onError,
  onMembersUpdated,
}: {
  isOpen: boolean
  onClose: () => void
  listId: string
  currentUserId: string | undefined
  onLeaveList: () => void
  onError: (message: string) => void
  onMembersUpdated?: (members: any[]) => void
}) {
  const [members, setMembers] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadMembers = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await getListMembers(listId)
      const rows = data?.members || []
      setMembers(rows)
      onMembersUpdated?.(rows)
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load members')
    } finally {
      setIsLoading(false)
    }
  }, [listId, onError, onMembersUpdated])

  useEffect(() => {
    if (!isOpen) return
    void loadMembers()
  }, [isOpen, loadMembers])

  return (
    <Modal open={isOpen} onClose={onClose} width="520px">
      <div className="list-members-modal">
        <div className="list-members-modal__header">
          <h2 className="list-members-modal__title">
            Members{!isLoading || members.length > 0 ? ` (${members.length})` : ''}
          </h2>
          <button
            type="button"
            className="list-members-modal__close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {isLoading && members.length === 0 ? (
          <p className="list-members-modal__loading">Loading members…</p>
        ) : (
          <ListMembersTab
            listId={listId}
            members={members}
            currentUserId={currentUserId}
            onBack={onLeaveList}
            onError={onError}
            onMembersChanged={() => void loadMembers()}
          />
        )}
      </div>
    </Modal>
  )
}

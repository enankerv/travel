'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getList } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useListPresence, type PresenceUser } from '@/lib/realtime'
import { activeViewFromPathname } from '@/lib/listRoutes'
import { ListScreenShellProvider, useListScreenShell } from '@/lib/ListScreenShellContext'
import ListScreenChrome from './ListScreenChrome'
import ListMembersModal from './ListMembersModal'
import ListPlacesProvider from './ListPlacesProvider'
import LoadingView from './LoadingView'

export default function ListScreenShell({
  listId,
  children,
}: {
  listId: string
  children: ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()
  const activeView = activeViewFromPathname(pathname, listId)

  const [listName, setListName] = useState('')
  const [memberCount, setMemberCount] = useState(0)
  const [membersOpen, setMembersOpen] = useState(false)
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([])
  const [chromeFooter, setChromeFooter] = useState<ReactNode>(null)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    void getList(listId)
      .then((list) => {
        if (cancelled) return
        setListName(list.name)
        setMemberCount(list.member_count ?? 0)
        setListError('')
      })
      .catch(() => {
        if (cancelled) return
        setListError('Failed to load list')
      })
      .finally(() => {
        if (!cancelled) setListLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [listId])

  useListPresence({
    listId,
    enabled: !listLoading && !!user,
    user,
    onUsersChange: setViewingUsers,
  })

  const otherViewers = viewingUsers.filter((u) => u.user_id !== user?.id)

  const updateMemberCount = useCallback((members: any[]) => {
    setMemberCount(members.length)
  }, [])

  const onBack = useCallback(() => {
    router.push('/')
  }, [router])

  if (listLoading) {
    return <LoadingView message="Loading list…" />
  }

  if (listError) {
    return (
      <div className="list-villas-tab__error" style={{ margin: '2rem' }}>
        <span>{listError}</span>
      </div>
    )
  }

  const shellValue = {
    listId,
    listName,
    activeView,
    otherViewers,
    memberCount,
    updateMemberCount,
    openMembers: () => setMembersOpen(true),
    chromeFooter,
    setChromeFooter,
    onBack,
  }

  return (
    <ListScreenShellProvider value={shellValue}>
      {activeView === 'board' ? (
        children
      ) : (
        <ListPlacesProvider listId={listId} listName={listName}>
          <div className="list-detail-scroll">
            <ListScreenChrome
              listId={listId}
              listName={listName}
              otherViewers={otherViewers}
              activeView={activeView}
              onBack={onBack}
              memberCount={memberCount}
              onMembersClick={() => setMembersOpen(true)}
            >
              {chromeFooter}
            </ListScreenChrome>
            {children}
          </div>
        </ListPlacesProvider>
      )}

      <ListMembersModal
        isOpen={membersOpen}
        onClose={() => setMembersOpen(false)}
        listId={listId}
        currentUserId={user?.id}
        onLeaveList={onBack}
        onError={setListError}
        onMembersUpdated={updateMemberCount}
      />
    </ListScreenShellProvider>
  )
}

export function ListScreenHeader({
  variant = 'page',
  subheaderRight,
  children,
}: {
  variant?: 'page' | 'overlay'
  subheaderRight?: ReactNode
  children?: ReactNode
}) {
  const {
    listId,
    listName,
    activeView,
    otherViewers,
    memberCount,
    openMembers,
    onBack,
  } = useListScreenShell()

  return (
    <ListScreenChrome
      listId={listId}
      listName={listName}
      otherViewers={otherViewers}
      activeView={activeView}
      variant={variant}
      onBack={onBack}
      memberCount={memberCount}
      onMembersClick={openMembers}
      subheaderRight={subheaderRight}
    >
      {children}
    </ListScreenChrome>
  )
}

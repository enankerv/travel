'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { getList, getListMembers } from '@/lib/api'
import { useAuth } from '@/lib/AuthContext'
import { useListPresence, type PresenceUser } from '@/lib/realtime'
import { activeViewFromPathname } from '@/lib/listRoutes'
import { ListScreenShellProvider } from '@/lib/ListScreenShellContext'
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
  const isBoard = activeView === 'board'

  const [listName, setListName] = useState('')
  const [memberCount, setMemberCount] = useState(0)
  const [membersOpen, setMembersOpen] = useState(false)
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([])
  const [chromeBoardRow, setChromeBoardRow] = useState<ReactNode>(null)
  const [chromeOverlayHidden, setChromeOverlayHidden] = useState(false)
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState('')

  useEffect(() => {
    let cancelled = false
    setListLoading(true)
    void Promise.all([getList(listId), getListMembers(listId)])
      .then(([list, membersData]) => {
        if (cancelled) return
        setListName(list.name)
        setMemberCount((membersData?.members || []).length)
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

  useEffect(() => {
    if (!isBoard) {
      setChromeBoardRow(null)
      setChromeOverlayHidden(false)
    }
  }, [isBoard])

  useEffect(() => {
    if (!isBoard) return
    document.body.classList.add('board-screen-active')
    return () => document.body.classList.remove('board-screen-active')
  }, [isBoard])

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
    chromeBoardRow,
    setChromeBoardRow,
    chromeOverlayHidden,
    setChromeOverlayHidden,
    onBack,
  }

  const chromeWrapClass = [
    'list-screen-chrome-wrap',
    isBoard ? 'list-screen-chrome-wrap--overlay' : 'list-screen-chrome-wrap--page',
    !isBoard && chromeOverlayHidden ? 'list-screen-chrome-wrap--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const boardTopClass = [
    'list-board-top',
    isBoard && chromeOverlayHidden ? 'list-board-top--hidden' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const chrome = (
    <ListScreenChrome
      listId={listId}
      listName={listName}
      activeView={activeView}
      variant={isBoard ? 'overlay' : 'page'}
      onBack={onBack}
      memberCount={memberCount}
      onMembersClick={() => setMembersOpen(true)}
    />
  )

  const detailScrollClass = [
    'list-detail-scroll',
    activeView === 'map' ? 'list-detail-scroll--map' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const detailViewClass = [
    'app-detail-view',
    activeView === 'map' ? 'app-detail-view--map' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <ListScreenShellProvider value={shellValue}>
      <ListPlacesProvider listId={listId} listName={listName}>
        {isBoard ? (
          <div className="list-screen-shell list-screen-shell--board">
            <div className={boardTopClass}>
              <div className={chromeWrapClass}>{chrome}</div>
              {chromeBoardRow != null && (
                <div className="list-board-top__row">{chromeBoardRow}</div>
              )}
            </div>
            {children}
          </div>
        ) : (
          <div className={detailViewClass}>
            <div className={detailScrollClass}>
              <div className={chromeWrapClass}>{chrome}</div>
              {children}
            </div>
          </div>
        )}
      </ListPlacesProvider>

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

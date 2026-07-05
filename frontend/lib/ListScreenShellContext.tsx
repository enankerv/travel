'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { ListView } from '@/lib/listRoutes'

export type ListScreenShellContextValue = {
  listId: string
  listName: string
  activeView: ListView
  otherViewers: import('@/lib/realtime').PresenceUser[]
  memberCount: number
  updateMemberCount: (members: any[]) => void
  openMembers: () => void
  chromeSubheaderRight: ReactNode
  setChromeSubheaderRight: (node: ReactNode) => void
  chromeOverlayHidden: boolean
  setChromeOverlayHidden: (hidden: boolean) => void
  onBack: () => void
}

const ListScreenShellContext = createContext<ListScreenShellContextValue | null>(null)

export function ListScreenShellProvider({
  value,
  children,
}: {
  value: ListScreenShellContextValue
  children: ReactNode
}) {
  return (
    <ListScreenShellContext.Provider value={value}>
      {children}
    </ListScreenShellContext.Provider>
  )
}

export function useListScreenShell(): ListScreenShellContextValue {
  const ctx = useContext(ListScreenShellContext)
  if (!ctx) {
    throw new Error('useListScreenShell must be used within ListScreenShell')
  }
  return ctx
}

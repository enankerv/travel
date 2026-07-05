'use client'

import ListScreenShell from '@/components/ListScreenShell'

export default function ListIdLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { listId: string }
}) {
  return <ListScreenShell listId={params.listId}>{children}</ListScreenShell>
}

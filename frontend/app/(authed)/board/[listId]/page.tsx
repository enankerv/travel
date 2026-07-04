'use client'

import ListBoardScreen from '@/components/ListBoardScreen'

export default function BoardPage({ params }: { params: { listId: string } }) {
  return <ListBoardScreen listId={params.listId} />
}

export type ListView = 'list' | 'map' | 'board'

export function listViewHref(listId: string, view: ListView): string {
  if (view === 'board') return `/list/${listId}/board`
  if (view === 'map') return `/list/${listId}/map`
  return `/list/${listId}`
}

export function activeViewFromPathname(pathname: string, listId: string): ListView {
  const base = `/list/${listId}`
  if (pathname === `${base}/board` || pathname.startsWith(`${base}/board/`)) {
    return 'board'
  }
  if (pathname === `${base}/map` || pathname.startsWith(`${base}/map/`)) {
    return 'map'
  }
  return 'list'
}

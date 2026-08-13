/** Comment threading helpers. */
import type { CommentRecord } from './api'

export type CommentThread = {
  comment: CommentRecord
  replies: CommentThread[]
}

export function commentAuthorLabel(comment: CommentRecord) {
  return comment.first_name?.trim() || 'Anonymous'
}

/** First-name handle used for locked @mentions in replies. */
export function commentMentionHandle(comment: CommentRecord) {
  const label = commentAuthorLabel(comment)
  return label.split(/\s+/)[0] || 'Anonymous'
}

export function nestCommentThreads(comments: CommentRecord[]): CommentThread[] {
  const ids = new Set(comments.map((c) => c.id))
  const byParent = new Map<string | null, CommentRecord[]>()
  for (const comment of comments) {
    const parentId =
      comment.replying_to && ids.has(comment.replying_to)
        ? comment.replying_to
        : null
    const list = byParent.get(parentId) ?? []
    list.push(comment)
    byParent.set(parentId, list)
  }

  function build(parentId: string | null): CommentThread[] {
    return (byParent.get(parentId) ?? []).map((comment) => ({
      comment,
      replies: build(comment.id),
    }))
  }

  return build(null)
}

export function withoutCommentTree(
  comments: CommentRecord[],
  commentId: string,
): CommentRecord[] {
  const remove = new Set<string>([commentId])
  let grew = true
  while (grew) {
    grew = false
    for (const comment of comments) {
      if (
        comment.replying_to &&
        remove.has(comment.replying_to) &&
        !remove.has(comment.id)
      ) {
        remove.add(comment.id)
        grew = true
      }
    }
  }
  return comments.filter((comment) => !remove.has(comment.id))
}

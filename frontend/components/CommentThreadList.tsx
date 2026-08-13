'use client'

import { useMemo, useState } from 'react'
import type { CommentRecord } from '@/lib/api'
import {
  commentAuthorLabel,
  commentMentionHandle,
  nestCommentThreads,
  type CommentThread,
} from '@/lib/comments'

function formatCommentDate(s: string) {
  const d = new Date(s)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

function CommentMention({ comment }: { comment: CommentRecord }) {
  return (
    <span className="comment-thread__mention">
      @{commentMentionHandle(comment)}
    </span>
  )
}

export default function CommentThreadList({
  comments,
  currentUserId,
  saving,
  onReply,
  onUpdate,
  onDelete,
}: {
  comments: CommentRecord[]
  currentUserId?: string
  saving: boolean
  onReply: (parent: CommentRecord, body: string) => Promise<void>
  onUpdate: (commentId: string, body: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
}) {
  const threads = useMemo(() => nestCommentThreads(comments), [comments])
  const byId = useMemo(
    () => new Map(comments.map((c) => [c.id, c])),
    [comments],
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [replyingToId, setReplyingToId] = useState<string | null>(null)
  const [replyBody, setReplyBody] = useState('')

  async function handleSave(commentId: string) {
    const trimmed = editBody.trim()
    if (!trimmed) return
    await onUpdate(commentId, trimmed)
    setEditingId(null)
    setEditBody('')
  }

  async function handleReply(parent: CommentRecord) {
    const trimmed = replyBody.trim()
    if (!trimmed) return
    await onReply(parent, trimmed)
    setReplyingToId(null)
    setReplyBody('')
  }

  function renderThread(thread: CommentThread) {
    const comment = thread.comment
    const parent = comment.replying_to
      ? byId.get(comment.replying_to)
      : undefined
    const isEditing = editingId === comment.id
    const isReplying = replyingToId === comment.id

    return (
      <div key={comment.id} className="comment-thread__item">
        <article
          className={
            parent
              ? 'comment-thread__comment comment-thread__comment--reply'
              : 'comment-thread__comment'
          }
        >
          <header className="comment-thread__header">
            <span className="comment-thread__author">
              {commentAuthorLabel(comment)}
            </span>
            <span className="comment-thread__date">
              {formatCommentDate(comment.created_at)}
            </span>
            <div className="comment-thread__actions">
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSave(comment.id)}
                    disabled={saving}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null)
                      setEditBody('')
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingToId(comment.id)
                      setReplyBody('')
                      setEditingId(null)
                    }}
                  >
                    Reply
                  </button>
                  {currentUserId === comment.user_id && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(comment.id)
                          setEditBody(comment.body)
                          setReplyingToId(null)
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDelete(comment.id)}
                        disabled={saving}
                        className="comment-thread__delete"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          </header>
          {isEditing ? (
            <textarea
              value={editBody}
              onChange={(e) => setEditBody(e.target.value)}
              className="comment-thread__input"
              rows={3}
              autoFocus
            />
          ) : (
            <p className="comment-thread__body">
              {parent && <CommentMention comment={parent} />}
              {comment.body}
            </p>
          )}
          {isReplying && (
            <div className="comment-thread__reply-form">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                className="comment-thread__input"
                rows={2}
                autoFocus
              />
              <div className="comment-thread__reply-actions">
                <button
                  type="button"
                  onClick={() => void handleReply(comment)}
                  disabled={!replyBody.trim() || saving}
                >
                  Reply
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setReplyingToId(null)
                    setReplyBody('')
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </article>
        {thread.replies.length > 0 && (
          <div className="comment-thread__replies">
            {thread.replies.map(renderThread)}
          </div>
        )}
      </div>
    )
  }

  if (threads.length === 0) return null

  return <div className="comment-thread">{threads.map(renderThread)}</div>
}

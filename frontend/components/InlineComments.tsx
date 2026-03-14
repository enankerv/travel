"use client";

import { useState } from "react";
import {
  createComment,
  updateComment,
  deleteComment,
  type CommentRecord,
} from "@/lib/api";
import { useListDetailContext } from "@/lib/ListDetailContext";

export default function InlineComments({
  getawayId,
}: {
  getawayId: string;
}) {
  const {
    list,
    commentsByGetaway,
    setCommentsByGetaway,
    currentUserId,
    isListMember,
  } = useListDetailContext();

  const [newCommentBody, setNewCommentBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [saving, setSaving] = useState(false);

  const comments = (commentsByGetaway?.[getawayId] || []) as CommentRecord[];

  function formatDate(s: string) {
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  async function handleAddComment() {
    const body = newCommentBody.trim();
    if (!body || !isListMember) return;
    setSaving(true);
    try {
      await createComment(list.id, getawayId, body);
      setNewCommentBody("");
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateComment(commentId: string, body: string) {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const { comment } = await updateComment(list.id, commentId, trimmed);
      setCommentsByGetaway((prev: Record<string, CommentRecord[]>) => {
        const next = { ...prev };
        for (const gid of Object.keys(next)) {
          next[gid] = next[gid].map((c) =>
            c.id === commentId ? { ...c, ...comment } : c
          );
        }
        return next;
      });
      setEditingId(null);
      setEditBody("");
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteComment(commentId: string) {
    if (!confirm("Delete this comment?")) return;
    setSaving(true);
    try {
      await deleteComment(list.id, commentId);
      setCommentsByGetaway((prev: Record<string, CommentRecord[]>) => {
        const next = { ...prev };
        next[getawayId] = (next[getawayId] || []).filter((c) => c.id !== commentId);
        return next;
      });
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  }

  if (!isListMember) {
    return (
      <div className="inline-comments">
        <h4>Comments</h4>
        <p className="inline-comments__muted">Sign in to view comments.</p>
      </div>
    );
  }

  return (
    <div className="inline-comments">
      <h4>Comments</h4>

      <div className="inline-comments__list">
        {comments.map((c) => (
          <div key={c.id} className="inline-comments__comment">
            <div className="inline-comments__comment-header">
              <span className="inline-comments__comment-author">
                {c.first_name || "Anonymous"}
              </span>
              <span className="inline-comments__comment-date">
                {formatDate(c.created_at)}
              </span>
              {currentUserId === c.user_id && (
                <div className="inline-comments__comment-actions">
                  {editingId === c.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleUpdateComment(c.id, editBody)}
                        disabled={saving}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditBody("");
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
                          setEditingId(c.id);
                          setEditBody(c.body);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(c.id)}
                        disabled={saving}
                        className="inline-comments__delete"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {editingId === c.id ? (
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                className="inline-comments__input"
                rows={3}
                autoFocus
              />
            ) : (
              <p className="inline-comments__comment-body">{c.body}</p>
            )}
          </div>
        ))}
      </div>

      <div className="inline-comments__add">
        <textarea
          value={newCommentBody}
          onChange={(e) => setNewCommentBody(e.target.value)}
          placeholder="Add a comment..."
          className="inline-comments__input"
          rows={3}
        />
        <button
          type="button"
          onClick={handleAddComment}
          disabled={!newCommentBody.trim() || saving}
          className="inline-comments__add-btn"
        >
          Add
        </button>
      </div>
    </div>
  );
}

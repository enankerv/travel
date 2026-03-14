"use client";

import { useState, useEffect, useRef } from "react";
import {
  getListComments,
  createComment,
  updateComment,
  deleteComment,
  type CommentRecord,
} from "@/lib/api";
import { useListDetailContext } from "@/lib/ListDetailContext";

type CommentsByGetaway = Record<string, CommentRecord[]>;

export default function CommentsSidebar({
  isOpen,
  onClose,
  focusedGetawayId,
  onGetawayClick,
}: {
  isOpen: boolean;
  onClose: () => void;
  focusedGetawayId?: string | null;
  onGetawayClick?: (getawayId: string) => void;
}) {
  const {
    list,
    getaways,
    commentsByGetaway,
    setCommentsByGetaway,
    currentUserId,
    isListMember,
  } = useListDetailContext();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [newCommentGetaway, setNewCommentGetaway] = useState<string | null>(null);

  const focusedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusedGetawayId && isOpen) {
      setNewCommentGetaway(focusedGetawayId);
    }
  }, [focusedGetawayId, isOpen]);

  useEffect(() => {
    if (focusedGetawayId && isOpen && focusedRef.current) {
      focusedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [focusedGetawayId, isOpen]);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const grouped = (commentsByGetaway || {}) as CommentsByGetaway;
  const getawaysWithComments = getaways.filter(
    (g) => (grouped[g.id]?.length ?? 0) > 0
  );
  const getawaysWithoutComments = getaways.filter(
    (g) => (grouped[g.id]?.length ?? 0) === 0
  );

  async function handleAddComment(getawayId: string) {
    const body = newCommentBody.trim();
    if (!body || !isListMember) return;
    setSaving(true);
    try {
      await createComment(list.id, getawayId, body);
      setNewCommentBody("");
      setNewCommentGetaway(null);
      // Comment appears via realtime COMMENT_INSERT (avoids duplicate if we also added here)
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
      setCommentsByGetaway((prev: CommentsByGetaway) => {
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

  async function handleDeleteComment(commentId: string, getawayId: string) {
    if (!confirm("Delete this comment?")) return;
    setSaving(true);
    try {
      await deleteComment(list.id, commentId);
      setCommentsByGetaway((prev: CommentsByGetaway) => {
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

  function formatDate(s: string) {
    const d = new Date(s);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  }

  return (
    <div className="comments-sidebar">
      <div className="comments-sidebar__header">
        <h3>Comments</h3>
        <button
          type="button"
          onClick={onClose}
          className="comments-sidebar__close"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="comments-sidebar__content">
        {!isListMember ? (
          <p className="comments-sidebar__muted">Sign in to view comments.</p>
        ) : (
          <>
            {getawaysWithComments.map((g) => (
              <div
                key={g.id}
                ref={focusedGetawayId === g.id ? focusedRef : undefined}
                className={`comments-sidebar__getaway-group ${
                  focusedGetawayId === g.id ? "comments-sidebar__getaway-group--focused" : ""
                }`}
              >
                <button
                  type="button"
                  className="comments-sidebar__getaway-title"
                  onClick={() => onGetawayClick?.(g.id)}
                >
                  {g.name || "(Untitled)"}
                </button>
                {(grouped[g.id] || []).map((c) => (
                  <div key={c.id} className="comments-sidebar__comment">
                    <div className="comments-sidebar__comment-header">
                      <span className="comments-sidebar__comment-author">
                        {c.first_name || "Anonymous"}
                      </span>
                      <span className="comments-sidebar__comment-date">
                        {formatDate(c.created_at)}
                      </span>
                      {currentUserId === c.user_id && (
                        <div className="comments-sidebar__comment-actions">
                          {editingId === c.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  handleUpdateComment(c.id, editBody)
                                }
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
                                onClick={() =>
                                  handleDeleteComment(c.id, g.id)
                                }
                                disabled={saving}
                                className="comments-sidebar__delete"
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
                        className="comments-sidebar__input"
                        rows={3}
                        autoFocus
                      />
                    ) : (
                      <p className="comments-sidebar__comment-body">{c.body}</p>
                    )}
                  </div>
                ))}
                {isListMember && newCommentGetaway === g.id && (
                  <div className="comments-sidebar__add-form">
                    <textarea
                      value={newCommentBody}
                      onChange={(e) => setNewCommentBody(e.target.value)}
                      placeholder="Add a comment..."
                      className="comments-sidebar__input"
                      rows={3}
                      autoFocus
                    />
                    <div className="comments-sidebar__add-actions">
                      <button
                        type="button"
                        onClick={() => handleAddComment(g.id)}
                        disabled={!newCommentBody.trim() || saving}
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCommentGetaway(null);
                          setNewCommentBody("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {getawaysWithoutComments.map((g) => (
              <div key={g.id} className="comments-sidebar__getaway-group">
                <button
                  type="button"
                  className="comments-sidebar__getaway-title"
                  onClick={() => onGetawayClick?.(g.id)}
                >
                  {g.name || "(Untitled)"}
                </button>
                {isListMember &&
                  (newCommentGetaway === g.id ? (
                    <div className="comments-sidebar__add-form">
                      <textarea
                        value={newCommentBody}
                        onChange={(e) => setNewCommentBody(e.target.value)}
                        placeholder="Add a comment..."
                        className="comments-sidebar__input"
                        rows={3}
                        autoFocus
                      />
                      <div className="comments-sidebar__add-actions">
                        <button
                          type="button"
                          onClick={() => handleAddComment(g.id)}
                          disabled={!newCommentBody.trim() || saving}
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setNewCommentGetaway(null);
                            setNewCommentBody("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="comments-sidebar__add-link"
                      onClick={() => setNewCommentGetaway(g.id)}
                    >
                      + Add comment
                    </button>
                  ))}
              </div>
            ))}

            {getaways.length === 0 && (
              <p className="comments-sidebar__muted">No getaways yet.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

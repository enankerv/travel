"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  createComment,
  updateComment,
  deleteComment,
  type CommentRecord,
} from "@/lib/api";
import { useBoardContextOptional } from "@/lib/BoardContext";
import { useListDetailContextOptional } from "@/lib/ListDetailContext";

type CommentsByPoi = Record<string, CommentRecord[]>;

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
  const board = useBoardContextOptional();
  const list = useListDetailContextOptional();

  const listMeta = board?.list ?? list?.list;
  const isListMember = board?.isListMember ?? list?.isListMember ?? false;
  const currentUserId = board?.currentUserId ?? list?.currentUserId;

  const pois = useMemo(
    () =>
      board
        ? board.pois.map((p) => ({ id: p.id, title: p.title }))
        : (list?.getaways ?? []).map((g) => ({ id: g.id, title: g.title })),
    [board, list],
  );

  const grouped: CommentsByPoi = useMemo(
    () =>
      board
        ? Object.fromEntries(board.pois.map((p) => [p.id, p.comments ?? []]))
        : (list?.commentsByGetaway ?? {}),
    [board, list],
  );

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [newCommentGetaway, setNewCommentGetaway] = useState<string | null>(null);
  const [newCommentBody, setNewCommentBody] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (!board && !list) {
    throw new Error(
      "CommentsSidebar requires BoardProvider or ListDetailProvider",
    );
  }

  if (!isOpen) return null;

  const poisWithComments = pois.filter(
    (p) => (grouped[p.id]?.length ?? 0) > 0,
  );
  const poisWithoutComments = pois.filter(
    (p) => (grouped[p.id]?.length ?? 0) === 0,
  );

  function syncCommentUpdate(comment: CommentRecord) {
    if (board) {
      board.upsertComment(comment);
      return;
    }
    if (!list) return;
    list.setCommentsByGetaway((prev: CommentsByPoi) => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) {
        next[pid] = next[pid].map((c) =>
          c.id === comment.id ? { ...c, ...comment } : c,
        );
      }
      return next;
    });
  }

  function syncCommentDelete(poiId: string, commentId: string) {
    if (board) {
      board.removeComment(poiId, commentId);
      return;
    }
    if (!list) return;
    list.setCommentsByGetaway((prev: CommentsByPoi) => {
      const next = { ...prev };
      next[poiId] = (next[poiId] || []).filter((c) => c.id !== commentId);
      return next;
    });
  }

  async function handleAddComment(poiId: string) {
    const body = newCommentBody.trim();
    if (!body || !isListMember) return;
    setSaving(true);
    try {
      await createComment(listMeta!.id, poiId, body);
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
      const { comment } = await updateComment(listMeta!.id, commentId, trimmed);
      syncCommentUpdate(comment);
      setEditingId(null);
      setEditBody("");
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteComment(commentId: string, poiId: string) {
    if (!confirm("Delete this comment?")) return;
    setSaving(true);
    try {
      await deleteComment(listMeta!.id, commentId);
      syncCommentDelete(poiId, commentId);
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
            {poisWithComments.map((p) => (
              <div
                key={p.id}
                ref={focusedGetawayId === p.id ? focusedRef : undefined}
                className={`comments-sidebar__getaway-group ${
                  focusedGetawayId === p.id ? "comments-sidebar__getaway-group--focused" : ""
                }`}
              >
                <button
                  type="button"
                  className="comments-sidebar__getaway-title"
                  onClick={() => onGetawayClick?.(p.id)}
                >
                  {p.title || "(Untitled)"}
                </button>
                {(grouped[p.id] || []).map((c) => (
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
                                  handleDeleteComment(c.id, p.id)
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
                {isListMember && newCommentGetaway === p.id && (
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
                        onClick={() => handleAddComment(p.id)}
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

            {poisWithoutComments.map((p) => (
              <div key={p.id} className="comments-sidebar__getaway-group">
                <button
                  type="button"
                  className="comments-sidebar__getaway-title"
                  onClick={() => onGetawayClick?.(p.id)}
                >
                  {p.title || "(Untitled)"}
                </button>
                {isListMember &&
                  (newCommentGetaway === p.id ? (
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
                          onClick={() => handleAddComment(p.id)}
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
                      onClick={() => setNewCommentGetaway(p.id)}
                    >
                      + Add comment
                    </button>
                  ))}
              </div>
            ))}

            {pois.length === 0 && (
              <p className="comments-sidebar__muted">
                {board ? "No items yet." : "No getaways yet."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

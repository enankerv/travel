"use client";

import { useState, useMemo, useEffect } from "react";
import {
  createComment,
  updateComment,
  deleteComment,
  type CommentRecord,
} from "@/lib/api";
import { withoutCommentTree } from "@/lib/comments";
import { useBoardContextOptional } from "@/lib/BoardContext";
import { useListDetailContextOptional } from "@/lib/ListDetailContext";
import CommentThreadList from "./CommentThreadList";

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

  const [newCommentBody, setNewCommentBody] = useState("");
  const [saving, setSaving] = useState(false);

  const activePoi = useMemo(
    () =>
      focusedGetawayId
        ? pois.find((p) => p.id === focusedGetawayId) ?? null
        : null,
    [focusedGetawayId, pois],
  );
  const comments = activePoi ? grouped[activePoi.id] ?? [] : [];

  useEffect(() => {
    setNewCommentBody("");
  }, [focusedGetawayId]);

  if (!board && !list) {
    throw new Error(
      "CommentsSidebar requires BoardProvider or ListDetailProvider",
    );
  }

  if (!isOpen) return null;

  function syncCommentInsert(comment: CommentRecord) {
    if (board) {
      board.upsertComment(comment);
      return;
    }
    if (!list) return;
    list.setCommentsByGetaway((prev: CommentsByPoi) => {
      const existing = prev[comment.poi_id] || [];
      if (existing.some((c) => c.id === comment.id)) return prev;
      return { ...prev, [comment.poi_id]: [...existing, comment] };
    });
  }

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
      next[poiId] = withoutCommentTree(next[poiId] || [], commentId);
      return next;
    });
  }

  async function handleAddComment(poiId: string, parent?: CommentRecord, replyBody?: string) {
    const body = (replyBody ?? newCommentBody).trim();
    if (!body || !isListMember) return;
    setSaving(true);
    try {
      const result = await createComment(
        listMeta!.id,
        poiId,
        body,
        parent?.id,
      );
      if (result?.comment) syncCommentInsert(result.comment);
      if (!parent) setNewCommentBody("");
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
        ) : !activePoi ? (
          <p className="comments-sidebar__muted">
            Select a villa to see comments.
          </p>
        ) : (
          <div className="comments-sidebar__getaway-group comments-sidebar__getaway-group--focused">
            <button
              type="button"
              className="comments-sidebar__getaway-title"
              onClick={() => onGetawayClick?.(activePoi.id)}
            >
              {activePoi.title || "(Untitled)"}
            </button>
            {comments.length === 0 && (
              <p className="comments-sidebar__muted">No comments yet.</p>
            )}
            <CommentThreadList
              comments={comments}
              currentUserId={currentUserId}
              saving={saving}
              onReply={(parent, body) =>
                handleAddComment(activePoi.id, parent, body)
              }
              onUpdate={handleUpdateComment}
              onDelete={(commentId) =>
                handleDeleteComment(commentId, activePoi.id)
              }
            />
            <div className="comments-sidebar__add-form">
              <textarea
                value={newCommentBody}
                onChange={(e) => setNewCommentBody(e.target.value)}
                placeholder="Add a comment..."
                className="comments-sidebar__input"
                rows={3}
              />
              <div className="comments-sidebar__add-actions">
                <button
                  type="button"
                  onClick={() => void handleAddComment(activePoi.id)}
                  disabled={!newCommentBody.trim() || saving}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

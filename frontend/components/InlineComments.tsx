"use client";

import { useState } from "react";
import {
  createComment,
  updateComment,
  deleteComment,
  type CommentRecord,
} from "@/lib/api";
import { withoutCommentTree } from "@/lib/comments";
import { usePoiSocial } from "@/hooks/usePoiSocial";
import CommentThreadList from "./CommentThreadList";

export default function InlineComments({
  getawayId,
}: {
  getawayId: string;
}) {
  const social = usePoiSocial(getawayId);
  const {
    source,
    listId,
    comments,
    isListMember,
    currentUserId,
  } = social;

  const [newCommentBody, setNewCommentBody] = useState("");
  const [saving, setSaving] = useState(false);

  function applyCreated(comment: CommentRecord) {
    if (source === "board") {
      social.upsertComment(comment);
      return;
    }
    social.setCommentsByGetaway((prev) => {
      const existing = prev[getawayId] || [];
      if (existing.some((c) => c.id === comment.id)) return prev;
      return { ...prev, [getawayId]: [...existing, comment] };
    });
  }

  async function handleAddComment(body: string, parent?: CommentRecord) {
    const trimmed = body.trim();
    if (!trimmed || !isListMember) return;
    setSaving(true);
    try {
      const result = await createComment(
        listId,
        getawayId,
        trimmed,
        parent?.id,
      );
      if (result?.comment) applyCreated(result.comment);
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
      const { comment } = await updateComment(listId, commentId, trimmed);
      if (source === "board") {
        social.upsertComment(comment);
      } else {
        social.setCommentsByGetaway((prev) => {
          const next = { ...prev };
          for (const gid of Object.keys(next)) {
            next[gid] = next[gid].map((c) =>
              c.id === commentId ? { ...c, ...comment } : c,
            );
          }
          return next;
        });
      }
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
      await deleteComment(listId, commentId);
      if (source === "board") {
        social.removeComment(getawayId, commentId);
      } else {
        social.setCommentsByGetaway((prev) => {
          const next = { ...prev };
          next[getawayId] = withoutCommentTree(next[getawayId] || [], commentId);
          return next;
        });
      }
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

      <CommentThreadList
        comments={comments}
        currentUserId={currentUserId}
        saving={saving}
        onReply={(parent, body) => handleAddComment(body, parent)}
        onUpdate={handleUpdateComment}
        onDelete={handleDeleteComment}
      />

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
          onClick={() => void handleAddComment(newCommentBody)}
          disabled={!newCommentBody.trim() || saving}
          className="inline-comments__add-btn"
        >
          Add
        </button>
      </div>
    </div>
  );
}

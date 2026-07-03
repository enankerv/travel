"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { presenceColorForUserId } from "@/lib/presenceColors";

/** Event to trigger optimistic credit decrement (before realtime confirms). */
export const SCOUT_OPTIMISTIC_DECREMENT = "scout-credits-optimistic-decrement";

/** Event to revert optimistic decrement (e.g. thin scrape - no charge). */
export const SCOUT_OPTIMISTIC_REFUND = "scout-credits-optimistic-refund";

/** Event to refetch credits from API (e.g. after successful scout when realtime may be delayed). */
export const SCOUT_REFETCH_CREDITS = "scout-credits-refetch";

export type PresenceUser = {
  user_id: string;
  first_name?: string;
  avatar_url?: string;
  /** Deterministic per-user; set from presence track for viewers. */
  cursor_color?: string;
};

/** Client broadcast payload for shared-pointer cursors (same channel as list updates). */
export type ListCursorBroadcastPayload = {
  user_id?: string;
  surface?: "table" | "map";
  nx?: number;
  ny?: number;
  /** When true, receivers should drop this user's cursor for this surface. */
  leave?: boolean;
};

const listCursorSubscribers = new Map<
  string,
  Set<(p: ListCursorBroadcastPayload) => void>
>();

function dispatchListCursor(listId: string, payload: ListCursorBroadcastPayload) {
  const set = listCursorSubscribers.get(listId);
  if (!set?.size) return;
  for (const cb of set) {
    try {
      cb(payload);
    } catch {
      /* ignore subscriber errors */
    }
  }
}

/** Register for `cursor` broadcasts on `list:<listId>` (dispatched from useListRealtime). */
export function subscribeListCursorBroadcast(
  listId: string,
  cb: (p: ListCursorBroadcastPayload) => void,
): () => void {
  let set = listCursorSubscribers.get(listId);
  if (!set) {
    set = new Set();
    listCursorSubscribers.set(listId, set);
  }
  set.add(cb);
  return () => {
    set!.delete(cb);
    if (set!.size === 0) listCursorSubscribers.delete(listId);
  };
}

type GetawayRow = { id: string; updated_at?: string; [key: string]: any };

type UseListGetawaysRealtimeOptions = {
  listId: string;
  enabled: boolean;
  onInsert: (row: GetawayRow) => void;
  onUpdate: (row: GetawayRow) => void;
  onDelete: (id: string) => void;
  /** Called when getaway_images changes; refetch getaways to get updated images */
  onImagesChange?: () => void;
};

/**
 * Subscribes to getaway changes for a list via:
 *  1. Broadcast (realtime.broadcast_changes DB trigger) — primary
 *  2. postgres_changes — fallback
 *
 * Deduplicates events so both sources firing for the same change
 * only applies the update once.
 */
export function useListGetawaysRealtime({
  listId,
  enabled,
  onInsert,
  onUpdate,
  onDelete,
  onImagesChange,
}: UseListGetawaysRealtimeOptions) {
  useEffect(() => {
    if (!enabled) return;

    const recentIds = new Set<string>();
    const markSeen = (key: string) => {
      recentIds.add(key);
      setTimeout(() => recentIds.delete(key), 5000);
    };

    const applyChange = (event: string, newRow: any, oldRow: any) => {
      const dedupeKey = `${event}:${newRow?.id ?? oldRow?.id ?? "?"}:${newRow?.updated_at ?? oldRow?.updated_at ?? Date.now()}`;
      if (recentIds.has(dedupeKey)) return;
      markSeen(dedupeKey);

      if (event === "INSERT" && newRow) onInsert(newRow);
      else if (event === "UPDATE" && newRow) onUpdate(newRow);
      else if (event === "DELETE" && oldRow?.id) onDelete(oldRow.id);
    };

    const channel = supabase
      .channel(`list:${listId}`, {
        config: {
          private: true,
          broadcast: {
            self: process.env.NODE_ENV === 'development',
            ack: false,
          },
        },
      })
      .on("broadcast", { event: "INSERT" }, (p: any) =>
        applyChange("INSERT", p.payload?.record, null),
      )
      .on("broadcast", { event: "UPDATE" }, (p: any) =>
        applyChange("UPDATE", p.payload?.record, p.payload?.old_record ?? null),
      )
      .on("broadcast", { event: "DELETE" }, (p: any) => {
        const oldRecord = p.payload?.old_record ?? p.payload?.record;
        applyChange("DELETE", null, oldRecord);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "getaways",
          filter: `list_id=eq.${listId}`,
        },
        (payload: { eventType?: string; new?: any; old?: any }) => {
          applyChange(
            payload.eventType ?? "",
            payload.new,
            payload.old ?? null,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "getaway_images",
        },
        () => {
          onImagesChange?.();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, enabled]);
}

type UseListVotesRealtimeOptions = {
  listId: string;
  enabled: boolean;
  onVoteInsert: (voter: { getaway_id: string; user_id: string; first_name?: string; avatar_url?: string }) => void;
  onVoteDelete: (getaway_id: string, user_id: string) => void;
};

type UseListCommentsRealtimeOptions = {
  onCommentInsert?: (comment: any) => void;
  onCommentUpdate?: (comment: any) => void;
  onCommentDelete?: (commentId: string, getawayId: string) => void;
};

type UseListPoisRealtimeOptions = {
  onPoiInsert?: (row: any) => void;
  onPoiUpdate?: (row: any) => void;
  onPoiDelete?: (id: string) => void;
};

type UseListRealtimeOptions = UseListGetawaysRealtimeOptions &
  UseListVotesRealtimeOptions &
  UseListCommentsRealtimeOptions &
  UseListPoisRealtimeOptions;

/**
 * Single subscription to list channel for both getaways and votes.
 * Multiple channel() calls with the same name can conflict; one subscription handles both.
 */
export function useListRealtime({
  listId,
  enabled,
  onInsert,
  onUpdate,
  onDelete,
  onImagesChange,
  onVoteInsert,
  onVoteDelete,
  onCommentInsert,
  onCommentUpdate,
  onCommentDelete,
  onPoiInsert,
  onPoiUpdate,
  onPoiDelete,
}: UseListRealtimeOptions) {
  useEffect(() => {
    if (!enabled) return;

    const recentIds = new Set<string>();
    const markSeen = (key: string) => {
      recentIds.add(key);
      setTimeout(() => recentIds.delete(key), 5000);
    };

    const applyGetawayChange = (event: string, newRow: any, oldRow: any) => {
      const dedupeKey = `${event}:${newRow?.id ?? oldRow?.id ?? "?"}:${newRow?.updated_at ?? oldRow?.updated_at ?? Date.now()}`;
      if (recentIds.has(dedupeKey)) return;
      markSeen(dedupeKey);

      if (event === "INSERT" && newRow) onInsert(newRow);
      else if (event === "UPDATE" && newRow) onUpdate(newRow);
      else if (event === "DELETE" && oldRow?.id) onDelete(oldRow.id);
    };

    const applyPoiChange = (event: string, newRow: any, oldRow: any) => {
      const dedupeKey = `poi:${event}:${newRow?.id ?? oldRow?.id ?? "?"}:${newRow?.updated_at ?? oldRow?.updated_at ?? Date.now()}`;
      if (recentIds.has(dedupeKey)) return;
      markSeen(dedupeKey);

      if (event === "INSERT" && newRow) onPoiInsert?.(newRow);
      else if (event === "UPDATE" && newRow) onPoiUpdate?.(newRow);
      else if (event === "DELETE" && oldRow?.id) onPoiDelete?.(oldRow.id);
    };

    const channel = supabase
      .channel(`list:${listId}`, {
        config: {
          private: true,
          broadcast: {
            self: process.env.NODE_ENV === 'development',
            ack: false,
          },
        },
      })
      .on("broadcast", { event: "INSERT" }, (p: any) =>
        applyGetawayChange("INSERT", p.payload?.record, null),
      )
      .on("broadcast", { event: "UPDATE" }, (p: any) =>
        applyGetawayChange("UPDATE", p.payload?.record, p.payload?.old_record ?? null),
      )
      .on("broadcast", { event: "DELETE" }, (p: any) => {
        const oldRecord = p.payload?.old_record ?? p.payload?.record;
        applyGetawayChange("DELETE", null, oldRecord);
      })
      .on("broadcast", { event: "VOTE_INSERT" }, (p: any) => {
        const r = p.payload?.record;
        if (r?.getaway_id && r?.user_id) {
          onVoteInsert({
            getaway_id: r.getaway_id,
            user_id: r.user_id,
            first_name: r.first_name || undefined,
            avatar_url: r.avatar_url || undefined,
          });
        }
      })
      .on("broadcast", { event: "VOTE_DELETE" }, (p: any) => {
        const r = p.payload?.old_record;
        if (r?.getaway_id && r?.user_id) {
          onVoteDelete(r.getaway_id, r.user_id);
        }
      })
      .on("broadcast", { event: "COMMENT_INSERT" }, (p: any) => {
        const r = p.payload?.record;
        if (r && onCommentInsert) onCommentInsert(r);
      })
      .on("broadcast", { event: "COMMENT_UPDATE" }, (p: any) => {
        const r = p.payload?.record;
        if (r && onCommentUpdate) onCommentUpdate(r);
      })
      .on("broadcast", { event: "COMMENT_DELETE" }, (p: any) => {
        const r = p.payload?.old_record;
        if (r?.id && r?.getaway_id && onCommentDelete) onCommentDelete(r.id, r.getaway_id);
      })
      .on("broadcast", { event: "POI_INSERT" }, (p: any) =>
        applyPoiChange("INSERT", p.payload?.record, null),
      )
      .on("broadcast", { event: "POI_UPDATE" }, (p: any) =>
        applyPoiChange("UPDATE", p.payload?.record, p.payload?.old_record ?? null),
      )
      .on("broadcast", { event: "POI_DELETE" }, (p: any) => {
        const oldRecord = p.payload?.old_record ?? p.payload?.record;
        applyPoiChange("DELETE", null, oldRecord);
      })
      .on("broadcast", { event: "cursor" }, (p: any) => {
        dispatchListCursor(listId, (p.payload ?? {}) as ListCursorBroadcastPayload);
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "getaways",
          filter: `list_id=eq.${listId}`,
        },
        (payload: { eventType?: string; new?: any; old?: any }) => {
          applyGetawayChange(
            payload.eventType ?? "",
            payload.new,
            payload.old ?? null,
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "getaway_images",
        },
        () => {
          onImagesChange?.();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pois",
          filter: `list_id=eq.${listId}`,
        },
        (payload: { eventType?: string; new?: any; old?: any }) => {
          applyPoiChange(
            payload.eventType ?? "",
            payload.new,
            payload.old ?? null,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    listId,
    enabled,
    onInsert,
    onUpdate,
    onDelete,
    onImagesChange,
    onVoteInsert,
    onVoteDelete,
    onCommentInsert,
    onCommentUpdate,
    onCommentDelete,
    onPoiInsert,
    onPoiUpdate,
    onPoiDelete,
  ]);
}

/** @deprecated Use useListRealtime instead. Kept for backwards compat. */
export function useListVotesRealtime({
  listId,
  enabled,
  onVoteInsert,
  onVoteDelete,
}: UseListVotesRealtimeOptions) {
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel(`list:${listId}`, {
        config: {
          private: true,
          broadcast: {
            self: process.env.NODE_ENV === 'development',
            ack: false,
          },
        },
      })
      .on("broadcast", { event: "VOTE_INSERT" }, (p: any) => {
        const r = p.payload?.record;
        if (r?.getaway_id && r?.user_id) {
          onVoteInsert({
            getaway_id: r.getaway_id,
            user_id: r.user_id,
            first_name: r.first_name || undefined,
            avatar_url: r.avatar_url || undefined,
          });
        }
      })
      .on("broadcast", { event: "VOTE_DELETE" }, (p: any) => {
        const r = p.payload?.old_record;
        if (r?.getaway_id && r?.user_id) {
          onVoteDelete(r.getaway_id, r.user_id);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, enabled, onVoteInsert, onVoteDelete]);
}

type UseListPresenceOptions = {
  listId: string;
  enabled: boolean;
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  } | null;
  onUsersChange: (users: PresenceUser[]) => void;
};

/**
 * Tracks which users are currently viewing a list and
 * calls onUsersChange whenever the presence state syncs.
 */
export function useListPresence({
  listId,
  enabled,
  user,
  onUsersChange,
}: UseListPresenceOptions) {
  useEffect(() => {
    if (!enabled || !user) return;

    const meta = user.user_metadata || {};
    const first_name =
      meta.full_name ||
      meta.name ||
      (user.email ? user.email.split("@")[0] : "") ||
      user.id.slice(0, 8);
    const avatar_url: string | undefined =
      meta.avatar_url || meta.picture || undefined;

    const channel = supabase.channel(`presence:${listId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key] as Array<{
            user_id?: string;
            first_name?: string;
            avatar_url?: string;
          }>;
          for (const p of presences) {
            if (p?.user_id)
              users.push({
                user_id: p.user_id,
                first_name: p.first_name,
                avatar_url: p.avatar_url,
                cursor_color:
                  (p as { cursor_color?: string }).cursor_color ||
                  presenceColorForUserId(p.user_id),
              });
          }
        }
        onUsersChange(users);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({
            user_id: user.id,
            first_name,
            avatar_url,
            cursor_color: presenceColorForUserId(user.id),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, enabled, user?.id]);
}


"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export type PresenceUser = {
  user_id: string;
  first_name?: string;
  avatar_url?: string;
};

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
      .channel(`list:${listId}`, { config: { private: true } })
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

type UseListRealtimeOptions = UseListGetawaysRealtimeOptions & UseListVotesRealtimeOptions;

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

    const channel = supabase
      .channel(`list:${listId}`, { config: { private: true } })
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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, enabled, onInsert, onUpdate, onDelete, onImagesChange, onVoteInsert, onVoteDelete]);
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
      .channel(`list:${listId}`, { config: { private: true } })
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
              });
          }
        }
        onUsersChange(users);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track({ user_id: user.id, first_name, avatar_url });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, enabled, user?.id]);
}

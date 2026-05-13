"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { VotesByGetaway } from "./votes";
import type { CommentRecord } from "./api";
import type { PresenceUser } from "./realtime";

export type CommentsByGetaway = Record<string, CommentRecord[]>;

export type ListDetailContextValue = {
  list: { id: string; name: string; user_id?: string; member_count?: number };
  members: any[];
  getaways: any[];
  setGetaways: React.Dispatch<React.SetStateAction<any[]>>;
  votesByGetaway: VotesByGetaway;
  onVote: (getawayId: string) => Promise<void>;
  onUnvote: (getawayId: string) => Promise<void>;
  isListMember: boolean;
  currentUserId: string | undefined;
  currentUserProfile: { first_name?: string; avatar_url?: string } | undefined;
  commentsByGetaway: CommentsByGetaway;
  setCommentsByGetaway: React.Dispatch<React.SetStateAction<CommentsByGetaway>>;
  isLoading: boolean;
  error: string;
  setError: (msg: string) => void;
  onRefresh: () => Promise<void>;
  /** Local party size for price-per-person (min 1); default from list member count. */
  partySize: number;
  setPartySize: (n: number) => void;
  /** Other users currently viewing this list via Supabase presence (excludes self).
   *  Single source of truth for the "Viewing with" pile + shared-cursor gating/colors. */
  otherViewers: PresenceUser[];
};

const ListDetailContext = createContext<ListDetailContextValue | null>(null);

export function ListDetailProvider({
  value,
  children,
}: {
  value: ListDetailContextValue;
  children: ReactNode;
}) {
  return (
    <ListDetailContext.Provider value={value}>
      {children}
    </ListDetailContext.Provider>
  );
}

export function useListDetailContext(): ListDetailContextValue {
  const ctx = useContext(ListDetailContext);
  if (!ctx) {
    throw new Error("useListDetailContext must be used within ListDetailProvider");
  }
  return ctx;
}

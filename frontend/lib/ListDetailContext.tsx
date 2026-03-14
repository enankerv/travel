"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { VotesByGetaway } from "./votes";
import type { CommentRecord } from "./api";

export type CommentsByGetaway = Record<string, CommentRecord[]>;

export type ListDetailContextValue = {
  list: { id: string; name: string; user_id?: string };
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

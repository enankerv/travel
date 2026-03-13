"use client";

import { useState, useCallback } from "react";
import { addVote, removeVote } from "@/lib/api";
import { addVoter, removeVoter, type VotesByGetaway } from "@/lib/votes";

type UseListVotesOptions = {
  listId: string;
  user: { id: string; user_metadata?: Record<string, any>; email?: string | null } | null;
  members: Array<{ user_id: string; profile?: { first_name?: string; avatar_url?: string } }>;
  setError: (msg: string) => void;
};

export function useListVotes({
  listId,
  user,
  members,
  setError,
}: UseListVotesOptions) {
  const [votesByGetaway, setVotesByGetaway] = useState<VotesByGetaway>({});

  const currentUserProfile =
    members.find((m) => m.user_id === user?.id)?.profile ||
    (user
      ? {
          first_name: user.user_metadata?.full_name?.split(" ")[0] || user.email?.split("@")[0],
          avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture,
        }
      : undefined);

  const onVoteInsert = useCallback((voter: { getaway_id: string; user_id: string; first_name?: string; avatar_url?: string }) => {
    setVotesByGetaway((prev) =>
      addVoter(prev, voter.getaway_id, {
        user_id: voter.user_id,
        first_name: voter.first_name,
        avatar_url: voter.avatar_url,
      })
    );
  }, []);

  const onVoteDelete = useCallback((getaway_id: string, user_id: string) => {
    setVotesByGetaway((prev) => removeVoter(prev, getaway_id, user_id));
  }, []);

  const onVote = useCallback(
    async (getawayId: string) => {
      try {
        await addVote(listId, getawayId);
        if (user?.id) {
          setVotesByGetaway((prev) =>
            addVoter(prev, getawayId, {
              user_id: user.id,
              first_name: currentUserProfile?.first_name,
              avatar_url: currentUserProfile?.avatar_url,
            })
          );
        }
      } catch (err: any) {
        setError(err.message || "Failed to add vote");
      }
    },
    [listId, user?.id, currentUserProfile, setError]
  );

  const onUnvote = useCallback(
    async (getawayId: string) => {
      try {
        await removeVote(listId, getawayId);
        if (user?.id) {
          setVotesByGetaway((prev) => removeVoter(prev, getawayId, user.id));
        }
      } catch (err: any) {
        setError(err.message || "Failed to remove vote");
      }
    },
    [listId, user?.id, setError]
  );

  const isListMember = !!user && members.some((m) => m.user_id === user.id);

  return {
    votesByGetaway,
    setVotesByGetaway,
    onVote,
    onUnvote,
    onVoteInsert,
    onVoteDelete,
    isListMember,
    currentUserId: user?.id,
    currentUserProfile,
  };
}

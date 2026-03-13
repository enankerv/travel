export type Voter = { user_id: string; first_name?: string; avatar_url?: string };

export type VotesByGetaway = Record<string, Voter[]>;

/** Add a voter to a getaway. Returns new state; no-op if already voted. */
export function addVoter(
  prev: VotesByGetaway,
  getawayId: string,
  voter: Voter
): VotesByGetaway {
  const voters = prev[getawayId] || [];
  if (voters.some((v) => v.user_id === voter.user_id)) return prev;
  return {
    ...prev,
    [getawayId]: [...voters, voter],
  };
}

/** Remove a voter from a getaway. Returns new state. */
export function removeVoter(
  prev: VotesByGetaway,
  getawayId: string,
  userId: string
): VotesByGetaway {
  const voters = (prev[getawayId] || []).filter((v) => v.user_id !== userId);
  if (voters.length === 0) {
    const next = { ...prev };
    delete next[getawayId];
    return next;
  }
  return { ...prev, [getawayId]: voters };
}

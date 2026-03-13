"use client";

import { useState, useEffect } from "react";
import { getGetaways, getListMembers, getListVotes } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useListRealtime, useListPresence, PresenceUser } from "@/lib/realtime";
import { useListVotes } from "@/hooks/useListVotes";
import { ListDetailProvider } from "@/lib/ListDetailContext";
import ListGetawaysTab from "./ListGetawaysTab";
import ListMembersTab from "./ListMembersTab";

export default function ListDetailView({ list, onBack }: any) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"places" | "members">("places");
  const [getaways, setGetaways] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);

  const votes = useListVotes({
    listId: list.id,
    user,
    members,
    setError,
  });

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, []);

  useListRealtime({
    listId: list.id,
    enabled: dataLoaded && !!user,
    onInsert: (row) => setGetaways((prev) => [row, ...prev]),
    onUpdate: (row) =>
      setGetaways((prev) => prev.map((g) => (g.id === row.id ? row : g))),
    onDelete: (id) => setGetaways((prev) => prev.filter((g) => g.id !== id)),
    onImagesChange: () => loadData(true),
    onVoteInsert: votes.onVoteInsert,
    onVoteDelete: votes.onVoteDelete,
  });

  useListPresence({
    listId: list.id,
    enabled: dataLoaded && !!user,
    user,
    onUsersChange: setViewingUsers,
  });

  const contextValue = {
    list,
    members,
    getaways,
    setGetaways,
    votesByGetaway: votes.votesByGetaway,
    onVote: votes.onVote,
    onUnvote: votes.onUnvote,
    isListMember: votes.isListMember,
    currentUserId: votes.currentUserId,
    currentUserProfile: votes.currentUserProfile,
    isLoading,
    error,
    setError,
    onRefresh: () => loadData(true),
  };

  async function loadData(silent = false) {
    if (!silent) setIsLoading(true);
    try {
      const [getawaysData, membersData, votesData] = await Promise.all([
        getGetaways(list.id),
        getListMembers(list.id),
        getListVotes(list.id),
      ]);
      setGetaways(getawaysData || []);
      setMembers(membersData?.members || []);
      const votesList = votesData?.votes || [];
      const byGetaway: Record<string, { user_id: string; first_name?: string; avatar_url?: string }[]> = {};
      for (const v of votesList) {
        const gid = v.getaway_id;
        if (!byGetaway[gid]) byGetaway[gid] = [];
        byGetaway[gid].push({ user_id: v.user_id, first_name: v.first_name, avatar_url: v.avatar_url });
      }
      votes.setVotesByGetaway(byGetaway);
      setDataLoaded(true);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load data");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  const presenceOthers = viewingUsers.filter((u) => u.user_id !== user?.id);

  return (
    <ListDetailProvider value={contextValue}>
      <header className="list-detail-header">
        <div className="list-detail-header__left">
          <button
            type="button"
            onClick={onBack}
            className="list-detail-header__back"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="list-detail-header__title">{list.name}</h1>
          {presenceOthers.length > 0 && (
            <div
              className="list-detail-presence"
              title={presenceOthers
                .map((u) => u.first_name || u.user_id.slice(0, 8))
                .join(", ")}
            >
              <span>Viewing with</span>
              <div className="list-detail-presence__avatars">
                {presenceOthers.slice(0, 5).map((u) => (
                  <div
                    key={u.user_id}
                    className="list-detail-presence__avatar"
                    title={u.first_name || u.user_id.slice(0, 8)}
                  >
                    {u.avatar_url ? (
                      <img
                        src={u.avatar_url}
                        alt=""
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="list-detail-presence__avatar-fallback">
                        {(u.first_name || u.user_id).charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <div className="list-detail-tabs">
        <button
          type="button"
          onClick={() => setActiveTab("places")}
          className={`list-detail-tabs__tab ${activeTab === "places" ? "list-detail-tabs__tab--active" : ""}`}
        >
          Places
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("members")}
          className={`list-detail-tabs__tab ${activeTab === "members" ? "list-detail-tabs__tab--active" : ""}`}
        >
          Members ({members.length})
        </button>
      </div>

      <div className="list-detail-content">
        {error && (
          <div
            className="list-villas-tab__error"
            style={{ margin: "1rem 2rem 0" }}
          >
            <span>{error}</span>
          </div>
        )}
        {activeTab === "places" && <ListGetawaysTab />}

        {activeTab === "members" && (
          <ListMembersTab
            listId={list.id}
            members={members}
            currentUserId={user?.id}
            onBack={onBack}
            onError={setError}
          />
        )}
      </div>
    </ListDetailProvider>
  );
}

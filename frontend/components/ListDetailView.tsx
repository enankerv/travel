"use client";

import { useState, useEffect, type ReactNode } from "react";
import {
  getGetaways,
  getListMembers,
  getListVotes,
  getListComments,
  listPois,
} from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import { useListRealtime, useListPresence, PresenceUser } from "@/lib/realtime";
import { presenceColorForUserId } from "@/lib/presenceColors";
import { useListVotes } from "@/hooks/useListVotes";
import { ListDetailProvider } from "@/lib/ListDetailContext";
import type { Getaway, POIBase } from "@/lib/getaway";
import ListGetawaysTab from "./ListGetawaysTab";
import ListMembersTab from "./ListMembersTab";
import ScoutCredits from "./ScoutCredits";

function defaultPartySizeFromList(list: { member_count?: number }): number {
  const n = Number(list?.member_count);
  if (Number.isFinite(n) && n >= 1) return Math.min(999, Math.floor(n));
  return 1;
}

export default function ListDetailView({
  list,
  searchParams = {},
  onBack,
}: {
  list: any;
  searchParams?: Record<string, string>;
  onBack: () => void;
  onUpdate?: () => void;
}) {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"places" | "members">("places");
  const [getaways, setGetaways] = useState<Getaway[]>([]);
  const [pois, setPois] = useState<POIBase[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [commentsByGetaway, setCommentsByGetaway] = useState<
    Record<string, any[]>
  >({});
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [focusedGetawayId, setFocusedGetawayId] = useState<string | null>(null);
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [dataLoaded, setDataLoaded] = useState(false);
  const [placesStickyContent, setPlacesStickyContent] =
    useState<ReactNode>(null);
  const [partySize, setPartySizeInternal] = useState(() =>
    defaultPartySizeFromList(list),
  );

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
    onInsert: (row) => {
      setPois((prev) => {
        if (prev.some((p) => p.id === row.id)) return prev;
        return [row as POIBase, ...prev];
      });
      if (row.poi_type && row.poi_type !== "getaway") return;
      setGetaways((prev) => [row as Getaway, ...prev]);
    },
    onUpdate: (row) => {
      setPois((prev) =>
        prev.map((p) => (p.id === row.id ? { ...p, ...row } : p)),
      );
      if (row.poi_type && row.poi_type !== "getaway") return;
      setGetaways((prev) =>
        prev.map((g) => (g.id === row.id ? ({ ...g, ...row } as Getaway) : g)),
      );
    },
    onDelete: (id) => {
      setPois((prev) => prev.filter((p) => p.id !== id));
      setGetaways((prev) => prev.filter((g) => g.id !== id));
    },
    onImagesChange: () => loadData(true),
    onVoteInsert: votes.onVoteInsert,
    onVoteDelete: votes.onVoteDelete,
    onCommentInsert: (c) =>
      setCommentsByGetaway((prev) => {
        const existing = prev[c.poi_id] || [];
        if (existing.some((x) => x.id === c.id)) return prev;
        const next = { ...prev };
        next[c.poi_id] = [...existing, c];
        return next;
      }),
    onCommentUpdate: (c) =>
      setCommentsByGetaway((prev) => {
        const next = { ...prev };
        for (const gid of Object.keys(next)) {
          next[gid] = next[gid].map((x) =>
            x.id === c.id ? { ...x, ...c } : x,
          );
        }
        return next;
      }),
    onCommentDelete: (id, getawayId) =>
      setCommentsByGetaway((prev) => {
        const next = { ...prev };
        next[getawayId] = (next[getawayId] || []).filter((x) => x.id !== id);
        return next;
      }),
  });

  useListPresence({
    listId: list.id,
    enabled: dataLoaded && !!user,
    user,
    onUsersChange: setViewingUsers,
  });

  const otherViewers = viewingUsers.filter((u) => u.user_id !== user?.id);

  const contextValue = {
    list,
    members,
    getaways,
    setGetaways,
    pois,
    setPois,
    votesByGetaway: votes.votesByGetaway,
    onVote: votes.onVote,
    onUnvote: votes.onUnvote,
    isListMember: votes.isListMember,
    currentUserId: votes.currentUserId,
    currentUserProfile: votes.currentUserProfile,
    commentsByGetaway,
    setCommentsByGetaway,
    isLoading,
    error,
    setError,
    onRefresh: () => loadData(true),
    partySize,
    setPartySize: (n: number) => {
      const v = Math.floor(Number(n));
      if (!Number.isFinite(v) || v < 1) setPartySizeInternal(1);
      else if (v > 999) setPartySizeInternal(999);
      else setPartySizeInternal(v);
    },
    otherViewers,
  };

  async function loadData(silent = false) {
    if (!silent) setIsLoading(true);
    try {
      const [getawaysData, poisData, membersData, votesData, commentsData] =
        await Promise.all([
          getGetaways(list.id),
          listPois(list.id),
          getListMembers(list.id),
          getListVotes(list.id),
          getListComments(list.id),
        ]);
      setGetaways((getawaysData || []) as Getaway[]);
      setPois((poisData || []) as POIBase[]);
      const memberRows = membersData?.members || [];
      setMembers(memberRows);
      if (!dataLoaded) {
        setPartySizeInternal(Math.max(1, memberRows.length));
      }
      const votesList = votesData?.votes || [];
      const commentsList = commentsData?.comments || [];
      const commentsByGid: Record<string, any[]> = {};
      for (const c of commentsList) {
        const gid = c.poi_id;
        if (!commentsByGid[gid]) commentsByGid[gid] = [];
        commentsByGid[gid].push(c);
      }
      setCommentsByGetaway(commentsByGid);
      const votesByGid: Record<
        string,
        { user_id: string; first_name?: string; avatar_url?: string }[]
      > = {};
      for (const v of votesList) {
        const gid = v.poi_id;
        if (!votesByGid[gid]) votesByGid[gid] = [];
        votesByGid[gid].push({
          user_id: v.user_id,
          first_name: v.first_name,
          avatar_url: v.avatar_url,
        });
      }
      votes.setVotesByGetaway(votesByGid);
      setDataLoaded(true);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load data");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  return (
    <ListDetailProvider value={contextValue}>
      <div className="list-detail-scroll">
        <div className="list-detail-chrome">
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
              {otherViewers.length > 0 && (
                <div
                  className="list-detail-presence"
                  title={otherViewers
                    .map((u) => u.first_name || u.user_id.slice(0, 8))
                    .join(", ")}
                >
                  <span>Viewing with</span>
                  <div className="list-detail-presence__avatars">
                    {otherViewers.slice(0, 5).map((u) => (
                      <div
                        key={u.user_id}
                        className="list-detail-presence__avatar"
                        title={u.first_name || u.user_id.slice(0, 8)}
                        style={{
                          borderColor:
                            u.cursor_color || presenceColorForUserId(u.user_id),
                        }}
                      >
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt=""
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="list-detail-presence__avatar-fallback">
                            {(u.first_name || u.user_id)
                              .charAt(0)
                              .toUpperCase()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="list-detail-header__right">
              <ScoutCredits />
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
          {activeTab === "places" && placesStickyContent}
        </div>

        {error && (
          <div
            className="list-villas-tab__error"
            style={{ margin: "1rem 2rem 0" }}
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              className="list-villas-tab__error-dismiss"
              title="Dismiss"
            >
              ×
            </button>
          </div>
        )}
        {activeTab === "places" && (
          <ListGetawaysTab
            pasteParam={searchParams?.paste}
            urlParam={searchParams?.url}
            commentsOpen={commentsOpen}
            onCommentsOpenChange={setCommentsOpen}
            focusedGetawayId={focusedGetawayId}
            onFocusedGetawayChange={setFocusedGetawayId}
            onStickyContent={setPlacesStickyContent}
          />
        )}

        {activeTab === "members" && (
          <ListMembersTab
            listId={list.id}
            members={members}
            currentUserId={user?.id}
            onBack={onBack}
            onError={setError}
            onMembersChanged={() => loadData(true)}
          />
        )}
      </div>
    </ListDetailProvider>
  );
}

"use client";

import { useState, useEffect } from "react";
import { getGetaways, getListMembers } from "@/lib/api";
import { useAuth } from "@/lib/AuthContext";
import {
  useListGetawaysRealtime,
  useListPresence,
  PresenceUser,
} from "@/lib/realtime";
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

  useEffect(() => {
    if (!dataLoaded) loadData();
  }, []);

  useListGetawaysRealtime({
    listId: list.id,
    enabled: dataLoaded && !!user,
    onInsert: (row) => setGetaways((prev) => [row, ...prev]),
    onUpdate: (row) =>
      setGetaways((prev) => prev.map((g) => (g.id === row.id ? row : g))),
    onDelete: (id) => setGetaways((prev) => prev.filter((g) => g.id !== id)),
  });

  useListPresence({
    listId: list.id,
    enabled: dataLoaded && !!user,
    user,
    onUsersChange: setViewingUsers,
  });

  async function loadData(silent = false) {
    if (!silent) setIsLoading(true);
    try {
      const [getawaysData, membersData] = await Promise.all([
        getGetaways(list.id),
        getListMembers(list.id),
      ]);
      setGetaways(getawaysData || []);
      setMembers(membersData?.members || []);
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
    <>
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
        {activeTab === "places" && (
          <ListGetawaysTab
            listId={list.id}
            getaways={getaways}
            setGetaways={setGetaways}
            isLoading={isLoading}
            onRefresh={() => loadData(true)}
          />
        )}

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
    </>
  );
}

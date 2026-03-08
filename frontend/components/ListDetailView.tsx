"use client";

import { useState, useEffect } from "react";

function MemberRow({
  user_id,
  profile,
  role,
  subtitle,
}: {
  user_id: string;
  profile?: { first_name?: string; avatar_url?: string };
  role: string;
  subtitle: string;
}) {
  const displayName = profile?.first_name || user_id.slice(0, 8) + "…";
  return (
    <div
      style={{
        padding: "0.75rem",
        background: "var(--surface)",
        borderRadius: "6px",
        border: "1px solid var(--border)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            overflow: "hidden",
            background: "var(--border)",
            flexShrink: 0,
          }}
        >
          {profile?.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt=""
              referrerPolicy="no-referrer"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--muted)",
                fontSize: "1rem",
              }}
            >
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p
            style={{
              margin: 0,
              color: "var(--light)",
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            {displayName}
          </p>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.8rem" }}>
            {subtitle}
          </p>
        </div>
      </div>
      <span
        style={{
          background: "var(--accent-soft)",
          color: "var(--accent)",
          padding: "0.25rem 0.75rem",
          borderRadius: "4px",
          fontSize: "0.75rem",
          fontWeight: "600",
          textTransform: "capitalize",
        }}
      >
        {role}
      </span>
    </div>
  );
}
import {
  getVillas,
  scoutUrl,
  scoutPaste,
  deleteVilla,
  updateVilla,
  createInvite,
  getListMembers,
} from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/AuthContext";
import DropZone from "./DropZone";
import VillaTable from "./VillaTable";
import PasteModal from "./PasteModal";
import ImageGallery from "./ImageGallery";

type PresenceUser = {
  user_id: string;
  first_name?: string;
  avatar_url?: string;
};

export default function ListDetailView({ list, onBack }: any) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"places" | "members">("places");
  const [villas, setVillas] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [viewingUsers, setViewingUsers] = useState<PresenceUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [galleryImages, setGalleryImages] = useState<string[] | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteVilla, setPasteVilla] = useState<any>(null); // When set, paste updates this villa (thin/error)
  const [lastFailedUrl, setLastFailedUrl] = useState("");
  const [lastFailedPaste, setLastFailedPaste] = useState("");

  // Lazy load data only when component mounts (view is active)
  useEffect(() => {
    if (!dataLoaded) {
      loadData();
    }
  }, []);

  // Subscribe to realtime villa updates + presence (who's viewing)
  useEffect(() => {
    if (!dataLoaded || !user) return;

    const meta = user.user_metadata || {};
    const first_name =
      meta.full_name ||
      meta.name ||
      (user.email ? user.email.split("@")[0] : "") ||
      user.id.slice(0, 8);
    const avatar_url = meta.avatar_url || meta.picture || undefined;
    const presencePayload = { user_id: user.id, first_name, avatar_url };

    const channel = supabase.channel(`list:${list.id}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "villas",
          filter: `list_id=eq.${list.id}`,
        },
        (payload: {
          eventType?: string;
          event?: string;
          new?: any;
          old?: { id?: string } | Record<string, unknown>;
        }) => {
          const event = payload.eventType ?? payload.event;
          const newRow = payload.new;
          const oldRow = payload.old;
          setVillas((prev) => {
            if (event === "INSERT" && newRow) {
              return [newRow, ...prev];
            }
            if (event === "UPDATE" && newRow) {
              return prev.map((v) => (v.id === newRow.id ? newRow : v));
            }
            if (event === "DELETE" && oldRow) {
              const id = (oldRow as { id?: string }).id;
              if (id != null) return prev.filter((v) => v.id !== id);
            }
            return prev;
          });
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        for (const key of Object.keys(state)) {
          const presences = state[key] as {
            user_id?: string;
            first_name?: string;
            avatar_url?: string;
          }[];
          for (const p of presences) {
            if (p?.user_id)
              users.push({
                user_id: p.user_id,
                first_name: p.first_name,
                avatar_url: p.avatar_url,
              });
          }
        }
        setViewingUsers(users);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          channel.track(presencePayload);
        }
      });

    return () => {
      channel.untrack().then(() => channel.unsubscribe());
    };
  }, [list.id, dataLoaded, user]);

  async function loadData(silent = false) {
    if (!silent) setIsLoading(true);
    try {
      const [villasData, membersData] = await Promise.all([
        getVillas(list.id),
        getListMembers(list.id),
      ]);
      setVillas(villasData || []);
      setMembers(membersData?.members || []);
      setDataLoaded(true);
    } catch (err) {
      console.error("Failed to load data:", err);
      setError("Failed to load data");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  async function handleScoutUrl(url: string, villaId?: string) {
    setError("");
    setLastFailedUrl("");
    try {
      const result = await scoutUrl(url, list.id, villaId);
      if (result.ok) {
        if (Notification.permission === "granted") {
          new Notification("Scouting...", {
            body: "Processing listing...",
            icon: "⏳",
          });
        }
      } else {
        setLastFailedUrl(url);
        if (Notification.permission === "granted") {
          new Notification("Scouting Failed", {
            body: result.error || "Failed to scout getaway",
            icon: "✕",
          });
        }
        setError(result.error || "Failed to scout getaway");
      }
    } catch (err: any) {
      setLastFailedUrl(url);
      setError(err.message || "Failed to scout getaway");
      if (Notification.permission === "granted") {
        new Notification("Error", {
          body: err.message || "Failed to scout getaway",
          icon: "✕",
        });
      }
    }
  }

  async function handleScoutPaste(text: string) {
    setError("");
    setLastFailedPaste("");
    setShowPasteModal(false);
    const villaId = pasteVilla?.id ?? undefined;
    const originalUrl = pasteVilla?.original_url ?? undefined;
    try {
      const result = await scoutPaste(text, list.id, originalUrl, villaId);
      if (result.ok) {
        setPasteVilla(null);
        if (Notification.permission === "granted") {
          new Notification("Processing Paste...", {
            body: "Extracting getaway details...",
            icon: "⏳",
          });
        }
      } else {
        setLastFailedPaste(text);
        setError(result.error || "Failed to process paste");
        setShowPasteModal(true);
        if (Notification.permission === "granted") {
          new Notification("Error", {
            body: result.error || "Failed to process paste",
            icon: "✕",
          });
        }
      }
    } catch (err: any) {
      setLastFailedPaste(text);
      setError(err.message || "Failed to process paste");
      setShowPasteModal(true);
      if (Notification.permission === "granted") {
        new Notification("Error", {
          body: err.message || "Failed to process paste",
          icon: "✕",
        });
      }
    }
  }

  // Request notification permission on component mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  async function handleRetryVilla(villa: any) {
    if (!villa?.original_url) return;
    try {
      await handleScoutUrl(villa.original_url, villa.id);
      // Realtime will update the existing row
    } catch (err: any) {
      setError(err.message || "Failed to retry");
    }
  }

  async function handleDeleteVilla(villaId: string) {
    if (!confirm("Delete this getaway?")) return;

    try {
      const villa = villas.find((v: any) => v.id === villaId);
      if (villa) {
        await deleteVilla(list.id, villa?.slug);
        setVillas(villas.filter((v: any) => v.id !== villaId));
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete getaway");
    }
  }

  async function handleUpdateVilla(villaId: string, updatedData: any) {
    try {
      const villa = villas.find((v: any) => v.id === villaId);
      if (villa) {
        await updateVilla(list.id, villa.slug, updatedData);
        await loadData(true); // silent - Realtime will also fire
      }
    } catch (err: any) {
      setError(err.message || "Failed to update getaway");
    }
  }

  async function handleCreateInvite() {
    try {
      const invite = await createInvite(list.id, "editor");
      setInviteLink(`${window.location.origin}/join/${invite.token}`);
    } catch (err: any) {
      setError(err.message || "Failed to create invite");
    }
  }

  function handleImageClick(images: string[], index: number) {
    setGalleryImages(images);
    setGalleryIndex(index);
  }

  function handlePasteClick(villa: any) {
    setPasteVilla(villa);
    setLastFailedPaste("");
    setShowPasteModal(true);
  }

  return (
    <>
      {/* Header */}
      <div
        style={{
          padding: "1.5rem 2rem 1rem",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            onClick={onBack}
            style={{
              background: "transparent",
              border: "none",
              color: "var(--accent)",
              fontSize: "1.5rem",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ←
          </button>
          <h1 style={{ margin: 0 }}>{list.name}</h1>
          {viewingUsers.filter((u) => u.user_id !== user?.id).length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginLeft: "1rem",
                padding: "0.25rem 0.75rem",
                background: "var(--surface)",
                borderRadius: "999px",
                border: "1px solid var(--border)",
                fontSize: "0.8rem",
                color: "var(--muted)",
              }}
              title={viewingUsers
                .map((u) => u.first_name || u.user_id.slice(0, 8))
                .join(", ")}
            >
              <span>Viewing with</span>
              <div style={{ display: "flex", marginLeft: "0.25rem" }}>
                {viewingUsers
                  .filter((u) => u.user_id !== user?.id)
                  .slice(0, 5)
                  .map((u) => (
                    <div
                      key={u.user_id}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        overflow: "hidden",
                        marginLeft: -6,
                        border: "2px solid var(--bg)",
                        flexShrink: 0,
                        background: "var(--border)",
                      }}
                      title={u.first_name || u.user_id.slice(0, 8)}
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt=""
                          referrerPolicy="no-referrer"
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--muted)",
                            fontSize: "0.65rem",
                            fontWeight: 600,
                          }}
                        >
                          {(u.first_name || u.user_id).charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid var(--border)",
          padding: "0 2rem",
        }}
      >
        <button
          onClick={() => setActiveTab("places")}
          style={{
            background: "transparent",
            border: "none",
            color: activeTab === "places" ? "var(--accent)" : "var(--muted)",
            padding: "1rem 1.5rem",
            cursor: "pointer",
            borderBottom:
              activeTab === "places" ? "2px solid var(--accent)" : "none",
            transition: "color 0.2s",
            fontSize: "0.9rem",
            fontWeight: "600",
          }}
        >
          Places
        </button>
        <button
          onClick={() => setActiveTab("members")}
          style={{
            background: "transparent",
            border: "none",
            color: activeTab === "members" ? "var(--accent)" : "var(--muted)",
            padding: "1rem 1.5rem",
            cursor: "pointer",
            borderBottom:
              activeTab === "members" ? "2px solid var(--accent)" : "none",
            transition: "color 0.2s",
            fontSize: "0.9rem",
            fontWeight: "600",
          }}
        >
          Members ({members.length})
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeTab === "places" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              overflow: "hidden",
            }}
          >
            <div style={{ padding: "1.5rem 2rem", flexShrink: 0 }}>
              <DropZone onUrlSubmit={handleScoutUrl} isLoading={false} />
            </div>

            {error && (
              <div
                style={{
                  margin: "0 2rem 1rem",
                  padding: "1rem",
                  background: "var(--red-soft)",
                  border: "1px solid var(--red)",
                  borderRadius: "8px",
                  color: "var(--red)",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                }}
              >
                <span>{error}</span>
                {(lastFailedUrl || lastFailedPaste) && (
                  <button
                    onClick={() => {
                      if (lastFailedUrl) {
                        setLastFailedUrl("");
                        setError("");
                        handleScoutUrl(lastFailedUrl);
                      } else if (lastFailedPaste) {
                        setShowPasteModal(true);
                        setError("");
                      }
                    }}
                    style={{
                      background: "var(--red)",
                      color: "#fff",
                      border: "none",
                      padding: "0.35rem 0.75rem",
                      borderRadius: "6px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            <div
              style={{ flex: 1, padding: "0 2rem 1.5rem", overflow: "hidden" }}
            >
              <VillaTable
                villas={villas}
                isLoading={isLoading}
                onDelete={handleDeleteVilla}
                onUpdate={handleUpdateVilla}
                onImageClick={handleImageClick}
                onRetry={handleRetryVilla}
                onPasteClick={handlePasteClick}
              />
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <div
            style={{
              padding: "1.5rem 2rem",
              display: "flex",
              flexDirection: "column",
              flex: 1,
              overflow: "auto",
            }}
          >
            {/* Share Section */}
            <div style={{ marginBottom: "2rem" }}>
              <h3 style={{ marginBottom: "1rem", color: "var(--light)" }}>
                Share This List
              </h3>
              {inviteLink ? (
                <div
                  style={{
                    padding: "1rem",
                    background: "var(--green-soft)",
                    border: "1px solid var(--green)",
                    borderRadius: "8px",
                    color: "var(--green)",
                  }}
                >
                  <p style={{ marginBottom: "0.5rem", fontSize: "0.9rem" }}>
                    Share this link:
                  </p>
                  <code
                    style={{
                      fontSize: "0.8rem",
                      wordBreak: "break-all",
                      display: "block",
                      marginBottom: "0.75rem",
                    }}
                  >
                    {inviteLink}
                  </code>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(inviteLink);
                      setInviteLink("");
                    }}
                    style={{
                      background: "transparent",
                      border: "1px solid var(--green)",
                      color: "var(--green)",
                      padding: "0.25rem 0.75rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "0.85rem",
                    }}
                  >
                    Copied!
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleCreateInvite}
                  style={{
                    background: "var(--accent)",
                    color: "#fff",
                    padding: "0.6rem 1.25rem",
                    borderRadius: "8px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: "600",
                  }}
                >
                  Generate Invite Link
                </button>
              )}
            </div>

            {/* Members List */}
            <div>
              <h3 style={{ marginBottom: "1rem", color: "var(--light)" }}>
                Members ({members.length})
              </h3>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.75rem",
                }}
              >
                {[...members]
                  .sort(
                    (a, b) => (b.is_creator ? 1 : 0) - (a.is_creator ? 1 : 0),
                  )
                  .map((member: any) => (
                    <MemberRow
                      key={member.user_id}
                      user_id={member.user_id}
                      profile={member.profile}
                      role={member.is_creator ? "Owner" : member.role}
                      subtitle={
                        member.is_creator
                          ? "Owner"
                          : member.joined_at
                            ? `Joined ${new Date(member.joined_at).toLocaleDateString()}`
                            : "—"
                      }
                    />
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Image Gallery */}
      {galleryImages && (
        <ImageGallery
          images={galleryImages}
          initialIndex={galleryIndex}
          onClose={() => setGalleryImages(null)}
        />
      )}

      {/* Paste Modal */}
      <PasteModal
        isOpen={showPasteModal}
        onClose={() => {
          setShowPasteModal(false);
          setPasteVilla(null);
          setLastFailedPaste("");
        }}
        onSubmit={handleScoutPaste}
        isLoading={false}
        initialText={lastFailedPaste}
      />
    </>
  );
}


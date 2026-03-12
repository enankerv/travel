"use client";

import { useState, useEffect } from "react";
import { getListInvites, createInvite, revokeInvite } from "@/lib/api";

type InviteLinkSectionProps = {
  listId: string;
  onError: (message: string) => void;
};

export default function InviteLinkSection({ listId, onError }: InviteLinkSectionProps) {
  const [inviteLink, setInviteLink] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    getListInvites(listId)
      .then((data) => {
        if (cancelled) return;
        const invites = data?.invites || [];
        const active = invites.find((i: any) => i.is_active !== false);
        if (active?.token && typeof window !== "undefined") {
          setInviteToken(active.token);
          setInviteLink(`${window.location.origin}/join/${active.token}`);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [listId]);

  async function handleRegenerate() {
    setIsRegenerating(true);
    try {
      const invite = await createInvite(listId, "editor");
      setInviteToken(invite.token);
      setInviteLink(`${window.location.origin}/join/${invite.token}`);
    } catch (err: any) {
      onError(err.message || "Failed to create invite");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleRevoke() {
    if (!inviteToken) return;
    if (!confirm("Revoke this invite link? Anyone with the link will no longer be able to join.")) return;
    setIsRevoking(true);
    try {
      await revokeInvite(inviteToken);
      setInviteLink("");
      setInviteToken("");
    } catch (err: any) {
      onError(err.message || "Failed to revoke invite");
    } finally {
      setIsRevoking(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="invite-link-section">
      <h3 className="invite-link-section__title">Share This List</h3>
      <p className="invite-link-section__notice">
        Generating a new link revokes any previous link. Anyone with the old link will no longer be able to join.
      </p>

      {inviteLink ? (
        <div className="invite-link-section__box">
          {isRegenerating ? (
            <>
              <div className="spinner invite-link-section__spinner" />
              <p className="invite-link-section__regen-text">Regenerating…</p>
              <div className="invite-link-section__actions">
                <button
                  type="button"
                  disabled
                  className="invite-link-section__btn-copy"
                >
                  Copy link
                </button>
                <button
                  type="button"
                  disabled
                  className="invite-link-section__btn-regen"
                >
                  Regenerate invite link
                </button>
                <button type="button" disabled className="invite-link-section__btn-delete">
                  Delete link
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="invite-link-section__link-label">
                Current invite link:
              </p>
              <code className="invite-link-section__code">{inviteLink}</code>
              <div className="invite-link-section__actions invite-link-section__actions--with-link">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="invite-link-section__btn-copy"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRevoking}
                  className="invite-link-section__btn-regen"
                >
                  Regenerate invite link
                </button>
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  className="invite-link-section__btn-delete"
                >
                  {isRevoking ? "Revoking…" : "Delete link"}
                </button>
              </div>
            </>
          )}
        </div>
      ) : isLoading ? (
        <button
          type="button"
          disabled
          className="invite-link-section__btn-generate"
        >
          <span className="spinner" />
          Loading…
        </button>
      ) : (
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="invite-link-section__btn-generate"
        >
          {isRegenerating ? (
            <>
              <span className="spinner" />
              Regenerating…
            </>
          ) : (
            "Generate invite link"
          )}
        </button>
      )}
    </div>
  );
}

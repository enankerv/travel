"use client";

type InviteLinkSectionProps = {
  inviteLink: string;
  isRegenerating: boolean;
  copied: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
};

export default function InviteLinkSection({
  inviteLink,
  isRegenerating,
  copied,
  onCopy,
  onRegenerate,
}: InviteLinkSectionProps) {
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
                  onClick={onCopy}
                  className="invite-link-section__btn-copy"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={onRegenerate}
                  className="invite-link-section__btn-regen"
                >
                  Regenerate invite link
                </button>
              </div>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onRegenerate}
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

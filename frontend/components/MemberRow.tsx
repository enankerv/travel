"use client";

export type MemberRowProps = {
  user_id: string;
  profile?: { first_name?: string; avatar_url?: string };
  role: string;
  subtitle: string;
  onRemove?: () => void;
  removeLabel?: string;
  isRemoving?: boolean;
};

export default function MemberRow({
  user_id,
  profile,
  role,
  subtitle,
  onRemove,
  removeLabel = "Remove",
  isRemoving,
}: MemberRowProps) {
  const displayName = profile?.first_name || user_id.slice(0, 8) + "…";
  return (
    <div className="member-row">
      <div className="member-row__main">
        <div className="member-row__avatar">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="member-row__avatar-fallback">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <p className="member-row__name">{displayName}</p>
          <p className="member-row__subtitle">{subtitle}</p>
        </div>
      </div>
      <div className="member-row__meta">
        <span className="member-row__role">{role}</span>
        {onRemove && (
          <button
            type="button"
            className="member-row__remove"
            disabled={isRemoving}
            onClick={onRemove}
          >
            {isRemoving ? "Removing…" : removeLabel}
          </button>
        )}
      </div>
    </div>
  );
}

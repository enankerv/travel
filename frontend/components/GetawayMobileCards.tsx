"use client";

import { useSignedImageUrls } from "@/hooks/useSignedImageUrls";
import { ThumbsUpIcon } from "./icons";

export default function GetawayMobileCards({
  getaways,
  votesByGetaway,
  currentUserId,
  canVote,
  onVote,
  onUnvote,
  onCardClick,
}: {
  getaways: any[];
  votesByGetaway?: Record<string, { user_id: string; first_name?: string; avatar_url?: string }[]>;
  currentUserId?: string;
  canVote?: boolean;
  onVote?: (getawayId: string) => void;
  onUnvote?: (getawayId: string) => void;
  onCardClick: (getaway: any) => void;
}) {
  if (!getaways || getaways.length === 0) {
    return (
      <div className="getaway-mobile-cards">
        <div className="getaway-mobile-cards__empty">
          <div className="icon">🏠</div>
          <p>No getaways yet. Scout some listings to get started!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="getaway-mobile-cards">
      {getaways.map((getaway) => (
        <GetawayMobileCard
          key={getaway.id}
          getaway={getaway}
          voters={votesByGetaway?.[getaway.id] || []}
          currentUserId={currentUserId}
          canVote={!!canVote}
          onVote={() => onVote?.(getaway.id)}
          onUnvote={() => onUnvote?.(getaway.id)}
          onClick={() => onCardClick(getaway)}
        />
      ))}
    </div>
  );
}

function GetawayMobileCard({
  getaway,
  voters,
  currentUserId,
  canVote,
  onVote,
  onUnvote,
  onClick,
}: {
  getaway: any;
  voters: { user_id: string; first_name?: string; avatar_url?: string }[];
  currentUserId?: string;
  canVote: boolean;
  onVote: () => void;
  onUnvote: () => void;
  onClick: () => void;
}) {
  const signedUrls = useSignedImageUrls(getaway?.images || []);
  const thumbUrl = signedUrls[0];
  const myVote = currentUserId && voters.some((v) => v.user_id === currentUserId);

  if (getaway.import_status === "loading") {
    return (
      <div className="getaway-mobile-card getaway-mobile-card--loading">
        <div className="getaway-mobile-card__hero">
          <div className="spinner" />
        </div>
        <div className="getaway-mobile-card__body">
          <span className="getaway-mobile-card__name">Processing…</span>
        </div>
      </div>
    );
  }

  if (getaway.import_status === "thin") {
    return (
      <div className="getaway-mobile-card getaway-mobile-card--thin" onClick={onClick}>
        <div className="getaway-mobile-card__hero">
          <div className="getaway-mobile-card__hero-placeholder">⚠️</div>
        </div>
        <div className="getaway-mobile-card__body">
          <span className="getaway-mobile-card__name">Tap to paste details</span>
        </div>
      </div>
    );
  }

  if (getaway.import_status === "error") {
    return (
      <div className="getaway-mobile-card getaway-mobile-card--error" onClick={onClick}>
        <div className="getaway-mobile-card__hero">
          <div className="getaway-mobile-card__hero-placeholder">❌</div>
        </div>
        <div className="getaway-mobile-card__body">
          <span className="getaway-mobile-card__name">Error — tap to retry</span>
        </div>
      </div>
    );
  }

  return (
    <div className="getaway-mobile-card" onClick={onClick}>
      <div className="getaway-mobile-card__hero">
        {thumbUrl ? (
          <img src={thumbUrl} alt={getaway.name} />
        ) : (
          <div className="getaway-mobile-card__hero-placeholder">—</div>
        )}
      </div>
      <div className="getaway-mobile-card__body">
        <span className="getaway-mobile-card__name">{getaway.name || "Getaway"}</span>
        <div className="getaway-mobile-card__likes" onClick={(e) => e.stopPropagation()}>
          {canVote && (
            <button
              type="button"
              className={`getaway-mobile-card__like-btn ${myVote ? "voted" : ""}`}
              onClick={() => (myVote ? onUnvote() : onVote())}
              aria-label={myVote ? "Remove vote" : "Vote"}
            >
              <ThumbsUpIcon size={18} filled={!!myVote} />
            </button>
          )}
          {voters.length > 0 && (
            <span className="getaway-mobile-card__like-count">{voters.length}</span>
          )}
        </div>
      </div>
    </div>
  );
}

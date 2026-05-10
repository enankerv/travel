"use client";

import { useSignedImageUrls } from "@/hooks/useSignedImageUrls";
import { useListDetailContext } from "@/lib/ListDetailContext";
import { formatPerPersonLine } from "@/lib/pricePerPerson";
import { CommentIcon, ThumbsUpIcon } from "./icons";

function formatListingPrice(price: number | null | undefined, currency?: string | null) {
  if (price == null) return "—";
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${Number(price).toLocaleString()}`;
}

export default function GetawayMobileCards({
  getaways,
  votesByGetaway,
  currentUserId,
  canVote,
  onVote,
  onUnvote,
  onCardClick,
  onCommentClick,
  commentsByGetaway,
}: {
  getaways: any[];
  votesByGetaway?: Record<string, { user_id: string; first_name?: string; avatar_url?: string }[]>;
  commentsByGetaway?: Record<string, any[]>;
  currentUserId?: string;
  canVote?: boolean;
  onVote?: (getawayId: string) => void;
  onUnvote?: (getawayId: string) => void;
  onCardClick: (getaway: any) => void;
  onCommentClick?: (getaway: any) => void;
}) {
  const { partySize } = useListDetailContext();

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
          partySize={partySize}
          voters={votesByGetaway?.[getaway.id] || []}
          currentUserId={currentUserId}
          canVote={!!canVote}
          onVote={() => onVote?.(getaway.id)}
          onUnvote={() => onUnvote?.(getaway.id)}
          onClick={() => onCardClick(getaway)}
          onCommentClick={() => onCommentClick?.(getaway)}
          commentCount={commentsByGetaway?.[getaway.id]?.length ?? 0}
        />
      ))}
    </div>
  );
}

function GetawayMobileCard({
  getaway,
  partySize,
  voters,
  currentUserId,
  canVote,
  onVote,
  onUnvote,
  onClick,
  onCommentClick,
  commentCount,
}: {
  getaway: any;
  partySize: number;
  voters: { user_id: string; first_name?: string; avatar_url?: string }[];
  currentUserId?: string;
  canVote: boolean;
  onVote: () => void;
  onUnvote: () => void;
  onClick: () => void;
  onCommentClick?: () => void;
  commentCount: number;
}) {
  const signedUrls = useSignedImageUrls(getaway?.images || []);
  const thumbUrl = signedUrls[0];
  const myVote = currentUserId && voters.some((v) => v.user_id === currentUserId);
  const perPersonLine = formatPerPersonLine(
    getaway.price,
    getaway.price_currency,
    partySize,
  );

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
          <span style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginTop: "0.2rem" }}>
            No credit used
          </span>
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
        <div className="getaway-mobile-card__body-main">
          <span className="getaway-mobile-card__name">{getaway.name || "Getaway"}</span>
          {getaway.price != null && (
            <div className="getaway-mobile-card__price">
              <span>{formatListingPrice(getaway.price, getaway.price_currency)}</span>
              {perPersonLine && (
                <span className="getaway-mobile-card__price-per">{perPersonLine}</span>
              )}
            </div>
          )}
        </div>
        <div className="getaway-mobile-card__likes" onClick={(e) => e.stopPropagation()}>
          {onCommentClick && (
            <button
              type="button"
              className="getaway-mobile-card__like-btn getaway-mobile-card__like-btn--comment"
              onClick={() => onCommentClick()}
              aria-label="Comments"
            >
              <CommentIcon size={18} />
              {commentCount > 0 && (
                <span className="getaway-mobile-card__comment-count">{commentCount}</span>
              )}
            </button>
          )}
          {(canVote || voters.length > 0) && (
            <div className="getaway-mobile-card__vote-group">
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
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import { useSignedImageUrls } from "@/hooks/useSignedImageUrls";
import { useListDetailContext } from "@/lib/ListDetailContext";
import { formatPerPersonLine } from "@/lib/pricePerPerson";
import { CommentIcon, ThumbsUpIcon, TrashIcon } from "./icons";
function formatListingPrice(price: number | null | undefined, currency?: string | null) {
  if (price == null) return "—";
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${Number(price).toLocaleString()}`;
}

type PendingVariant = "loading" | "thin" | "error";

const PENDING_CARD_MOD: Record<PendingVariant, string> = {
  loading: "getaway-mobile-card--loading",
  thin: "getaway-mobile-card--thin",
  error: "getaway-mobile-card--error",
};

function PendingCardActions({
  getawayId,
  onDelete,
}: {
  getawayId: string;
  onDelete?: (getawayId: string) => void;
}) {
  if (!onDelete) return null;
  return (
    <div className="getaway-mobile-card__likes" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="getaway-mobile-card__like-btn getaway-mobile-card__delete-btn"
        onClick={() => onDelete(getawayId)}
        aria-label="Delete listing"
        title="Delete"
      >
        <TrashIcon size={18} />
      </button>
    </div>
  );
}

/** Shared layout for loading / thin-scrape / error mobile cards (hero + body + optional delete). */
function GetawayMobilePendingCard({
  variant,
  getawayId,
  onDelete,
  onCardClick,
  hero,
  children,
}: {
  variant: PendingVariant;
  getawayId: string;
  onDelete?: (getawayId: string) => void;
  onCardClick?: () => void;
  hero: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`getaway-mobile-card ${PENDING_CARD_MOD[variant]}`} onClick={onCardClick}>
      <div className="getaway-mobile-card__hero">{hero}</div>
      <div className="getaway-mobile-card__body">
        <div className="getaway-mobile-card__body-main">{children}</div>
        <PendingCardActions getawayId={getawayId} onDelete={onDelete} />
      </div>
    </div>
  );
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
  onDelete,
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
  onDelete?: (getawayId: string) => void;
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
          onDelete={onDelete}
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
  onDelete,
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
  onDelete?: (getawayId: string) => void;
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
      <GetawayMobilePendingCard
        variant="loading"
        getawayId={getaway.id}
        onDelete={onDelete}
        hero={<div className="spinner" />}
      >
        <span className="getaway-mobile-card__name">Processing…</span>
      </GetawayMobilePendingCard>
    );
  }

  if (getaway.import_status === "thin") {
    return (
      <GetawayMobilePendingCard
        variant="thin"
        getawayId={getaway.id}
        onDelete={onDelete}
        onCardClick={onClick}
        hero={<div className="getaway-mobile-card__hero-placeholder">⚠️</div>}
      >
        <span className="getaway-mobile-card__name">Tap to paste details</span>
        <span
          style={{ fontSize: "0.8rem", color: "var(--muted)", display: "block", marginTop: "0.2rem" }}
        >
          No credit used
        </span>
      </GetawayMobilePendingCard>
    );
  }

  if (getaway.import_status === "error") {
    return (
      <GetawayMobilePendingCard
        variant="error"
        getawayId={getaway.id}
        onDelete={onDelete}
        onCardClick={onClick}
        hero={<div className="getaway-mobile-card__hero-placeholder">❌</div>}
      >
        <span className="getaway-mobile-card__name">Error — tap to retry</span>
      </GetawayMobilePendingCard>
    );
  }

  return (
    <div className="getaway-mobile-card" onClick={onClick}>
      <div className="getaway-mobile-card__hero">
        {thumbUrl ? (
          <img src={thumbUrl} alt={getaway.title ?? ""} />
        ) : (
          <div className="getaway-mobile-card__hero-placeholder">—</div>
        )}
      </div>
      <div className="getaway-mobile-card__body">
        <div className="getaway-mobile-card__body-main">
          <span className="getaway-mobile-card__name">{getaway.title || "Getaway"}</span>
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

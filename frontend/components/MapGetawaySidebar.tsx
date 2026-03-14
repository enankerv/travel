"use client";

import { useSignedImageUrls } from "@/hooks/useSignedImageUrls";
import { CommentIcon, ExternalLinkIcon } from "./icons";

function formatPrice(price: number | null | undefined, currency?: string | null) {
  if (price == null) return "—";
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${Number(price).toLocaleString()}`;
}

function listJoin(arr: string[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return "—";
  return arr.filter(Boolean).join(", ") || "—";
}

export default function MapGetawaySidebar({
  getaway,
  onClose,
  onImageClick,
  onCommentClick,
  commentsCount = 0,
}: {
  getaway: any;
  onClose: () => void;
  onImageClick?: (images: string[], index: number) => void;
  onCommentClick?: () => void;
  commentsCount?: number;
}) {
  const signedUrls = useSignedImageUrls(getaway?.images || []);
  const thumbUrl = signedUrls[0];

  if (!getaway) return null;

  return (
    <div className="map-getaway-sidebar">
      <div className="map-getaway-sidebar__header">
        <h3>{getaway.name || "Getaway"}</h3>
        <button
          type="button"
          onClick={onClose}
          className="map-getaway-sidebar__close"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <div className="map-getaway-sidebar__content">
        {thumbUrl && (
          <div
            className="map-getaway-sidebar__thumb"
            onClick={() =>
              onImageClick?.(signedUrls, 0)
            }
          >
            <img src={thumbUrl} alt={getaway.name} />
          </div>
        )}

        <dl className="map-getaway-sidebar__meta">
          {(getaway.location || getaway.region) && (
            <>
              <dt>Location</dt>
              <dd>
                {[getaway.location, getaway.region].filter(Boolean).join(", ")}
              </dd>
            </>
          )}
          {(getaway.bedrooms != null || getaway.bathrooms != null || getaway.max_guests != null) && (
            <>
              <dt>Details</dt>
              <dd>
                {[
                  getaway.bedrooms != null && `${getaway.bedrooms} bed${getaway.bedrooms !== 1 ? "s" : ""}`,
                  getaway.bathrooms != null && `${getaway.bathrooms} bath${getaway.bathrooms !== 1 ? "s" : ""}`,
                  getaway.max_guests != null && `${getaway.max_guests} guest${getaway.max_guests !== 1 ? "s" : ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </dd>
            </>
          )}
          {(getaway.price != null || getaway.price_currency) && (
            <>
              <dt>Price</dt>
              <dd>
                {formatPrice(getaway.price, getaway.price_currency)}
                {getaway.price_period && ` / ${getaway.price_period}`}
              </dd>
            </>
          )}
        </dl>

        {getaway.amenities && Array.isArray(getaway.amenities) && getaway.amenities.length > 0 && (
          <div className="map-getaway-sidebar__section">
            <h4>Amenities</h4>
            <p>{listJoin(getaway.amenities)}</p>
          </div>
        )}

        {getaway.description && (
          <div className="map-getaway-sidebar__section">
            <h4>Description</h4>
            <p className="map-getaway-sidebar__desc">{getaway.description}</p>
          </div>
        )}

        {getaway.caveats && (
          <div className="map-getaway-sidebar__section">
            <h4>Caveats</h4>
            <p>{getaway.caveats}</p>
          </div>
        )}

        {getaway.included && Array.isArray(getaway.included) && getaway.included.length > 0 && (
          <div className="map-getaway-sidebar__section">
            <h4>Included</h4>
            <p>{listJoin(getaway.included)}</p>
          </div>
        )}

        <div className="map-getaway-sidebar__actions">
          {getaway.source_url && (
            <a
              href={getaway.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="map-getaway-sidebar__link"
            >
              <ExternalLinkIcon size={16} />
              View listing
            </a>
          )}
          {onCommentClick && (
            <button
              type="button"
              className="map-getaway-sidebar__comment-btn"
              onClick={onCommentClick}
            >
              <CommentIcon size={16} />
              Comments {commentsCount > 0 && `(${commentsCount})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

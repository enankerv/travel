"use client";

import { useSignedImageUrls } from "@/hooks/useSignedImageUrls";
import { ExternalLinkIcon } from "./icons";
import InlineComments from "./InlineComments";

function formatPrice(price: number | null | undefined, currency?: string | null) {
  if (price == null) return "—";
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${Number(price).toLocaleString()}`;
}

function listJoin(arr: string[] | null | undefined): string {
  if (!arr || !Array.isArray(arr)) return "—";
  return arr.filter(Boolean).join(", ") || "—";
}

export default function GetawayDetailSheet({
  getaway,
  onClose,
  onImageClick,
}: {
  getaway: any;
  onClose: () => void;
  onImageClick?: (images: string[], index: number) => void;
}) {
  const signedUrls = useSignedImageUrls(getaway?.images || []);
  const thumbUrl = signedUrls[0];

  if (!getaway) return null;

  return (
    <div className="getaway-detail-sheet" role="dialog" aria-modal="true">
      <div className="getaway-detail-sheet__backdrop" onClick={onClose} aria-hidden="true" />
      <div className="getaway-detail-sheet__panel">
        <div className="getaway-detail-sheet__handle" aria-hidden="true" />
        <div className="getaway-detail-sheet__header">
          <h2>{getaway.name || "Getaway"}</h2>
          <button
            type="button"
            onClick={onClose}
            className="getaway-detail-sheet__close"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="getaway-detail-sheet__content">
          {thumbUrl && (
            <div
              className="getaway-detail-sheet__hero"
              onClick={() => onImageClick?.(signedUrls, 0)}
            >
              <img src={thumbUrl} alt={getaway.name} />
            </div>
          )}

          <dl className="getaway-detail-sheet__meta">
            {(getaway.location || getaway.region) && (
              <>
                <dt>Location</dt>
                <dd>{[getaway.location, getaway.region].filter(Boolean).join(", ")}</dd>
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
            <div className="getaway-detail-sheet__section">
              <h4>Amenities</h4>
              <p>{listJoin(getaway.amenities)}</p>
            </div>
          )}

          {getaway.description && (
            <div className="getaway-detail-sheet__section">
              <h4>Description</h4>
              <p className="getaway-detail-sheet__desc">{getaway.description}</p>
            </div>
          )}

          {getaway.caveats && (
            <div className="getaway-detail-sheet__section">
              <h4>Caveats</h4>
              <p>{getaway.caveats}</p>
            </div>
          )}

          {getaway.included && Array.isArray(getaway.included) && getaway.included.length > 0 && (
            <div className="getaway-detail-sheet__section">
              <h4>Included</h4>
              <p>{listJoin(getaway.included)}</p>
            </div>
          )}

          <div className="getaway-detail-sheet__actions">
            {getaway.source_url && (
              <a
                href={getaway.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="getaway-detail-sheet__link"
              >
                <ExternalLinkIcon size={16} />
                View listing
              </a>
            )}
          </div>

          <InlineComments getawayId={getaway.id} />
        </div>
      </div>
    </div>
  );
}

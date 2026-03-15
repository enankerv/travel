"use client";

import { useState } from "react";
import { useSignedImageUrls } from "@/hooks/useSignedImageUrls";
import { parseAmenitiesInput } from "@/components/AmenitiesCell";
import { ExternalLinkIcon, TrashIcon } from "./icons";
import GetawayEditForm from "./GetawayEditForm";
import ImageCarousel from "./ImageCarousel";
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
  onDelete,
  onUpdate,
}: {
  getaway: any;
  onClose: () => void;
  onDelete?: (getawayId: string) => void;
  onUpdate?: (getawayId: string, updates: any) => void;
}) {
  const signedUrls = useSignedImageUrls(getaway?.images || []);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>(() => ({ ...getaway }));

  if (!getaway) return null;

  const handleSave = () => {
    if (!onUpdate) return;
    const toSend = { ...editData };
    if (toSend.amenities != null && typeof toSend.amenities === "string") {
      toSend.amenities = parseAmenitiesInput(toSend.amenities);
    }
    if (toSend.amenities != null && !Array.isArray(toSend.amenities)) {
      toSend.amenities = [String(toSend.amenities)];
    }
    if (toSend.included != null && typeof toSend.included === "string") {
      toSend.included = parseAmenitiesInput(toSend.included);
    }
    if (toSend.included != null && !Array.isArray(toSend.included)) {
      toSend.included = [String(toSend.included)];
    }
    const { id, list_id, slug, images, created_at, updated_at, import_status, import_error, source_url, ...rest } = toSend;
    onUpdate(getaway.id, rest);
    setIsEditing(false);
    onClose();
  };

  const handleCancel = () => {
    setEditData({ ...getaway });
    setIsEditing(false);
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(getaway.id);
      onClose();
    }
  };

  return (
    <div className="getaway-detail-sheet" role="dialog" aria-modal="true">
      <div
        className="getaway-detail-sheet__backdrop"
        onClick={() => (isEditing ? handleCancel() : onClose())}
        aria-hidden="true"
      />
      <div className="getaway-detail-sheet__panel">
        <div className="getaway-detail-sheet__handle" aria-hidden="true" />
        <div className="getaway-detail-sheet__header">
          <h2>{isEditing ? "Edit listing" : (getaway.name || "Getaway")}</h2>
          <div className="getaway-detail-sheet__header-actions">
            {isEditing ? (
              <>
                <button type="button" className="sheet-edit-btn sheet-edit-btn-cancel" onClick={handleCancel}>
                  Cancel
                </button>
                <button type="button" className="sheet-edit-btn sheet-edit-btn-save" onClick={handleSave}>
                  Save
                </button>
              </>
            ) : (
              <>
                {onUpdate && (
                  <button
                    type="button"
                    className="getaway-detail-sheet__action-btn"
                    onClick={() => {
                      setEditData({ ...getaway });
                      setIsEditing(true);
                    }}
                    aria-label="Edit"
                    title="Edit"
                  >
                    ✎
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    className="getaway-detail-sheet__action-btn getaway-detail-sheet__action-btn--delete"
                    onClick={handleDelete}
                    aria-label="Delete"
                    title="Delete"
                  >
                    <TrashIcon size={18} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="getaway-detail-sheet__close"
                  aria-label="Close"
                >
                  ×
                </button>
              </>
            )}
          </div>
        </div>

        <div className="getaway-detail-sheet__content">
          {isEditing ? (
            <GetawayEditForm editData={editData} setEditData={setEditData} />
          ) : (
            <>
              {signedUrls.length > 0 && (
                <ImageCarousel
                  images={signedUrls}
                  alt={getaway.name || "Getaway"}
                  className="getaway-detail-sheet__carousel"
                />
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";
import ExpandableCell from "@/components/ExpandableCell";
import EditableCell from "@/components/EditableCell";
import VoteCell from "@/components/VoteCell";
import { TrashIcon, ExternalLinkIcon } from "@/components/icons";

export const COLUMN_KEYS = [
  "votes",
  "image",
  "name",
  "location",
  "beds",
  "baths",
  "guests",
  "price",
  "amenities",
  "description",
  "caveats",
  "included",
  "actions",
] as const;

export type ColumnKey = (typeof COLUMN_KEYS)[number];

export type VisibleColumns = Record<ColumnKey, boolean>;

export const DEFAULT_VISIBLE: VisibleColumns = {
  votes: true,
  image: true,
  name: true,
  location: true,
  beds: true,
  baths: true,
  guests: true,
  price: true,
  amenities: true,
  description: false,
  caveats: false,
  included: false,
  actions: true,
};

function formatPrice(
  price: number | null | undefined,
  currency?: string | null,
) {
  if (price == null) return "—";
  const sym = currency === "EUR" ? "€" : "$";
  return `${sym}${Number(price).toLocaleString()}`;
}

export type CellRenderContext = {
  key: ColumnKey;
  className: string;
  getaway: any;
  editData: any;
  setEditData: (d: any) => void;
  isEditing: boolean;
  thumbUrl: string | null;
  onEditStart?: () => void;
  onDelete?: () => void;
  onImageClick: (e: React.MouseEvent) => void;
  handleSave: () => void;
  handleCancel: () => void;
  votesByGetaway?: Record<string, { user_id: string; first_name?: string; avatar_url?: string }[]>;
  commentsByGetaway?: Record<string, any[]>;
  onCommentClick?: () => void;
  currentUserId?: string;
  canVote?: boolean;
  onVote?: (getawayId: string) => void;
  onUnvote?: (getawayId: string) => void;
};

type ColumnDef = {
  key: ColumnKey;
  className: string;
  label: string;
  render: (ctx: CellRenderContext) => ReactNode;
};

const COLUMN_CONFIG: Record<ColumnKey, ColumnDef> = {
  votes: {
    key: "votes",
    className: "col-votes",
    label: "",
    render: ({
      getaway,
      votesByGetaway,
      currentUserId,
      canVote,
      onVote,
      onUnvote,
      className,
    }) => {
      const voters = (votesByGetaway && votesByGetaway[getaway.id]) || [];
      return (
        <VoteCell
          voters={voters}
          currentUserId={currentUserId}
          canVote={!!canVote}
          onVote={() => onVote?.(getaway.id)}
          onUnvote={() => onUnvote?.(getaway.id)}
          className={className}
        />
      );
    },
  },
  image: {
    key: "image",
    className: "col-thumb",
    label: "Image",
    render: ({ getaway, isEditing, thumbUrl, onImageClick, className }) => (
      <td className={className}>
        {getaway.images?.length > 0 && thumbUrl ? (
          isEditing ? (
            <img src={thumbUrl} alt={getaway.name} className="thumb" />
          ) : (
            <div
              className="thumb-link"
              onClick={onImageClick}
              title="Click to view images"
            >
              <img src={thumbUrl} alt={getaway.name} className="thumb" />
            </div>
          )
        ) : (
          <div className="thumb-placeholder">—</div>
        )}
      </td>
    ),
  },
  name: {
    key: "name",
    className: "col-name",
    label: "Name",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="text"
          cellClassName={className}
          value={editData.name}
          onChange={(v) => setEditData({ ...editData, name: v as string })}
        />
      ) : (
        <ExpandableCell
          value={getaway.name}
          cellClassName={className}
          truncateLen={40}
          suffix={
            getaway.source_url ? (
              <a
                href={getaway.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="name-external-link"
                title="Open listing"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLinkIcon size={14} />
              </a>
            ) : null
          }
        />
      ),
  },
  location: {
    key: "location",
    className: "col-loc",
    label: "Location",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="text"
          cellClassName={className}
          value={editData.location}
          onChange={(v) => setEditData({ ...editData, location: v as string })}
        />
      ) : (
        <ExpandableCell
          value={getaway.location}
          cellClassName={className}
          truncateLen={40}
        />
      ),
  },
  beds: {
    key: "beds",
    className: "col-beds",
    label: "Beds",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="number"
          cellClassName={className}
          value={editData.bedrooms}
          onChange={(v) => setEditData({ ...editData, bedrooms: v })}
        />
      ) : (
        <ExpandableCell
          value={getaway.bedrooms}
          cellClassName={className}
          truncateLen={10}
        />
      ),
  },
  baths: {
    key: "baths",
    className: "col-baths",
    label: "Baths",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="number"
          cellClassName={className}
          value={editData.bathrooms}
          onChange={(v) => setEditData({ ...editData, bathrooms: v })}
        />
      ) : (
        <ExpandableCell
          value={getaway.bathrooms}
          cellClassName={className}
          truncateLen={10}
        />
      ),
  },
  guests: {
    key: "guests",
    className: "col-guests",
    label: "Guests",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="number"
          cellClassName={className}
          value={editData.max_guests}
          onChange={(v) => setEditData({ ...editData, max_guests: v })}
        />
      ) : (
        <ExpandableCell
          value={getaway.max_guests}
          cellClassName={className}
          truncateLen={10}
        />
      ),
  },
  price: {
    key: "price",
    className: "col-price",
    label: "Price",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="price"
          cellClassName={className}
          value={editData.price}
          onChange={(v) => setEditData({ ...editData, price: v })}
        />
      ) : (
        <ExpandableCell
          value={formatPrice(getaway.price, getaway.price_currency)}
          cellClassName={className}
          truncateLen={15}
        />
      ),
  },
  amenities: {
    key: "amenities",
    className: "col-amenities",
    label: "Amenities",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="amenities"
          cellClassName={className}
          value={editData.amenities}
          onChange={(v) =>
            setEditData({ ...editData, amenities: v as string[] })
          }
        />
      ) : (
        <ExpandableCell
          value={getaway.amenities}
          cellClassName={className}
          truncateLen={50}
        />
      ),
  },
  description: {
    key: "description",
    className: "col-description",
    label: "Description",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="text"
          cellClassName={className}
          value={editData.description}
          onChange={(v) =>
            setEditData({ ...editData, description: v as string })
          }
        />
      ) : (
        <ExpandableCell
          value={getaway.description}
          cellClassName={className}
          truncateLen={50}
        />
      ),
  },
  caveats: {
    key: "caveats",
    className: "col-caveats",
    label: "Caveats",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="text"
          cellClassName={className}
          value={editData.caveats}
          onChange={(v) => setEditData({ ...editData, caveats: v as string })}
        />
      ) : (
        <ExpandableCell
          value={getaway.caveats}
          cellClassName={className}
          truncateLen={50}
        />
      ),
  },
  included: {
    key: "included",
    className: "col-included",
    label: "Included",
    render: ({ getaway, editData, setEditData, isEditing, className }) =>
      isEditing ? (
        <EditableCell
          type="amenities"
          cellClassName={className}
          value={editData.included}
          onChange={(v) =>
            setEditData({ ...editData, included: v as string[] })
          }
          placeholder="e.g. WiFi, Parking, Pool"
        />
      ) : (
        <ExpandableCell
          value={getaway.included}
          cellClassName={className}
          truncateLen={50}
        />
      ),
  },
  actions: {
    key: "actions",
    className: "col-catch",
    label: "Actions",
    render: ({
      getaway,
      isEditing,
      onEditStart,
      onDelete,
      onCommentClick,
      commentsByGetaway,
      handleSave,
      handleCancel,
      className,
    }) =>
      isEditing ? (
        <td className={className}>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="sheet-edit-btn sheet-edit-btn-save"
              onClick={handleSave}
            >
              Save
            </button>
            <button
              type="button"
              className="sheet-edit-btn sheet-edit-btn-cancel"
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </td>
      ) : (
        <td className={className} onClick={(e) => e.stopPropagation()}>
          <div className="row-actions">
            {onCommentClick && (
              <button
                className="row-action-btn row-action-btn-comment"
                onClick={() => onCommentClick?.()}
                title="Comments"
              >
                💬
                {(commentsByGetaway?.[getaway.id]?.length ?? 0) > 0 && (
                  <span className="row-action-btn-comment__count">
                    {commentsByGetaway?.[getaway.id]?.length ?? 0}
                  </span>
                )}
              </button>
            )}
            <button
              className="row-action-btn"
              onClick={() => onEditStart?.()}
              title="Edit"
            >
              ✎
            </button>
            <button
              className="row-action-btn trash"
              onClick={() => onDelete?.()}
              title="Delete"
            >
              <TrashIcon />
            </button>
          </div>
        </td>
      ),
  },
};

export const COLUMN_BY_KEY = COLUMN_CONFIG;

export const COLUMN_DEFS = COLUMN_KEYS.map((k) => COLUMN_BY_KEY[k]);

/** Get visible column keys in display order. */
export function getVisibleColumnKeys(visible: VisibleColumns): ColumnKey[] {
  return COLUMN_KEYS.filter((k) => visible[k]);
}

/** Context passed from GetawayRow; key and className are filled in by renderColumnCell. */
export type CellRenderContextInput = Pick<
  CellRenderContext,
  | "getaway"
  | "editData"
  | "setEditData"
  | "isEditing"
  | "thumbUrl"
  | "onEditStart"
  | "onDelete"
  | "onImageClick"
  | "handleSave"
  | "handleCancel"
  | "votesByGetaway"
  | "commentsByGetaway"
  | "onCommentClick"
  | "currentUserId"
  | "canVote"
  | "onVote"
  | "onUnvote"
>;

/** Render a cell for the given column key. */
export function renderColumnCell(
  key: ColumnKey,
  ctx: CellRenderContextInput,
): ReactNode {
  const def = COLUMN_BY_KEY[key];
  return def.render({ ...ctx, key, className: def.className });
}

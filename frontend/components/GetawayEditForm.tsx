"use client";

import { parseAmenitiesInput } from "@/components/AmenitiesCell";

function toDisplay(arr: string[] | string | null | undefined): string {
  if (arr == null) return "";
  if (typeof arr === "string") return arr.trim();
  return Array.isArray(arr) ? arr.filter(Boolean).join(", ") : "";
}

type GetawayEditFormProps = {
  editData: any;
  setEditData: (data: any) => void;
};

export default function GetawayEditForm({ editData, setEditData }: GetawayEditFormProps) {
  return (
    <div className="getaway-detail-sheet__edit-form">
      <div className="getaway-detail-sheet__edit-field">
        <label>Name</label>
        <input
          type="text"
          className="sheet-edit-input"
          value={editData.name ?? ""}
          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Location</label>
        <input
          type="text"
          className="sheet-edit-input"
          value={editData.location ?? ""}
          onChange={(e) => setEditData({ ...editData, location: e.target.value })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Region</label>
        <input
          type="text"
          className="sheet-edit-input"
          value={editData.region ?? ""}
          onChange={(e) => setEditData({ ...editData, region: e.target.value })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-row">
        <div className="getaway-detail-sheet__edit-field">
          <label>Beds</label>
          <input
            type="text"
            inputMode="numeric"
            className="sheet-edit-input"
            value={editData.bedrooms != null ? String(editData.bedrooms) : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              const n = parseInt(v, 10);
              setEditData({ ...editData, bedrooms: v === "" ? null : (Number.isNaN(n) ? null : n) });
            }}
          />
        </div>
        <div className="getaway-detail-sheet__edit-field">
          <label>Baths</label>
          <input
            type="text"
            inputMode="numeric"
            className="sheet-edit-input"
            value={editData.bathrooms != null ? String(editData.bathrooms) : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              const n = parseInt(v, 10);
              setEditData({ ...editData, bathrooms: v === "" ? null : (Number.isNaN(n) ? null : n) });
            }}
          />
        </div>
        <div className="getaway-detail-sheet__edit-field">
          <label>Guests</label>
          <input
            type="text"
            inputMode="numeric"
            className="sheet-edit-input"
            value={editData.max_guests != null ? String(editData.max_guests) : ""}
            onChange={(e) => {
              const v = e.target.value.trim();
              const n = parseInt(v, 10);
              setEditData({ ...editData, max_guests: v === "" ? null : (Number.isNaN(n) ? null : n) });
            }}
          />
        </div>
      </div>
      <div className="getaway-detail-sheet__edit-row">
        <div className="getaway-detail-sheet__edit-field">
          <label>Price</label>
          <input
            type="text"
            inputMode="decimal"
            className="sheet-edit-input"
            value={editData.price != null && editData.price !== "" ? String(editData.price) : ""}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              setEditData({ ...editData, price: Number.isNaN(n) ? null : n });
            }}
          />
        </div>
        <div className="getaway-detail-sheet__edit-field">
          <label>Currency</label>
          <select
            className="sheet-edit-input"
            value={editData.price_currency ?? "USD"}
            onChange={(e) => setEditData({ ...editData, price_currency: e.target.value || null })}
          >
            <option value="USD">$ USD</option>
            <option value="EUR">€ EUR</option>
          </select>
        </div>
        <div className="getaway-detail-sheet__edit-field">
          <label>Period</label>
          <input
            type="text"
            className="sheet-edit-input"
            placeholder="e.g. night, week"
            value={editData.price_period ?? ""}
            onChange={(e) => setEditData({ ...editData, price_period: e.target.value || null })}
          />
        </div>
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Amenities</label>
        <input
          type="text"
          className="sheet-edit-input"
          placeholder="e.g. Wifi, Kitchen, Pool"
          value={toDisplay(editData.amenities)}
          onChange={(e) => setEditData({ ...editData, amenities: parseAmenitiesInput(e.target.value) })}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Description</label>
        <textarea
          className="sheet-edit-input getaway-detail-sheet__edit-textarea"
          value={editData.description ?? ""}
          onChange={(e) => setEditData({ ...editData, description: e.target.value })}
          rows={3}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Caveats</label>
        <textarea
          className="sheet-edit-input getaway-detail-sheet__edit-textarea"
          value={editData.caveats ?? ""}
          onChange={(e) => setEditData({ ...editData, caveats: e.target.value })}
          rows={2}
        />
      </div>
      <div className="getaway-detail-sheet__edit-field">
        <label>Included</label>
        <input
          type="text"
          className="sheet-edit-input"
          placeholder="e.g. WiFi, Parking, Pool"
          value={toDisplay(editData.included)}
          onChange={(e) => setEditData({ ...editData, included: parseAmenitiesInput(e.target.value) })}
        />
      </div>
    </div>
  );
}

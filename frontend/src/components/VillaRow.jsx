import { useState } from 'react';
import EditableCell from './EditableCell';

export default function VillaRow({ villa, onUpdate, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);

  const link = villa.original_url || villa.report_path || '';

  function handleRowClick() {
    if (!isEditing && link) {
      window.open(link, '_blank');
    }
  }

  function handleEditClick() {
    setIsEditing(true);
  }

  function handleDeleteClick() {
    onDelete(villa.slug);
  }

  function handleExitEdit() {
    setIsEditing(false);
  }

  return (
    <tr onClick={handleRowClick} style={{ cursor: isEditing ? 'auto' : 'pointer' }}>
      <td className="col-thumb">
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="thumb-link"
          title="Open listing"
          onClick={(e) => e.stopPropagation()}
        >
          {villa.images && villa.images.length ? (
            <img
              className="thumb"
              src={villa.images[0]}
              alt=""
              loading="lazy"
            />
          ) : (
            <div className="thumb-placeholder">🏠</div>
          )}
        </a>
      </td>
      <EditableCell
        slug={villa.slug}
        field="villa_name"
        value={villa.villa_name || villa.title || villa.slug || ''}
        className="col-name"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <EditableCell
        slug={villa.slug}
        field="location"
        value={villa.location || ''}
        className="col-loc"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <EditableCell
        slug={villa.slug}
        field="bedrooms"
        value={villa.bedrooms || ''}
        type="number"
        className="col-beds"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <EditableCell
        slug={villa.slug}
        field="bathrooms"
        value={villa.bathrooms || ''}
        type="number"
        className="col-baths"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <EditableCell
        slug={villa.slug}
        field="max_guests"
        value={villa.max_guests || ''}
        type="number"
        className="col-guests"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <EditableCell
        slug={villa.slug}
        field="price_weekly_usd"
        value={villa.price_weekly_usd || ''}
        className="col-price"
        emptyLabel="add price"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <EditableCell
        slug={villa.slug}
        field="region"
        value={villa.region || ''}
        className="col-pool"
        emptyLabel="add region"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <EditableCell
        slug={villa.slug}
        field="the_catch"
        value={villa.the_catch || ''}
        className="col-catch"
        isEditing={isEditing}
        onUpdate={onUpdate}
      />
      <td style={{ textAlign: 'center', width: '60px' }}>
        <div className="row-actions">
          <button
            className="row-action-btn edit"
            onClick={(e) => {
              e.stopPropagation();
              if (isEditing) {
                handleExitEdit();
              } else {
                handleEditClick();
              }
            }}
            title={isEditing ? 'Done editing' : 'Edit row'}
          >
            {isEditing ? '✓' : '✎'}
          </button>
          <button
            className="row-action-btn trash"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteClick();
            }}
            title="Delete row"
          >
            🗑
          </button>
        </div>
      </td>
    </tr>
  );
}

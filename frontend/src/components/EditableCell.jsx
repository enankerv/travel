import { useState, useEffect } from 'react';

export default function EditableCell({
  slug,
  field,
  value,
  className,
  emptyLabel = 'click to edit',
  type = 'text',
  isEditing,
  onUpdate,
}) {
  const [inputValue, setInputValue] = useState(String(value || ''));
  const [isCellEditing, setIsCellEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setInputValue(String(value || ''));
  }, [value]);

  async function handleSave() {
    const newVal = inputValue.trim();
    const oldVal = String(value || '').trim();

    if (newVal === oldVal) {
      setIsCellEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      const updates = {};
      const NUM_FIELDS = [
        'max_guests',
        'bedrooms',
        'bathrooms',
        'price_weekly_min_eur',
        'price_weekly_max_eur',
        'security_deposit_eur',
      ];
      if (NUM_FIELDS.includes(field)) {
        updates[field] = newVal === '' ? null : Number(newVal);
      } else {
        updates[field] = newVal || null;
      }
      await onUpdate(slug, updates);
      setIsCellEditing(false);
    } catch (err) {
      console.error('Failed to save cell:', err);
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      setInputValue(String(value || ''));
      setIsCellEditing(false);
    }
  }

  if (!isEditing || !isCellEditing) {
    return (
      <td
        className={className}
        onClick={() => isEditing && setIsCellEditing(true)}
        style={{ cursor: isEditing ? 'text' : 'default' }}
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span style={{ color: 'var(--muted)', fontStyle: 'italic', fontSize: '0.8rem' }}>
            {emptyLabel}
          </span>
        )}
      </td>
    );
  }

  return (
    <td className={className}>
      <input
        type={type}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        autoFocus
        disabled={isSaving}
        style={{
          width: '100%',
          background: 'var(--surface)',
          border: '1px solid var(--accent)',
          borderRadius: '4px',
          padding: '0.2rem 0.4rem',
          color: 'var(--light)',
          fontSize: 'inherit',
          fontFamily: 'inherit',
        }}
      />
    </td>
  );
}

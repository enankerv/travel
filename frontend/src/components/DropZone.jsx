import { useState } from 'react';

export default function DropZone({ onScout }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [url, setUrl] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (url.trim()) {
      onScout(url.trim());
      setUrl('');
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragOver(false);
    const text =
      e.dataTransfer.getData('text/uri-list') ||
      e.dataTransfer.getData('text/plain') ||
      '';
    const urlMatch = text
      .split('\n')
      .map((s) => s.trim())
      .find((s) => /^https?:\/\//i.test(s));
    if (urlMatch) {
      onScout(urlMatch);
    }
  }

  return (
    <form
      className={`dropzone ${isDragOver ? 'drag-over' : ''}`}
      onSubmit={handleSubmit}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        type="text"
        placeholder="Paste or drop an Airbnb / villa listing URL here..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
      />
      <span className="hint">or drag a link</span>
      <button type="submit">Scout it</button>
    </form>
  );
}

import { useState } from 'react';
import { SKIP_WORDS, scoreImg } from '../utils/imageScoring';

export default function PasteModal({ url, onSubmit, onCancel }) {
  const [pastedText, setPastedText] = useState('');
  const [imageUrls, setImageUrls] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handlePaste(e) {
    try {
      const html = e.clipboardData.getData('text/html');
      if (!html) return;

      const doc = new DOMParser().parseFromString(html, 'text/html');
      const allImgs = [...doc.querySelectorAll('img[src]')];

      const scored = allImgs
        .map((img) => {
          try {
            return { src: img.getAttribute('src') || '', score: scoreImg(img, SKIP_WORDS) };
          } catch {
            return null;
          }
        })
        .filter(
          (o) =>
            o &&
            o.score >= 0 &&
            o.src.startsWith('http') &&
            (/\.(jpe?g|png|webp)/i.test(o.src) || o.src.includes('/im/pictures/'))
        );

      scored.sort((a, b) => b.score - a.score);

      const seen = new Set();
      const best = [];
      for (const o of scored) {
        const key = o.src.replace(/[-_]\d+x\d+/g, '');
        if (!seen.has(key)) {
          seen.add(key);
          best.push(o.src);
        }
        if (best.length >= 5) break;
      }

      setImageUrls(best);
    } catch (err) {
      console.error('Paste image extraction error:', err);
    }
  }

  async function handleSubmit() {
    if (!pastedText.trim()) return;
    setIsSubmitting(true);
    try {
      await onSubmit(pastedText, imageUrls);
    } finally {
      setIsSubmitting(false);
    }
  }

  const domainName = (() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'the listing';
    }
  })();

  return (
    <div className="modal-overlay open" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Scrape failed — paste it manually</h2>
        <p>
          Open{' '}
          <a href={url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
            {domainName}
          </a>
          , hit{' '}
          <kbd style={{ background: 'var(--surface)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
            Ctrl+A
          </kbd>{' '}
          then{' '}
          <kbd style={{ background: 'var(--surface)', padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.8rem' }}>
            Ctrl+C
          </kbd>
          , and paste below. Images are grabbed from the clipboard automatically.
        </p>
        <textarea
          value={pastedText}
          onChange={(e) => setPastedText(e.target.value)}
          onPaste={handlePaste}
          placeholder="Paste the full listing page here..."
        />
        {imageUrls.length > 0 && (
          <div className="img-badge-modal">
            {imageUrls.length} photo{imageUrls.length > 1 ? 's' : ''} detected from clipboard
          </div>
        )}
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSubmit} disabled={isSubmitting || !pastedText.trim()}>
            {isSubmitting ? 'Building report...' : 'Build report'}
          </button>
        </div>
      </div>
    </div>
  );
}

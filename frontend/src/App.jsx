import { useState, useEffect } from 'react';
import './App.css';
import Header from './components/Header';
import DropZone from './components/DropZone';
import VillaTable from './components/VillaTable';
import PasteModal from './components/PasteModal';
import { api } from './services/api';
import { useNotification } from './hooks/useNotification';

export default function App() {
  const { notify } = useNotification();
  const [villas, setVillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scoutingRows, setScoutingRows] = useState({}); // { rowId: { status, url, error } }
  const [pasteModal, setPasteModal] = useState(null); // { rowId, url } or null

  useEffect(() => {
    loadVillas();
  }, []);

  async function loadVillas() {
    try {
      setLoading(true);
      const data = await api.getVillas();
      setVillas(data.villas || []);
    } catch (err) {
      console.error('Failed to load villas:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleScoutUrl(url) {
    const rowId = `row-${Date.now()}`;
    setScoutingRows((prev) => ({
      ...prev,
      [rowId]: { status: 'scouting', url, error: null },
    }));

    try {
      const result = await api.scoutUrl(url);

      if (result.thin_scrape) {
        setScoutingRows((prev) => ({
          ...prev,
          [rowId]: { status: 'thin_scrape', url, error: null },
        }));
        setPasteModal({ rowId, url });
        notify('Thin Scrape', {
          body: "Couldn't extract enough content. Please paste the listing manually.",
          tag: 'scout-' + rowId,
        });
      } else if (result.ok) {
        // Reload villas to get the new one
        await loadVillas();
        setScoutingRows((prev) => {
          const updated = { ...prev };
          delete updated[rowId];
          return updated;
        });
        notify('Villa Listed! 🎉', {
          body: 'New villa has been added to the spreadsheet.',
          tag: 'scout-success-' + rowId,
        });
      } else {
        setScoutingRows((prev) => ({
          ...prev,
          [rowId]: { status: 'error', url, error: result.error },
        }));
        setPasteModal({ rowId, url });
        notify('Scout Failed ❌', {
          body: result.error || 'Something went wrong. Please paste manually.',
          tag: 'scout-error-' + rowId,
        });
      }
    } catch (err) {
      setScoutingRows((prev) => ({
        ...prev,
        [rowId]: { status: 'error', url, error: err.message },
      }));
      setPasteModal({ rowId, url });
      notify('Scout Error ❌', {
        body: err.message || 'An error occurred. Please paste manually.',
        tag: 'scout-error-' + rowId,
      });
    }
  }

  async function handlePaste(rowId, pastedText, imageUrls) {
    const url = pasteModal?.url;
    setPasteModal(null);

    setScoutingRows((prev) => ({
      ...prev,
      [rowId]: { status: 'building', url, error: null },
    }));

    try {
      const result = await api.scoutPaste(pastedText, url, imageUrls);
      if (result.ok) {
        await loadVillas();
        setScoutingRows((prev) => {
          const updated = { ...prev };
          delete updated[rowId];
          return updated;
        });
        notify('Paste Success! 🎉', {
          body: 'Villa has been added from pasted content.',
          tag: 'paste-success-' + rowId,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      setScoutingRows((prev) => ({
        ...prev,
        [rowId]: { status: 'error', url, error: err.message },
      }));
      notify('Paste Failed ❌', {
        body: err.message || 'Failed to build report from paste.',
        tag: 'paste-error-' + rowId,
      });
    }
  }

  async function handleUpdateVilla(slug, updates) {
    try {
      const updated = await api.updateVilla(slug, updates);
      setVillas((prev) =>
        prev.map((v) => (v.slug === slug ? updated : v))
      );
      const fieldNames = Object.keys(updates).join(', ');
      notify('Changes Saved ✓', {
        body: `Updated: ${fieldNames}`,
        tag: 'update-' + slug,
      });
    } catch (err) {
      console.error('Failed to update villa:', err);
      notify('Save Failed ❌', {
        body: 'Could not save changes. Please try again.',
        tag: 'update-error-' + slug,
      });
      throw err;
    }
  }

  async function handleDeleteVilla(slug) {
    if (!confirm('Delete this villa? This cannot be undone.')) return;
    try {
      await api.deleteVilla(slug);
      setVillas((prev) => prev.filter((v) => v.slug !== slug));
      notify('Villa Deleted 🗑️', {
        body: 'Villa has been permanently removed.',
        tag: 'delete-' + slug,
      });
    } catch (err) {
      console.error('Failed to delete villa:', err);
      notify('Delete Failed ❌', {
        body: 'Could not delete villa. Please try again.',
        tag: 'delete-error-' + slug,
      });
      alert('Failed to delete villa');
    }
  }

  return (
    <div className="app">
      <Header />
      <DropZone onScout={handleScoutUrl} />
      <VillaTable
        villas={villas}
        scoutingRows={scoutingRows}
        onUpdateVilla={handleUpdateVilla}
        onDeleteVilla={handleDeleteVilla}
        onPasteRetry={(rowId) => {
          const scouting = scoutingRows[rowId];
          if (scouting) {
            setPasteModal({ rowId, url: scouting.url });
          }
        }}
      />
      {pasteModal && (
        <PasteModal
          url={pasteModal.url}
          onSubmit={(pastedText, imageUrls) =>
            handlePaste(pasteModal.rowId, pastedText, imageUrls)
          }
          onCancel={() => setPasteModal(null)}
        />
      )}
    </div>
  );
}

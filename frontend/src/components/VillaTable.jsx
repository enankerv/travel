import VillaRow from './VillaRow';
import LoadingRow from './LoadingRow';

export default function VillaTable({
  villas,
  scoutingRows,
  onUpdateVilla,
  onDeleteVilla,
  onPasteRetry,
}) {
  const scoutingList = Object.entries(scoutingRows || {}).map(([rowId, data]) => ({
    rowId,
    ...data,
  }));

  return (
    <div className="sheet-wrap">
      <div className="sheet-scroll">
        <table className="sheet">
          <thead>
            <tr>
              <th className="col-thumb"></th>
              <th className="col-name">Villa</th>
              <th className="col-loc">Location</th>
              <th className="col-beds">Beds</th>
              <th className="col-baths">Baths</th>
              <th className="col-guests">Guests</th>
              <th className="col-price">Price (USD/wk)</th>
              <th className="col-pool">Region</th>
              <th className="col-catch">The Catch</th>
              <th style={{ width: '60px' }}></th>
            </tr>
          </thead>
          <tbody>
            {scoutingList.map((row) => (
              <LoadingRow
                key={row.rowId}
                status={row.status}
                url={row.url}
                error={row.error}
                onPasteRetry={() => onPasteRetry(row.rowId)}
              />
            ))}
            {villas.length === 0 && scoutingList.length === 0 ? (
              <tr>
                <td colSpan="10">
                  <div className="empty-state">
                    <div className="icon">📋</div>
                    <p>No villas yet. Paste a link above to get started.</p>
                  </div>
                </td>
              </tr>
            ) : (
              villas.map((villa) => (
                <VillaRow
                  key={villa.slug}
                  villa={villa}
                  onUpdate={onUpdateVilla}
                  onDelete={onDeleteVilla}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

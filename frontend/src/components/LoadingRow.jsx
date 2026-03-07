export default function LoadingRow({ status, url, error, onPasteRetry }) {
  const domain = (() => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url.slice(0, 40);
    }
  })();

  if (status === 'scouting' || status === 'building') {
    return (
      <tr className="row-loading">
        <td className="col-thumb">
          <div className="thumb-placeholder">
            <span className="spinner"></span>
          </div>
        </td>
        <td colSpan="9">
          <span className="loading-text">
            <span className="spinner"></span>
            {status === 'scouting'
              ? `Scouting ${domain}… crawling + AI summary`
              : 'Building report from paste...'}
          </span>
        </td>
      </tr>
    );
  }

  if (status === 'error' || status === 'thin_scrape') {
    const isError = status === 'error';
    return (
      <tr className="row-error">
        <td className="col-thumb">
          <div
            className="thumb-placeholder"
            style={{ color: isError ? 'var(--red)' : 'var(--yellow)' }}
          >
            {isError ? '!' : '?'}
          </div>
        </td>
        <td colSpan="9">
          <span
            className="loading-text"
            style={{ color: isError ? 'var(--red)' : 'var(--yellow)' }}
          >
            {isError ? `Failed: ${error}` : "Thin scrape — couldn't get enough content"}
          </span>
          <button
            className="retry-btn"
            style={
              isError
                ? { background: 'var(--red-soft)', color: 'var(--red)' }
                : { background: 'var(--yellow-soft)', color: 'var(--yellow)' }
            }
            onClick={onPasteRetry}
          >
            Paste manually
          </button>
        </td>
      </tr>
    );
  }

  return null;
}

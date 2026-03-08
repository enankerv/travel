'use client'

export default function ListsView({
  lists,
  onSelectList,
  onCreateList,
  onSignOut,
  user,
  error,
  isLoading,
}) {
  return (
    <>
      {/* Header */}
      <div className="header" style={{ justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1>Your Lists</h1>
          <span className="tag">Travel Scout</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>{user?.email}</span>
          <button
            onClick={onSignOut}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              padding: '0.5rem 1rem',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          margin: '0 2rem 1rem',
          display: 'flex',
          gap: '1rem',
        }}
      >
        <button
          onClick={onCreateList}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            padding: '0.6rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '600',
          }}
        >
          + New List
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            margin: '0 2rem 1rem',
            padding: '1rem',
            background: 'var(--red-soft)',
            border: '1px solid var(--red)',
            borderRadius: '8px',
            color: 'var(--red)',
          }}
        >
          {error}
        </div>
      )}

      {/* Lists Table */}
      <div className="sheet-wrap" style={{ flex: 1, margin: '0 2rem', overflow: 'hidden' }}>
        <div className="sheet-scroll" style={{ flex: 1 }}>
          <table className="sheet">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>List Name</th>
                <th style={{ width: '40%' }}>Description</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Getaways</th>
                <th style={{ width: '15%', textAlign: 'center' }}>Members</th>
              </tr>
            </thead>
            <tbody>
              {lists.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty-state" style={{ paddingTop: '3rem' }}>
                    <div className="icon">📋</div>
                    <p>No lists yet. Create one to get started!</p>
                  </td>
                </tr>
              ) : (
                lists.map(list => (
                  <tr
                    key={list.id}
                    onClick={() => onSelectList(list.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{list.name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
                      {list.description || '—'}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {list.villa_count}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {list.member_count}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}></div>
    </>
  )
}

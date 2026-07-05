'use client'

export default function ListScreenTabs({
  activeTab,
  onTabChange,
  membersCount,
}: {
  activeTab: 'places' | 'members'
  onTabChange: (tab: 'places' | 'members') => void
  membersCount: number
}) {
  return (
    <div className="list-screen-chrome__tabs">
      <button
        type="button"
        onClick={() => onTabChange('places')}
        className={`list-screen-chrome__tab${activeTab === 'places' ? ' list-screen-chrome__tab--active' : ''}`}
      >
        Places
      </button>
      <button
        type="button"
        onClick={() => onTabChange('members')}
        className={`list-screen-chrome__tab${activeTab === 'members' ? ' list-screen-chrome__tab--active' : ''}`}
      >
        Members ({membersCount})
      </button>
    </div>
  )
}

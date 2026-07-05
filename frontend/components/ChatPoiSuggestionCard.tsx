'use client'

import {
  iconForPoiType,
  isLoadableImageUrl,
  poiDisplayAddress,
  type BoardCreatablePoiType,
} from '@/lib/poi'
import {
  BOARD_CHAT_POI_DRAG_MIME,
  type BoardChatPoiSuggestion,
  suggestionDragPayload,
} from '@/lib/boardChat'

type ChatPoiSuggestionCardProps = {
  suggestion: BoardChatPoiSuggestion
  saved?: boolean
  saving?: boolean
  onSave: () => void
}

function displayPoiType(poiType: string): string {
  return poiType.charAt(0).toUpperCase() + poiType.slice(1)
}

export default function ChatPoiSuggestionCard({
  suggestion,
  saved = false,
  saving = false,
  onSave,
}: ChatPoiSuggestionCardProps) {
  const iconType = suggestion.poi_type as BoardCreatablePoiType
  const address = poiDisplayAddress(suggestion)
  const thumb = isLoadableImageUrl(suggestion.thumbnail_url)
    ? suggestion.thumbnail_url
    : null

  return (
    <div
      className={`board-chat__suggestion${saved ? ' board-chat__suggestion--saved' : ''}`}
      draggable={!saved && !saving}
      onDragStart={(e) => {
        if (saved || saving) {
          e.preventDefault()
          return
        }
        e.dataTransfer.setData(
          BOARD_CHAT_POI_DRAG_MIME,
          suggestionDragPayload(suggestion),
        )
        e.dataTransfer.effectAllowed = 'copy'
      }}
    >
      <div className="board-chat__suggestion-polaroid">
        <span className="board-chat__suggestion-photo" aria-hidden>
          {thumb ? (
            <img
              className="board-chat__suggestion-thumb"
              src={thumb}
              alt=""
              draggable={false}
            />
          ) : (
            iconForPoiType(iconType)
          )}
        </span>
        <span className="board-chat__suggestion-caption">{suggestion.title}</span>
      </div>
      <div className="board-chat__suggestion-meta">
        <span className="board-chat__suggestion-type">{displayPoiType(suggestion.poi_type)}</span>
        {address && (
          <span className="board-chat__suggestion-location">{address}</span>
        )}
        {suggestion.description && (
          <p className="board-chat__suggestion-desc">{suggestion.description}</p>
        )}
        <a
          className="board-chat__suggestion-link"
          href={suggestion.source_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          View link
        </a>
      </div>
      <button
        type="button"
        className="board-chat__suggestion-save"
        onClick={onSave}
        disabled={saved || saving}
      >
        {saved ? 'On board' : saving ? 'Saving…' : 'Add to board'}
      </button>
    </div>
  )
}

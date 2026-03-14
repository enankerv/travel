"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useListDetailContext } from "@/lib/ListDetailContext";
import GetawayTable from "./GetawayTable";
import GetawayMobileCards from "./GetawayMobileCards";
import GetawayDetailSheet from "./GetawayDetailSheet";

export default function GetawayListView({
  isLoading,
  onDelete,
  onUpdate,
  onImageClick,
  onRetry,
  onPasteClick,
  onCommentClick,
}: {
  isLoading: boolean;
  onDelete: (getawayId: string) => void;
  onUpdate: (getawayId: string, updates: any) => void;
  onImageClick: (images: string[], index: number) => void;
  onRetry: (getaway: any) => void;
  onPasteClick: (getaway: any) => void;
  onCommentClick: (getawayId: string) => void;
}) {
  const isMobile = useIsMobile();
  const { getaways, votesByGetaway, isListMember, currentUserId, onVote, onUnvote } =
    useListDetailContext();
  const [detailGetaway, setDetailGetaway] = useState<any>(null);

  if (isMobile) {
    return (
      <>
        <div className="getaway-list-mobile">
          {isLoading ? (
            <div className="getaway-list-mobile__loading">
              <div className="spinner" />
              <p>Loading getaways…</p>
            </div>
          ) : (
            <GetawayMobileCards
              getaways={getaways}
              votesByGetaway={votesByGetaway}
              currentUserId={currentUserId}
              canVote={isListMember}
              onVote={onVote}
              onUnvote={onUnvote}
              onCardClick={(g) => {
                if (g.import_status === "thin" || g.import_status === "error") {
                  onPasteClick(g);
                } else {
                  setDetailGetaway(g);
                }
              }}
            />
          )}
        </div>
        {detailGetaway && (
          <GetawayDetailSheet
            getaway={detailGetaway}
            onClose={() => setDetailGetaway(null)}
            onImageClick={onImageClick}
          />
        )}
      </>
    );
  }

  return (
    <GetawayTable
      getaways={getaways}
      isLoading={isLoading}
      onDelete={onDelete}
      onUpdate={onUpdate}
      onImageClick={onImageClick}
      onRetry={onRetry}
      onPasteClick={onPasteClick}
      onCommentClick={onCommentClick}
    />
  );
}

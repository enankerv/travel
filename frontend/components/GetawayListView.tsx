"use client";

import { useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useListDetailContext } from "@/lib/ListDetailContext";
import GetawayTable from "./GetawayTable";
import GetawayMobileCards from "./GetawayMobileCards";
import PartySizeControls from "./PartySizeControls";
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
  const {
    getaways,
    votesByGetaway,
    commentsByGetaway,
    isListMember,
    currentUserId,
    onVote,
    onUnvote,
  } =
    useListDetailContext();
  const [detailGetaway, setDetailGetaway] = useState<any>(null);
  const [detailScrollToComments, setDetailScrollToComments] = useState(false);

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
            <>
              <div className="getaway-list-mobile__party-wrap">
                <PartySizeControls />
              </div>
              <GetawayMobileCards
              getaways={getaways}
              votesByGetaway={votesByGetaway}
              currentUserId={currentUserId}
              canVote={isListMember}
              onVote={onVote}
              onUnvote={onUnvote}
              commentsByGetaway={commentsByGetaway}
              onCardClick={(g) => {
                setDetailScrollToComments(false);
                if (g.import_status === "thin" || g.import_status === "error") {
                  onPasteClick(g);
                } else {
                  setDetailGetaway(g);
                }
              }}
              onCommentClick={(g) => {
                setDetailGetaway(g);
                setDetailScrollToComments(true);
              }}
            />
            </>
          )}
        </div>
        {detailGetaway && (
          <GetawayDetailSheet
            getaway={detailGetaway}
            onClose={() => {
              setDetailGetaway(null);
              setDetailScrollToComments(false);
            }}
            onDelete={onDelete}
            onUpdate={onUpdate}
            scrollToCommentsOnOpen={detailScrollToComments}
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

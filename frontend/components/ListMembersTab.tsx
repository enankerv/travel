"use client";

import { useState } from "react";
import { removeListMember, deleteList } from "@/lib/api";
import InviteLinkSection from "./InviteLinkSection";
import MemberRow from "./MemberRow";

type ListMembersTabProps = {
  listId: string;
  members: any[];
  currentUserId: string | undefined;
  onBack: () => void;
  onError: (message: string) => void;
};

export default function ListMembersTab({
  listId,
  members,
  currentUserId,
  onBack,
  onError,
}: ListMembersTabProps) {
  const [isLeaving, setIsLeaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleLeaveList() {
    if (!currentUserId) return;
    if (!confirm("Leave this list? You can rejoin later with an invite link.")) return;
    setIsLeaving(true);
    try {
      await removeListMember(listId, currentUserId);
      onBack();
    } catch (err: any) {
      onError(err.message || "Failed to leave list");
    } finally {
      setIsLeaving(false);
    }
  }

  async function handleDeleteList() {
    if (!confirm("Delete this list? All getaways and invite links will be removed. This cannot be undone.")) return;
    setIsDeleting(true);
    try {
      await deleteList(listId);
      onBack();
    } catch (err: any) {
      onError(err.message || "Failed to delete list");
    } finally {
      setIsDeleting(false);
    }
  }

  const currentMember = members.find((m: any) => m.user_id === currentUserId);
  const canLeave = currentMember && !currentMember.is_creator;
  const isOwner = currentMember?.is_creator === true;
  const sortedMembers = [...members].sort(
    (a, b) => (b.is_creator ? 1 : 0) - (a.is_creator ? 1 : 0)
  );

  return (
    <div className="list-members-tab">
      <InviteLinkSection listId={listId} onError={onError} />

      <div>
        <h3 className="list-members-tab__title">Members ({members.length})</h3>
        <div className="list-members-tab__list">
          {sortedMembers.map((member: any) => (
            <MemberRow
              key={member.user_id}
              user_id={member.user_id}
              profile={member.profile}
              role={member.is_creator ? "Owner" : member.role}
              subtitle={
                member.is_creator
                  ? "Owner"
                  : member.joined_at
                    ? `Joined ${new Date(member.joined_at).toLocaleDateString()}`
                    : "—"
              }
            />
          ))}
        </div>
        {canLeave && (
          <div className="list-members-tab__leave">
            <button
              type="button"
              onClick={handleLeaveList}
              disabled={isLeaving}
              className="list-members-tab__leave-btn"
            >
              {isLeaving ? "Leaving…" : "Leave list"}
            </button>
          </div>
        )}
        {isOwner && (
          <div className="list-members-tab__leave">
            <button
              type="button"
              onClick={handleDeleteList}
              disabled={isDeleting}
              className="list-members-tab__leave-btn list-members-tab__delete-btn"
            >
              {isDeleting ? "Deleting…" : "Delete list"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

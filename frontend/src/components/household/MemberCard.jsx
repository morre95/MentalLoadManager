import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";


const AlertTransferDialog = ({ open, onCancel, onTransfer, transferToUser }) => {
  if (!transferToUser) return null;
  const transferToName =
    transferToUser.display_name || transferToUser.username || "this user";

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onCancel()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Do you want to transfer your ownership to {transferToName}</DialogTitle>
        </DialogHeader>

        <div className="mt-2 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onTransfer}>
            Yes Transfer to {transferToName}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function MemberCard({
  member,
  householdId,
  idx,
  colors,
  me,
  canManageMembers = false,
  myRole = "member",
  confirmKey,
  setConfirmKey,
  removingKey,
  updatingRoleKey,
  onConfirmRemove,
  onUpdateRole,
  onTransferOwnership,
}) {
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const name = member.display_name || member.username || "User";
  const initials = getInitials(name);
  const role = (member.role || "member").toLowerCase();
  const [isRoleEditorOpen, setIsRoleEditorOpen] = useState(false);
  const [nextRole, setNextRole] = useState(role);
  const cardRef = useRef(null);

  const key = `${householdId}:${member.user_id}`;
  const isConfirming = confirmKey === key;
  const isRemoving = removingKey === key;
  const isUpdatingRole = updatingRoleKey === key;
  const isMe = me?.username && member?.username && me.username === member.username;
  const showRemoveButton = canManageMembers && !isMe && !isConfirming;
  const canEditRole =
    canManageMembers &&
    !isConfirming &&
    !isMe &&
    role !== "owner" &&
    (myRole === "owner" || (myRole === "admin" && role !== "admin"));

  const roleBadgeClass =
    role === "owner"
      ? "bg-terracotta/10 text-terracotta border-terracotta/30"
      : role === "admin"
        ? "bg-sage/15 text-sage border-sage/30"
        : "bg-muted text-muted-foreground border-border";

  useEffect(() => {
    setNextRole(role);
  }, [role]);

  useEffect(() => {
    if (!isRoleEditorOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!cardRef.current) return;
      if (!cardRef.current.contains(event.target)) {
        setIsRoleEditorOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [isRoleEditorOpen]);

  const handleSaveRole = async () => {
    if (nextRole === "transfer") {
      setIsTransferDialogOpen(true);
      return;
    }

    if (!onUpdateRole || nextRole === role) {
      setIsRoleEditorOpen(false);
      return;
    }

    await onUpdateRole(member.user_id, nextRole);
    setIsRoleEditorOpen(false);
  };

  const handleConfirmTransfer = async () => {
    if (!onTransferOwnership) return;

    await onTransferOwnership(member.user_id);
    setIsTransferDialogOpen(false);
    setNextRole(role);
    setIsRoleEditorOpen(false);
  };

  return (
    <div ref={cardRef} className="relative p-4 pr-6 rounded-xl border border-border bg-card">
      {canEditRole ? (
        <button
          type="button"
          className={`absolute top-2 ${showRemoveButton ? "right-12" : "right-2"} rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${roleBadgeClass} hover:opacity-90 transition cursor-pointer`}
          onClick={() => setIsRoleEditorOpen((prev) => !prev)}
          disabled={isUpdatingRole}
        >
          {role}
        </button>
      ) : (
        <span
          className={`absolute top-2 ${showRemoveButton ? "right-12" : "right-2"} rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${roleBadgeClass}`}
        >
          {role}
        </span>
      )}

      {canEditRole && isRoleEditorOpen && (
        <div className="absolute top-11 right-2 z-20 rounded-lg border border-border bg-card p-2 shadow-md w-40 space-y-2">
          <select
            className="w-full rounded-md border bg-background px-2 py-1 text-xs"
            value={nextRole}
            onChange={(event) => setNextRole(event.target.value)}
            disabled={isUpdatingRole}
          >
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            {myRole === "owner" && (
              <option value="transfer">Transfer ownership</option>
            )}
          </select>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={handleSaveRole}
              disabled={
                isUpdatingRole ||
                (nextRole === role && nextRole !== "transfer")
              }
            >
              {isUpdatingRole ? "Saving…" : "Save"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setNextRole(role);
                setIsRoleEditorOpen(false);
              }}
              disabled={isUpdatingRole}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Remove button only for others */}
      {showRemoveButton && (
        <button
          type="button"
          className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-md
          text-muted-foreground hover:text-terracotta hover:bg-terracotta/10 transition"
          onClick={() => setConfirmKey(key)}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Main content */}
      <div className={`flex items-start gap-4 transition ${isConfirming ? "opacity-50" : ""}`}>
        <Avatar className="h-12 w-12 shrink-0">
          {/* <AvatarFallback className={`${colors[idx % colors.length]} font-semibold`}> */}
          <AvatarFallback className={`${idx === 0 ? colors[0] : colors[1]} font-semibold`}>
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="min-w-0 flex-1 pr-4">
          <p className="font-medium text-foreground truncate">
            {name}
          </p>

          {member.email && (
            <p className="text-sm text-muted-foreground truncate">
              {member.email}
            </p>
          )}
        </div>
      </div>

      {/* Confirm remove */}
      {canManageMembers && !isMe && isConfirming && (
        <div className="mt-3 flex gap-2">
          <Button
            variant="destructive"
            className="bg-terracotta hover:bg-terracotta/90"
            onClick={() => onConfirmRemove(member.user_id)}
            disabled={isRemoving}
          >
            {isRemoving ? "Removing…" : "Confirm remove"}
          </Button>

          <Button variant="outline" onClick={() => setConfirmKey(null)}>
            Cancel
          </Button>
        </div>
      )}

      <AlertTransferDialog
        open={isTransferDialogOpen}
        onCancel={() => {
          setIsTransferDialogOpen(false);
          setNextRole(role);
        }}
        onTransfer={handleConfirmTransfer}
        transferToUser={member}
      />
    </div>
  );
}

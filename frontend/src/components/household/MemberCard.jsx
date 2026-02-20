import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {getInitials } from "@/lib/utils";

export default function MemberCard({
  member,
  householdId,
  idx,
  colors,
  me,
  confirmKey,
  setConfirmKey,
  removingKey,
  onConfirmRemove,
}) {
  const name = member.display_name || member.username || "User";
  const initials = getInitials(name);

  const key = `${householdId}:${member.user_id}`;
  const isConfirming = confirmKey === key;
  const isRemoving = removingKey === key;
  const isMe = me?.username && member?.username && me.username === member.username;

  return (
    <div className="relative overflow-hidden p-4 pr-6 rounded-xl border border-border bg-card">

      {/* Remove button only for others */}
      {!isMe && !isConfirming && (
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
      {!isMe && isConfirming && (
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
    </div>
  );
}

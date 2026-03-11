import { useEffect, useRef, useState } from "react";
import { ArrowRight, Pencil } from "lucide-react";
import { motion } from "framer-motion";
import { Users, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HouseholdModal } from "@/components/ui/CreateHouseholdModal";
import MemberCard from "@/components/household/MemberCard";
import { useHouseholdPage } from "@/hooks/useHouseholdPage";

const colors = ["bg-sage text-sage-light", "bg-terracotta text-white"];

function EditableHouseholdName({ household, canRename, isSaving, onSave }) {
    const [isEditing, setIsEditing] = useState(false);
    const [draftName, setDraftName] = useState(household.name);
    const inputRef = useRef(null);

    useEffect(() => {
        if (isEditing) {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    }, [isEditing]);

    const cancelEditing = () => {
        setDraftName(household.name);
        setIsEditing(false);
    };

    const submitEditing = async () => {
        const trimmedName = draftName.trim();
        if (!trimmedName || trimmedName === household.name) {
            cancelEditing();
            return;
        }

        try {
            await onSave(trimmedName);
            setIsEditing(false);
        } catch {
            inputRef.current?.focus();
            inputRef.current?.select();
        }
    };

    if (!canRename) {
        return (
            <h2 className="font-display text-xl font-bold text-foreground truncate">
                {household.name}
            </h2>
        );
    }

    if (isEditing) {
        return (
            <input
                ref={inputRef}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                        event.preventDefault();
                        void submitEditing();
                    }
                    if (event.key === "Escape") {
                        event.preventDefault();
                        cancelEditing();
                    }
                }}
                onBlur={cancelEditing}
                disabled={isSaving}
                className="w-full rounded-md border border-border bg-background px-2 py-1 font-display text-xl font-bold text-foreground outline-none focus:border-primary"
                aria-label={`Rename ${household.name}`}
            />
        );
    }

    return (
        <button
            type="button"
            onClick={() => {
                setDraftName(household.name);
                setIsEditing(true);
            }}
            className="group flex max-w-full items-center gap-2 rounded-md text-left"
        >
            <h2 className="font-display text-xl font-bold text-foreground truncate cursor-pointer">
                {household.name}
            </h2>
            <Pencil className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
    );
}

export default function Household() {
    const {
        households,
        loading,
        error,
        me,

        confirmKey,
        setConfirmKey,
        removingKey,

        inviteByHousehold,

        leaveConfirmHouseholdId,
        setLeaveConfirmHouseholdId,
        leavingHouseholdId,
        updatingRoleKey,
        renamingHouseholdId,

        isCreatingUI,
        setIsCreatingUI,
        newHouseholdName,
        setNewHouseholdName,
        creating,

        isJoiningUI,
        setIsJoiningUI,
        joinCodeOrLink,
        setJoinCodeOrLink,
        joining,

        handleCreateHousehold,
        handleJoinHousehold,
        handleInvite,
        handleCopyInvite,
        handleRemoveMember,
        handleLeave,
        handleTransferOwnership,
        handleRenameHousehold,
        handleUpdateMemberRole,
    } = useHouseholdPage();


    return (
        <div className="p-4 md:p-6">
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-6"
            >
                <div>
                    <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
                        <Users className="h-7 w-7 text-primary" />
                        Household
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage your household members</p>

                    {loading && <p className="text-sm text-muted-foreground mt-2">Loading…</p>}
                    {error && (
                        <p className="text-sm text-destructive mt-2">
                            {error?.message || "Failed to load households"}
                        </p>
                    )}
                </div>
            </motion.div>

            <div className="space-y-8">
                {(households || []).map((h) => {
                    const inviteState = inviteByHousehold[h.household_id] || {};
                    const inviteUrl = inviteState.inviteUrl || "";
                    const copied = !!inviteState.copied;
                    const inviting = !!inviteState.inviting;
                    const myMembership = (h.members || []).find(
                        (member) => member.username === me?.username
                    );
                    const myRole = myMembership?.role || "member";
                    const canManageMembers =
                        myRole === "owner" || myRole === "admin";
                    const canRenameHousehold = canManageMembers;


                    return (
                        <motion.section
                            key={h.household_id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="flex items-baseline justify-between gap-4">
                                <div className="min-w-0">
                                    <EditableHouseholdName
                                        household={h}
                                        canRename={canRenameHousehold}
                                        isSaving={renamingHouseholdId === h.household_id}
                                        onSave={(name) => handleRenameHousehold(h.household_id, name)}
                                    />
                                    <p className="text-sm text-muted-foreground">
                                        {h.members?.length ?? 0} member{(h.members?.length ?? 0) === 1 ? "" : "s"}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        className="gap-2"
                                        onClick={() => handleInvite(h.household_id)}
                                        disabled={inviting}
                                    >
                                        <UserPlus className="h-4 w-4" />
                                        Invite Member
                                    </Button>

                                    <Button
                                        variant="outline"
                                        className="
                                        border-terracotta text-terracotta
                                        hover:bg-terracotta hover:text-white
                                        hover:border-terracotta
                                        transition-colors
                                        "
                                        onClick={() => {
                                            setConfirmKey(null);
                                            setLeaveConfirmHouseholdId(h.household_id);
                                        }}
                                        disabled={leavingHouseholdId === h.household_id}
                                    >
                                        Leave
                                    </Button>
                                </div>

                            </div>
                            {leaveConfirmHouseholdId === h.household_id ? (
                                <div className="rounded-xl border border-border bg-terracotta/5 p-4 flex flex-col sm:flex-row gap-3 items-center justify-between">
                                    <p className="text-sm text-foreground">
                                        Are you sure you want to leave <b>{h.name}</b>?
                                    </p>

                                    <div className="flex gap-2">
                                        <Button
                                            variant="destructive"
                                            className="bg-terracotta hover:bg-terracotta/90"
                                            onClick={() => handleLeave(h.household_id)}
                                        >
                                            Confirm Leave
                                        </Button>

                                        <Button
                                            variant="outline"
                                            onClick={() => setLeaveConfirmHouseholdId(null)}
                                        >
                                            Cancel
                                        </Button>
                                    </div>
                                </div>
                            ) : null}


                            {inviteUrl ? (
                                <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3 justify-between">
                                    <div className="min-w-0">
                                        <p className="text-sm font-medium text-foreground">Invite link</p>
                                        <p className="text-sm text-muted-foreground truncate">{inviteUrl}</p>
                                    </div>

                                    <Button
                                        variant="outline"
                                        className="gap-2 shrink-0"
                                        onClick={() => handleCopyInvite(h.household_id)}
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        {copied ? "Copied" : "Copy"}
                                    </Button>
                                </div>
                            ) : null}

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {(h.members || []).map((member, idx) => (
                                    <MemberCard
                                        key={`${h.household_id}:${member.user_id}`}
                                        member={member}
                                        householdId={h.household_id}
                                        idx={idx}
                                        colors={colors}
                                        me={me}
                                        canManageMembers={canManageMembers}
                                        myRole={myRole}
                                        confirmKey={confirmKey}
                                        setConfirmKey={setConfirmKey}
                                        removingKey={removingKey}
                                        updatingRoleKey={updatingRoleKey}
                                        onConfirmRemove={(userId) =>
                                            handleRemoveMember(h.household_id, userId)
                                        }
                                        onUpdateRole={(userId, role) =>
                                            handleUpdateMemberRole(h.household_id, userId, role)
                                        }
                                        onTransferOwnership={(userId) =>
                                            handleTransferOwnership(h.household_id, userId)
                                        }
                                    />
                                ))}
                            </div>

                        </motion.section>
                    );
                })}

                {!loading && !error && (households || []).length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-muted-foreground">
                        You’re not in a household yet.
                    </div>
                ) : null}

                <div className="mb-6 rounded-xl border border-border bg-card p-4 space-y-4">
                    <p className="text-sm text-muted-foreground">Manage households</p>

                    {/* Actions row */}
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button className="gap-2" onClick={() => setIsCreatingUI(true)}>
                            <Users className="h-4 w-4" />
                            Create Household
                        </Button>

                        <Button variant="outline" className="
                            gap-2
                            bg-white
                            border-terracotta text-terracotta
                            hover:bg-terracotta hover:text-white
                            hover:border-terracotta
                            transition-colors
                            "
                            onClick={() => setIsJoiningUI(true)}>
                            <ArrowRight className="h-4 w-4" />
                            Join Household
                        </Button>
                    </div>
                </div>
            </div>
            <HouseholdModal
                open={isCreatingUI}
                onOpenChange={setIsCreatingUI}
                title="Create Household"
                value={newHouseholdName}
                setValue={setNewHouseholdName}
                onConfirm={handleCreateHousehold}
                loading={creating}
                placeholder="Household name"
                confirmText="Create"
            />
            <HouseholdModal
                open={isJoiningUI}
                onOpenChange={setIsJoiningUI}
                title="Join Household"
                value={joinCodeOrLink}
                setValue={setJoinCodeOrLink}
                onConfirm={handleJoinHousehold}
                loading={joining}
                placeholder="Paste invite link or code"
                confirmText="Join"
            />
        </div>
    );

}

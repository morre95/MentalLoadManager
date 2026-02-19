import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Users, UserPlus, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HouseholdModal } from "@/components/ui/CreateHouseholdModal";
import MemberCard from "@/components/household/MemberCard";
import { useHouseholdPage } from "@/hooks/useHouseholdPage";

const colors = ["bg-sage text-sage-light", "bg-terracotta text-white"];

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


                    return (
                        <motion.section
                            key={h.household_id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-4"
                        >
                            <div className="flex items-baseline justify-between gap-4">
                                <div className="min-w-0">
                                    <h2 className="font-display text-xl font-bold text-foreground truncate">
                                        {h.name}
                                    </h2>
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
                                        confirmKey={confirmKey}
                                        setConfirmKey={setConfirmKey}
                                        removingKey={removingKey}
                                        onConfirmRemove={(userId) =>
                                            handleRemoveMember(h.household_id, userId)
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

import { X, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Users, UserPlus, Copy, Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useHousehold, createHouseholdInvite, createHousehold, removeHouseholdMember, leaveHousehold } from "../../hooks/useHouseHold";
import { getDisplayName, getInitials, getUserFromLocalStorage, acceptHouseholdInvite } from "@/lib/utils";
import { HouseholdModal } from "@/components/ui/CreateHouseholdModal";


const colors = ["bg-sage text-sage-light", "bg-terracotta text-white"];


export default function Household() {
    // Hook should ideally return households as an array:
    // { households: [...], loading, error }
    const { households, loading, error, refetch } = useHousehold();
    const [creating, setCreating] = useState(false);
    const [newHouseholdName, setNewHouseholdName] = useState("");
    const me = getUserFromLocalStorage();
    const [confirmKey, setConfirmKey] = useState(null); // "householdId:userId"
    const [removingKey, setRemovingKey] = useState(null);
    const [inviteByHousehold, setInviteByHousehold] = useState({});
    const [leaveConfirmHouseholdId, setLeaveConfirmHouseholdId] = useState(null);
    const [leavingHouseholdId, setLeavingHouseholdId] = useState(null);
    const memberKey = (householdId, userId) => `${householdId}:${userId}`;
    const [joinCodeOrLink, setJoinCodeOrLink] = useState("");
    const [joining, setJoining] = useState(false);
    const [isCreatingUI, setIsCreatingUI] = useState(false);
    const [isJoiningUI, setIsJoiningUI] = useState(false);





    const handleCreateHousehold = async () => {
        if (!newHouseholdName.trim()) return;

        setCreating(true);

        try {
            await createHousehold(newHouseholdName.trim());

            localStorage.removeItem("households");
            setIsCreatingUI(false);
            setNewHouseholdName("");
            await refetch();

        } catch (e) {
            console.error(e);
            alert(e?.message || "Could not create household");
        } finally {
            setCreating(false);
        }
    };

    const handleRemoveMember = async (householdId, userId) => {
        const key = memberKey(householdId, userId);
        setRemovingKey(key);

        try {
            await removeHouseholdMember(householdId, userId);
            setConfirmKey(null);
            await refetch();
        } catch (e) {
            console.error(e);
            alert(e?.message || "Could not remove member");
        } finally {
            setRemovingKey(null);
        }
    };

    const handleLeave = async (householdId) => {
        setLeavingHouseholdId(householdId);
        try {
            await leaveHousehold(householdId);
            setLeaveConfirmHouseholdId(null);
            setConfirmKey(null); // close any other confirms
            await refetch();
        } catch (e) {
            console.error(e);
            alert(e?.message || "Could not leave household");
        } finally {
            setLeavingHouseholdId(null);
        }
    };

    const setHouseholdInviteState = (householdId, patch) => {
        setInviteByHousehold((prev) => ({
            ...prev,
            [householdId]: {
                ...(prev[householdId] || {}),
                ...patch,
            },
        }));
    };

    const handleInvite = async (householdId) => {
        setHouseholdInviteState(householdId, { inviting: true, copied: false });

        try {
            const data = await createHouseholdInvite(householdId);

            const url = data?.invite_url || "";
            setHouseholdInviteState(householdId, { inviteUrl: url });

            if (url) {
                await navigator.clipboard.writeText(url);
                setHouseholdInviteState(householdId, { copied: true });

                setTimeout(() => {
                    setHouseholdInviteState(householdId, { copied: false });
                }, 1500);
            }
        } catch (e) {
            console.error(e);
            alert(e?.message || "Could not create invite");
        } finally {
            setHouseholdInviteState(householdId, { inviting: false });
        }
    };

    const extractInviteCode = (value) => {
        const v = String(value || "").trim();
        if (!v) return "";

        // If user pastes full URL: /join?code=XXXX
        try {
            const url = new URL(v);
            const code = url.searchParams.get("code");
            if (code) return code.trim();
        } catch {
            // not a full URL
        }

        // If user pastes just the code
        return v;
    };

    const handleJoinHousehold = async () => {
        const code = extractInviteCode(joinCodeOrLink);
        if (!code) return;

        setJoining(true);
        try {
            await acceptHouseholdInvite(code);

            // clean up UI
            setIsJoiningUI(false);
            setJoinCodeOrLink("");

            await refetch();
        } catch (e) {
            console.error(e);
            alert(e?.message || "Could not join household");
        } finally {
            setJoining(false);
        }
    };

    const handleCopy = async (householdId) => {
        const url = inviteByHousehold[householdId]?.inviteUrl;
        if (!url) return;

        await navigator.clipboard.writeText(url);
        setHouseholdInviteState(householdId, { copied: true });

        setTimeout(() => {
            setHouseholdInviteState(householdId, { copied: false });
        }, 1500);
    };

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

                    const sortedMembers = [...(h.members || [])].sort((a, b) => {
                        const aIsMe = me?.username === a.username;
                        const bIsMe = me?.username === b.username;

                        if (aIsMe) return -1;
                        if (bIsMe) return 1;

                        const nameA = getDisplayName(a).toLowerCase();
                        const nameB = getDisplayName(b).toLowerCase();

                        return nameA.localeCompare(nameB);
                    });


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
                                        onClick={() => setLeaveConfirmHouseholdId(h.household_id)}
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
                                        onClick={() => handleCopy(h.household_id)}
                                    >
                                        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        {copied ? "Copied" : "Copy"}
                                    </Button>
                                </div>
                            ) : null}

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {(sortedMembers || []).map((member, idx) => {
                                    const name = getDisplayName(member);
                                    const initials = getInitials(name);

                                    const key = memberKey(h.household_id, member.user_id);
                                    const isConfirming = confirmKey === key;
                                    const isRemoving = removingKey === key;
                                    const isMe = me?.username && member?.username && me.username === member.username;

                                    const isLeavingThisHousehold = leaveConfirmHouseholdId === h.household_id;
                                    const isLeavingLoading = leavingHouseholdId === h.household_id;
                                    const isDimmed = isConfirming || isLeavingThisHousehold;


                                    return (
                                        <div className="relative overflow-hidden p-4 pr-6 rounded-xl border border-border bg-card">

                                            {/* Remove button only for others */}
                                            {!isMe && !isConfirming ? (
                                                <button
                                                    type="button"
                                                    className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-md
                                                    text-muted-foreground hover:text-terracotta hover:bg-terracotta/10 transition"
                                                    onClick={() => setConfirmKey(key)}
                                                >
                                                    <X className="h-4 w-4" />
                                                </button>
                                            ) : null}

                                            {/* Main content dims */}
                                            <div
                                                className={`flex items-start gap-4 transition ${isConfirming ? "opacity-50" : ""
                                                    }`}
                                            >
                                                <Avatar className="h-12 w-12 shrink-0">
                                                    <AvatarFallback className={`${colors[idx % colors.length]} font-semibold`}>
                                                        {initials}
                                                    </AvatarFallback>
                                                </Avatar>

                                                <div className="min-w-0 flex-1 pr-4">
                                                    <p className="font-medium text-foreground truncate flex items-center gap-2">
                                                        {name}
                                                    </p>

                                                    {member.email && (
                                                        <p className="text-sm text-muted-foreground truncate">
                                                            {member.email}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Confirm UI stays strong */}
                                            {!isMe && isConfirming && (
                                                <div className="mt-3 flex gap-2 opacity-100">
                                                    <Button
                                                        variant="destructive"
                                                        className="bg-terracotta hover:bg-terracotta/90"
                                                        onClick={() => handleRemoveMember(h.household_id, member.user_id)}
                                                    >
                                                        Confirm remove
                                                    </Button>

                                                    <Button variant="outline" onClick={() => setConfirmKey(null)}>
                                                        Cancel
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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

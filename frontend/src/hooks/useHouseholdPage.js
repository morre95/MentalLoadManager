import { useMemo, useState } from "react";
import {
    useHousehold,
    createHouseholdInvite,
    createHousehold,
    emailHouseholdInvite,
    removeHouseholdMember,
    leaveHousehold,
    transferHouseholdOwnership,
    updateHousehold,
    updateHouseholdMemberRole,
} from "@/hooks/useHouseHold";
import { getUserFromLocalStorage } from "@/lib/auth";
import { acceptHouseholdInvite, createHouseholdCategory } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";

const DEFAULT_HOUSEHOLD_CATEGORIES = [
    "Shopping",
    "Cleaning",
    "Health",
    "Maintenance",
    "Planning",
    "Other",
];


export function useHouseholdPage() {
    const { households, loading, error, refetch } = useHousehold();
    const me = getUserFromLocalStorage();

    // UI state
    const [confirmKey, setConfirmKey] = useState(null); // `${householdId}:${userId}`
    const [removingKey, setRemovingKey] = useState(null);

    const [inviteByHousehold, setInviteByHousehold] = useState({});
    const [leaveConfirmHouseholdId, setLeaveConfirmHouseholdId] = useState(null);
    const [leavingHouseholdId, setLeavingHouseholdId] = useState(null);
    const [updatingRoleKey, setUpdatingRoleKey] = useState(null);

    // Create modal
    const [isCreatingUI, setIsCreatingUI] = useState(false);
    const [newHouseholdName, setNewHouseholdName] = useState("");
    const [creating, setCreating] = useState(false);

    // Join modal
    const [isJoiningUI, setIsJoiningUI] = useState(false);
    const [joinCodeOrLink, setJoinCodeOrLink] = useState("");
    const [joining, setJoining] = useState(false);
    const [renamingHouseholdId, setRenamingHouseholdId] = useState(null);

    const memberKey = (householdId, userId) => `${householdId}:${userId}`;

    const setHouseholdInviteState = (householdId, patch) => {
        setInviteByHousehold((prev) => ({
            ...prev,
            [householdId]: {
                ...(prev[householdId] || {}),
                ...patch,
            },
        }));
    };

    const extractInviteCode = (value) => {
        const v = String(value || "").trim();
        if (!v) return "";

        try {
            const url = new URL(v);
            const code = url.searchParams.get("code");
            if (code) return code.trim();
        } catch {
            //ignore, not a url - will move on to return just code
        }
        return v;
    };

    // -------- handlers --------

    const handleCreateHousehold = async () => {
        const name = newHouseholdName.trim();
        if (!name) return;

        setCreating(true);
        try {
            const createdHousehold = await createHousehold(name);
            const householdId =
                createdHousehold?.household_id ?? createdHousehold?.id ?? null;

            if (householdId) {
                const createCategoryTasks = DEFAULT_HOUSEHOLD_CATEGORIES.map((categoryName) =>
                    createHouseholdCategory(householdId, categoryName)
                );
                const results = await Promise.allSettled(createCategoryTasks);
                const failedCount = results.filter((result) => result.status === "rejected").length;
                if (failedCount > 0) {
                    alert(
                        `Household created, but ${failedCount} default categor${failedCount === 1 ? "y was" : "ies were"
                        } not added.`
                    );
                }
            }

            setIsCreatingUI(false);
            setNewHouseholdName("");
            await refetch();
        } catch (err) {
            alert(err?.message || "Could not create household.");
        } finally {
            setCreating(false);
        }
    };

    const handleJoinHousehold = async () => {
        const code = extractInviteCode(joinCodeOrLink);
        console.log("Attempting to join household with code:", code);
        if (!code) {
            console.log("if !code", code); 
            return;}

        setJoining(true);
        try {
            console.log("after try", code);
            await acceptHouseholdInvite(code);
            setIsJoiningUI(false);
            setJoinCodeOrLink("");
            await refetch();
        } 
        catch (err) {
            const message = err?.message || "An error occurred while trying to join the household.";

            // TODO - improve error handling (e.g. show in UI instead of alert, handle specific cases like invalid code, expired code, etc.)
            alert(message);
        }
        finally {
            setJoining(false);
        }
    };

    const toggleInviteVisibility = (householdId) => {
        const isOpen = !!inviteByHousehold[householdId]?.isOpen;
        setHouseholdInviteState(householdId, { isOpen: !isOpen, copied: false });
    };

    const setInviteEmail = (householdId, email) => {
        setHouseholdInviteState(householdId, { email });
    };

    const handleInvite = async (householdId) => {
        setHouseholdInviteState(householdId, { inviting: true, copied: false });

        try {
            const data = await createHouseholdInvite(householdId);
            const url = data?.invite_url || "";
            setHouseholdInviteState(householdId, { inviteUrl: url, isOpen: true });

            if (url) {
                await navigator.clipboard.writeText(url);
                setHouseholdInviteState(householdId, { copied: true });

                setTimeout(() => {
                    setHouseholdInviteState(householdId, { copied: false });
                }, 1500);
            }
        } finally {
            setHouseholdInviteState(householdId, { inviting: false });
        }
    };

    const handleEmailInvite = async (householdId) => {
        const email = String(inviteByHousehold[householdId]?.email || "").trim();
        if (!email) {
            toast.error("Email is required");
            return;
        }

        setHouseholdInviteState(householdId, { sendingEmail: true });

        try {
            const data = await emailHouseholdInvite(householdId, email);
            const inviteUrl = data?.invite_url || inviteByHousehold[householdId]?.inviteUrl || "";
            setHouseholdInviteState(householdId, {
                inviteUrl,
                isOpen: true,
                email: "",
            });
            toast.success("Invite email sent");
        } catch (err) {
            toast.error(err?.message || "Could not send invite email");
        } finally {
            setHouseholdInviteState(householdId, { sendingEmail: false });
        }
    };

    const handleCopyInvite = async (householdId) => {
        const url = inviteByHousehold[householdId]?.inviteUrl;
        if (!url) return;

        await navigator.clipboard.writeText(url);
        setHouseholdInviteState(householdId, { copied: true });

        setTimeout(() => {
            setHouseholdInviteState(householdId, { copied: false });
        }, 1500);
    };

    const handleRemoveMember = async (householdId, userId) => {
        const key = memberKey(householdId, userId);
        setRemovingKey(key);

        try {
            await removeHouseholdMember(householdId, userId);
            setConfirmKey(null);
            await refetch();
        } finally {
            setRemovingKey(null);
        }
    };

    const handleLeave = async (householdId) => {
        setLeavingHouseholdId(householdId);

        try {
            await leaveHousehold(householdId);
            setLeaveConfirmHouseholdId(null);
            setConfirmKey(null);
            await refetch();
        } finally {
            setLeavingHouseholdId(null);
        }
    };

    const handleUpdateMemberRole = async (householdId, userId, role) => {
        const key = memberKey(householdId, userId);
        setUpdatingRoleKey(key);

        try {
            await updateHouseholdMemberRole(householdId, userId, role);
            await refetch();
        } catch (err) {
            alert(err?.message || "Could not update member role.");
            throw err;
        } finally {
            setUpdatingRoleKey(null);
        }
    };

    const handleTransferOwnership = async (householdId, newOwnerUserId) => {
        const key = memberKey(householdId, newOwnerUserId);
        setUpdatingRoleKey(key);

        try {
            await transferHouseholdOwnership(householdId, newOwnerUserId);
            await refetch();
        } catch (err) {
            alert(err?.message || "Could not transfer ownership.");
            throw err;
        } finally {
            setUpdatingRoleKey(null);
        }
    };

    const handleRenameHousehold = async (householdId, name) => {
        const trimmedName = String(name || "").trim();
        if (!trimmedName) {
            throw new Error("Household name is required.");
        }

        setRenamingHouseholdId(householdId);

        try {
            await updateHousehold(householdId, trimmedName);
            await refetch();
        } catch (err) {
            alert(err?.message || "Could not rename household.");
            throw err;
        } finally {
            setRenamingHouseholdId(null);
        }
    };

    // Sorted members helper (you first, then alphabetical by display name)
    const householdsWithSortedMembers = useMemo(() => {
        return (households || []).map((h) => {
            const sortedMembers = [...(h.members || [])].sort((a, b) => {
                const aIsMe = me?.username && a?.username && me.username === a.username;
                const bIsMe = me?.username && b?.username && me.username === b.username;

                if (aIsMe) return -1;
                if (bIsMe) return 1;

                const nameA = (a.display_name || a.username || "").toLowerCase();
                const nameB = (b.display_name || b.username || "").toLowerCase();
                return nameA.localeCompare(nameB);
            });

            return { ...h, members: sortedMembers };
        });
    }, [households, me?.username]);

    return {
        // data
        households: householdsWithSortedMembers,
        loading,
        error,
        me,

        // ui state
        confirmKey,
        setConfirmKey,
        removingKey,

        inviteByHousehold,
        leaveConfirmHouseholdId,
        setLeaveConfirmHouseholdId,
        leavingHouseholdId,
        updatingRoleKey,
        renamingHouseholdId,

        // create modal
        isCreatingUI,
        setIsCreatingUI,
        newHouseholdName,
        setNewHouseholdName,
        creating,

        // join modal
        isJoiningUI,
        setIsJoiningUI,
        joinCodeOrLink,
        setJoinCodeOrLink,
        joining,

        // actions
        handleCreateHousehold,
        handleJoinHousehold,
        handleInvite,
        toggleInviteVisibility,
        setInviteEmail,
        handleEmailInvite,
        handleCopyInvite,
        handleRemoveMember,
        handleLeave,
        handleTransferOwnership,
        handleRenameHousehold,
        handleUpdateMemberRole,

        refetch,
    };
}

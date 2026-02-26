import { useMemo, useState } from "react";
import {
    useHousehold,
    createHouseholdInvite,
    createHousehold,
    removeHouseholdMember,
    leaveHousehold,
    updateHouseholdMemberRole,
} from "@/hooks/useHouseHold";
import { acceptHouseholdInvite, getUserFromLocalStorage } from "@/lib/utils";


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
        } catch (err) {
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
            await createHousehold(name);
            setIsCreatingUI(false);
            setNewHouseholdName("");
            await refetch();
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
        } finally {
            setHouseholdInviteState(householdId, { inviting: false });
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
        handleCopyInvite,
        handleRemoveMember,
        handleLeave,
        handleUpdateMemberRole,

        refetch,
    };
}

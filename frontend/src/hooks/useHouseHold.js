import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/utils";

const LS_HOUSEHOLDS_KEY = "households";

export function useHousehold() {
    const [households, setHouseholds] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_HOUSEHOLDS_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    });

    const [loading, setLoading] = useState(households.length === 0);
    const [error, setError] = useState(null);

    const load = async () => {
        setLoading(true);
        setError(null);

        try {
            const data = await apiFetch("/api/household", { method: "GET" });
            const arr = Array.isArray(data?.households) ? data.households : [];
            setHouseholds(arr);
            localStorage.setItem(LS_HOUSEHOLDS_KEY, JSON.stringify(arr));
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const normalizedHouseholds = useMemo(() => {
        return (households || []).map((h) => ({
            household_id: h.household_id,
            name: h.name ?? h.household_name ?? "Household",
            members: (h.members || []).map((m) => ({
                user_id: m.user_id ?? m.id,
                username: m.username ?? "",
                email: m.email ?? null,
                display_name: m.display_name ?? m.displayName ?? null,
            })),
        }));
    }, [households]);

    const membersFlat = useMemo(() => {
        return normalizedHouseholds.flatMap((h) =>
            h.members.map((m) => ({
                ...m,
                household_id: h.household_id,
                household_name: h.name,
            }))
        );
    }, [normalizedHouseholds]);

    return {
        households: normalizedHouseholds,
        membersFlat,
        loading,
        error,
        setHouseholds,
        refetch: load,
    };
}


export async function createHouseholdInvite(household_id) {
    return apiFetch("/api/household/invite", {
        method: "POST",
        body: JSON.stringify({ household_id }),
        headers: { "Content-Type": "application/json" },
    });
}

export async function createHousehold(name) {
    return apiFetch("/api/household", {
        method: "POST",
        body: JSON.stringify({ name }),
        headers: { "Content-Type": "application/json" },
    });
}

export async function removeHouseholdMember(household_id, user_id) {
    return apiFetch("/api/household/members", {
        method: "DELETE",
        body: JSON.stringify({ household_id, user_id }),
        headers: { "Content-Type": "application/json" },
    });
}

export async function leaveHousehold(household_id) {
    return apiFetch("/api/household/leave", {
        method: "POST",
        body: JSON.stringify({ household_id }),
        headers: { "Content-Type": "application/json" },
    });
}

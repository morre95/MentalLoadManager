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

    useEffect(() => {
        let alive = true;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                // NEW multi-household endpoint
                const data = await apiFetch("/api/household/my", { method: "GET" });
                if (!alive) return;

                const arr = Array.isArray(data?.households) ? data.households : [];
                setHouseholds(arr);
                localStorage.setItem(LS_HOUSEHOLDS_KEY, JSON.stringify(arr));
            } catch (e) {
                if (!alive) return;
                setError(e);
            } finally {
                if (!alive) return;
                setLoading(false);
            }
        }

        load();
        return () => {
            alive = false;
        };
    }, []);

    const normalizedHouseholds = useMemo(() => {
        return (households || []).map((h) => ({
            household_id: h.household_id,
            name: h.name ?? h.household_name ?? "Household",
            members: (h.members || []).map((m) => ({
                user_id: m.user_id ?? m.id,
                username: m.username ?? "",
                email: m.email ?? null,
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
        membersFlat, // optional convenience
        loading,
        error,
        setHouseholds,
    };
}

export async function createHouseholdInvite(household_id) {
    return apiFetch("/api/household/invite", {
        method: "POST",
        body: JSON.stringify({ household_id }),
        headers: { "Content-Type": "application/json" },
    });
}

// src/hooks/useHouseholdMembers.js
import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/utils";
import { loadHouseholdMembers, saveHouseholdMembers } from "@/lib/householdStorage";

export function useHouseholdMembers() {
    const [members, setMembers] = useState(() => loadHouseholdMembers());
    const [loading, setLoading] = useState(members.length === 0); // only "loading" if nothing cached
    const [error, setError] = useState(null);

    const refresh = useCallback(async () => {
        setError(null);

        // keep UI responsive if we already have cached members
        setLoading(members.length === 0);

        try {
            const data = await apiFetch("/api/household/members", { method: "GET" });

            const normalized = (data.members || []).map((m) => ({
                id: m.user_id,
                name: m.username,
                email: m.email,
            }));

            setMembers(normalized);
            saveHouseholdMembers(normalized);
        } catch (e) {
            setError(e);
        } finally {
            setLoading(false);
        }
    }, [members.length]);

    useEffect(() => {
        // if empty cache, fetch on mount
        if (members.length === 0) {
            refresh();
        } else {
            // still refresh in background to stay fresh
            refresh();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Optional helpers if you want to update locally from UI
    const setAndPersist = useCallback((next) => {
        setMembers((prev) => {
            const value = typeof next === "function" ? next(prev) : next;
            saveHouseholdMembers(value);
            return value;
        });
    }, []);

    return { members, setMembers: setAndPersist, loading, error, refresh };
}

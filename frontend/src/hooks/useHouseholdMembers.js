import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/utils";

export function useHouseholdMembers() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;

        async function load() {
            setLoading(true);
            setError(null);
            try {
                const data = await apiFetch("/api/household", { method: "GET" });
                if (!alive) return;

                const households = Array.isArray(data?.households)
                    ? data.households
                    : [];
                const flat = households.flatMap((h) =>
                    (h.members || []).map((m) => ({
                        user_id: m.user_id ?? m.id,
                        username: m.username ?? "",
                        email: m.email ?? null,
                        household_id: h.household_id,
                        household_name: h.name ?? "Household",
                        display_name: m.display_name ?? null,
                    })),
                );

                setMembers(flat);
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

    const normalized = useMemo(() => members ?? [], [members]);

    return { members: normalized, loading, error };
}

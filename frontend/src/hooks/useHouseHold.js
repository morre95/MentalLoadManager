import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/utils";

const LS_HOUSEHOLD_KEY = "household";

export function useHousehold() {
    const [household, setHousehold] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_HOUSEHOLD_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    });

    const [members, setMembers] = useState(() => household?.members ?? []);
    const [loading, setLoading] = useState(!household);
    const [error, setError] = useState(null);

    useEffect(() => {
        let alive = true;

        async function load() {
            setLoading(true);
            setError(null);

            try {
                // 1) Get my household
                const me = await apiFetch("/api/household/me", { method: "GET" });

                if (!alive) return;

                setHousehold(me);
                localStorage.setItem(LS_HOUSEHOLD_KEY, JSON.stringify(me));

                // 2) Get members
                // If your backend infers household from token, this works as-is:
                const list = await apiFetch("/api/household/members", { method: "GET" });

                if (!alive) return;

                // list could be { members: [...] } OR just [...]
                const arr = Array.isArray(list) ? list : list?.members ?? [];
                setMembers(arr);

                // optional: also store members inside household cache
                const merged = { ...me, members: arr };
                setHousehold(merged);
                localStorage.setItem(LS_HOUSEHOLD_KEY, JSON.stringify(merged));
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

    const normalizedMembers = useMemo(() => {
        return (members || []).map((m) => ({
            user_id: m.user_id ?? m.id,
            username: m.username ?? "",
            email: m.email ?? null,
        }));
    }, [members]);

    return {
        household,
        members: normalizedMembers,
        loading,
        error,
        setHousehold,
        setMembers,
    };
}

export async function createHouseholdInvite() {
    return apiFetch("/api/household/invite", { method: "POST" });
}

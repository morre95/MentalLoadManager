import { useCallback, useMemo, useRef, useState } from "react";
import { createApiClient, fetchCalendarMonth, fetchCalendarRange } from "../../../shared";
import { clearAuth, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/utils";
import { parseISO, format } from "date-fns";

const apiClient = createApiClient({
    getAccessToken,
    getRefreshToken,
    setAuthTokens,
    onUnauthorized: clearAuth,
    envOptions: {
        locationHref: typeof window !== "undefined" ? window.location?.href : "",
    },
});

const PALETTE = ["terracotta", "sage", "lavender", "sky"];

function stableHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
}

function householdColor(householdId) {
    if (!householdId) return "sage";
    return PALETTE[stableHash(householdId) % PALETTE.length];
}

function normalizeUiEvent(e) {
    const dateObj = e?.date ? parseISO(e.date) : null;
    return {
        id: e?.id ?? "",
        title: e?.title ?? "",
        dateStr: e?.date ?? null, // YYYY-MM-DD
        date: dateObj, // Date
        householdId: e?.household_id ?? null,
        householdName: e?.household_name || "",
        color: householdColor(e?.household_id),
        type: "task",
    };
}

export function useCalendarPage() {
    const [monthPayload, setMonthPayload] = useState(null);
    const [rangePayload, setRangePayload] = useState(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [loadingWeek, setLoadingWeek] = useState(false);
    const [error, setError] = useState(null);

    // Prevent re-fetching the same week range repeatedly
    const lastWeekRangeKeyRef = useRef(null);

    const loadMonth = useCallback(async (dateObj) => {
        setLoadingMonth(true);
        setError(null);
        try {
            const year = dateObj.getFullYear();
            const month = dateObj.getMonth() + 1;
            const data = await fetchCalendarMonth(apiClient, year, month);
            setMonthPayload(data);
        } catch (err) {
            setError(err);
        } finally {
            setLoadingMonth(false);
        }
    }, []);

    const loadRange = useCallback(async (fromDateStr, toDateStr) => {
        setLoadingWeek(true);
        setError(null);
        try {
            const data = await fetchCalendarRange(apiClient, fromDateStr, toDateStr);
            setRangePayload(data);
        } catch (err) {
            setError(err);
        } finally {
            setLoadingWeek(false);
        }
    }, []);

    // ✅ stable function identity (won’t change every render)
    const loadWeekRange = useCallback(
        async (weekStart, weekEnd) => {
            const from = format(weekStart, "yyyy-MM-dd");
            const to = format(weekEnd, "yyyy-MM-dd");
            const key = `${from}:${to}`;

            if (lastWeekRangeKeyRef.current === key) return; // already loaded this exact range
            lastWeekRangeKeyRef.current = key;

            return loadRange(from, to);
        },
        [loadRange]
    );

    const monthEvents = useMemo(() => {
        const raw = Array.isArray(monthPayload?.events) ? monthPayload.events : [];
        return raw.map(normalizeUiEvent).filter((e) => e.date);
    }, [monthPayload]);

    const rangeEvents = useMemo(() => {
        const raw = Array.isArray(rangePayload?.events) ? rangePayload.events : [];
        return raw.map(normalizeUiEvent).filter((e) => e.date);
    }, [rangePayload]);

    const eventsByDayKey = useMemo(() => {
        const map = new Map();
        for (const e of monthEvents) {
            const k = e.dateStr;
            if (!k) continue;
            const list = map.get(k) || [];
            list.push(e);
            map.set(k, list);
        }
        return map;
    }, [monthEvents]);

    return {
        monthPayload,
        rangePayload,

        monthEvents,
        weekEvents: rangeEvents,
        eventsByDayKey,

        loadingMonth,
        loadingWeek,
        error,

        loadMonth,
        loadWeekRange,
    };
}

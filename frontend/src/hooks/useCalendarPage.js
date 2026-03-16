import { useCallback, useMemo, useRef, useState } from "react";
import { fetchCalendarMonth, fetchCalendarRange } from "../../../shared";
import { apiClient } from "@/lib/utils";
import { parseISO, format } from "date-fns";

const PALETTE = ["terracotta", "lavender", "sky", "status-todo"];

function normalizeUiEvent(event) {
    const dateObj = event?.date ? parseISO(event.date) : null;

    return {
        id: event?.id ?? "",
        title: event?.title ?? "",
        dateStr: event?.date ?? null,
        date: dateObj,
        householdId: event?.household_id ?? null,
        householdName: event?.household_name || "",
        color: null,
        type: event?.type ?? "task",
        recurrenceEnabled: Boolean(event?.recurrence_enabled),
        recurrenceFrequency: event?.recurrence_frequency ?? null,
        recurrenceInterval: event?.recurrence_interval ?? null,
        recurrenceLabel: event?.recurrence_label ?? "",
    };
}

function buildEventsByDayKey(events) {
    const map = new Map();

    for (const event of events) {
        const key = event.dateStr;
        if (!key) continue;

        const existing = map.get(key) || [];
        existing.push(event);
        map.set(key, existing);
    }

    return map;
}

export function useCalendarPage() {
    const [monthPayload, setMonthPayload] = useState(null);
    const [rangePayload, setRangePayload] = useState(null);
    const [loadingMonth, setLoadingMonth] = useState(false);
    const [loadingWeek, setLoadingWeek] = useState(false);
    const [monthError, setMonthError] = useState(null);
    const [weekError, setWeekError] = useState(null);

    const lastWeekRangeKeyRef = useRef(null);
    const lastMonthKeyRef = useRef(null);

    const loadMonth = useCallback(async (dateObj, options = {}) => {
        const { force = false } = options;
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const key = `${year}-${String(month).padStart(2, "0")}`;

        if (!force && lastMonthKeyRef.current === key) return;
        lastMonthKeyRef.current = key;

        setLoadingMonth(true);
        setMonthError(null);

        try {
            const data = await fetchCalendarMonth(apiClient, year, month);
            setMonthPayload(data);
            return data;
        } catch (error) {
            setMonthError(error);
            throw error;
        } finally {
            setLoadingMonth(false);
        }
    }, []);

    const loadRange = useCallback(async (fromDateStr, toDateStr) => {
        setLoadingWeek(true);
        setWeekError(null);

        try {
            const data = await fetchCalendarRange(apiClient, fromDateStr, toDateStr);
            setRangePayload(data);
            return data;
        } catch (error) {
            setWeekError(error);
            throw error;
        } finally {
            setLoadingWeek(false);
        }
    }, []);

    const loadWeekRange = useCallback(
        async (weekStart, weekEnd, options = {}) => {
            const { force = false } = options;
            const from = format(weekStart, "yyyy-MM-dd");
            const to = format(weekEnd, "yyyy-MM-dd");
            const key = `${from}:${to}`;

            if (!force && lastWeekRangeKeyRef.current === key) return;
            lastWeekRangeKeyRef.current = key;

            return loadRange(from, to);
        },
        [loadRange]
    );

    const householdColorById = useMemo(() => {
        const map = new Map();
        const idsInOrder = [];
        const seen = new Set();

        const allEvents = [
            ...(Array.isArray(monthPayload?.events) ? monthPayload.events : []),
            ...(Array.isArray(rangePayload?.events) ? rangePayload.events : []),
        ];

        for (const event of allEvents) {
            const householdId = event?.household_id;
            if (!householdId) continue;
            const key = String(householdId);
            if (seen.has(key)) continue;
            seen.add(key);
            idsInOrder.push(key);
        }

        idsInOrder.forEach((householdId, index) => {
            map.set(householdId, PALETTE[index % PALETTE.length]);
        });

        return map;
    }, [monthPayload, rangePayload]);

    const monthEvents = useMemo(() => {
        const raw = Array.isArray(monthPayload?.events) ? monthPayload.events : [];
        return raw
            .map(normalizeUiEvent)
            .filter((event) => event.date)
            .map((event) => ({
                ...event,
                color: householdColorById.get(String(event.householdId || "")) || PALETTE[0],
            }));
    }, [monthPayload, householdColorById]);

    const rangeEvents = useMemo(() => {
        const raw = Array.isArray(rangePayload?.events) ? rangePayload.events : [];
        return raw
            .map(normalizeUiEvent)
            .filter((event) => event.date)
            .map((event) => ({
                ...event,
                color: householdColorById.get(String(event.householdId || "")) || PALETTE[0],
            }));
    }, [rangePayload, householdColorById]);

    const monthEventsByDayKey = useMemo(() => buildEventsByDayKey(monthEvents), [monthEvents]);
    const rangeEventsByDayKey = useMemo(() => buildEventsByDayKey(rangeEvents), [rangeEvents]);

    return {
        monthPayload,
        rangePayload,
        monthEvents,
        weekEvents: rangeEvents,
        monthEventsByDayKey,
        rangeEventsByDayKey,
        eventsByDayKey: monthEventsByDayKey,
        householdColorById,
        householdPalette: PALETTE,
        loadingMonth,
        loadingWeek,
        monthError,
        weekError,
        error: monthError || weekError,
        loadMonth,
        loadWeekRange,
    };
}

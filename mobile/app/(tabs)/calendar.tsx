import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { fetchCalendarMonth } from '../../../shared/index.js';
import { TabMenuButton } from '@/components/TabMenuButton';
import { mobileApiClient } from '@/lib/api';

const COLORS = {
  bg: '#f7f6f2',
  card: '#ffffff',
  text: '#2b2a28',
  muted: '#78736b',
  border: '#ddd7ca',
  primary: '#64786f',
  terracotta: '#c7674a',
  todayBg: '#64786f',
  selectedBg: '#e8eeec',
} as const;

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// --- Date helpers (no library) ---

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date {
  // parse YYYY-MM-DD as local time
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Day-of-week index where Monday=0, Sunday=6 */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function monthLabel(year: number, month: number): string {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  description: string | null;
  person: string | null;
  household_name: string | null;
  category_name: string | null;
  recurrence_label?: string;
  recurrence_enabled?: boolean;
  is_projected?: boolean;
}

// --- Build a 6-row grid of day numbers / nulls (null = padding) ---
function buildGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month - 1, 1);
  const leadingBlanks = mondayIndex(firstDay);
  const totalDays = daysInMonth(year, month);
  const cells: (number | null)[] = [
    ...Array(leadingBlanks).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // Pad to multiple of 7
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function CalendarScreen() {
  const today = useMemo(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1, iso: toLocalIso(now) };
  }, []);

  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIso, setSelectedIso] = useState<string>(today.iso);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const load = useCallback(
    async (y: number, m: number) => {
      setError(null);
      try {
        const data = await fetchCalendarMonth(mobileApiClient, y, m);
        setEvents(
          Array.isArray(data?.events)
            ? data.events.map((e: any) => ({
              id: String(e.id ?? `${e.date}-${Math.random()}`),
              date: e.date ?? '',
              title: e.title ?? '',
              description: e.description ?? null,
              person: e.person ?? null,
              household_name: e.household_name ?? null,
              category_name: e.category_name ?? null,
              recurrence_label: e.recurrence_label ?? '',
              recurrence_enabled: Boolean(e.recurrence_enabled),
              is_projected: Boolean(e.is_projected),
            }))
            : []
        );
      } catch (err: any) {
        setError(err?.message || 'Could not load calendar');
      }
    },
    []
  );

  useEffect(() => {
    let alive = true;
    const run = async () => {
      try {
        await load(year, month);
      } finally {
        if (alive) setLoading(false);
      }
    };
    run();
    return () => {
      alive = false;
    };
  }, [load, year, month]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(year, month);
    setRefreshing(false);
  }, [load, year, month]);

  const prevMonth = useCallback(() => {
    setLoading(true);
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  }, [month]);

  const nextMonth = useCallback(() => {
    setLoading(true);
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  }, [month]);

  const grid = useMemo(() => buildGrid(year, month), [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    for (const ev of events) {
      if (!ev.date) continue;
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    }
    return map;
  }, [events]);

  const selectedEvents = useMemo(
    () => eventsByDate[selectedIso] ?? [],
    [eventsByDate, selectedIso]
  );

  // All upcoming events (from today onwards) sorted by date
  const upcomingEvents = useMemo(() => {
    return events
      .filter((ev) => ev.date >= today.iso)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
  }, [events, today.iso]);

  const label = useMemo(() => monthLabel(year, month), [year, month]);
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );
  const selectedEventDateLabel = useMemo(() => {
    if (!selectedEvent?.date) return 'No date';
    return parseIso(selectedEvent.date).toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }, [selectedEvent]);

  return (
    <>
      <TabMenuButton />
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.headerWrap}>
          <Text style={styles.eyebrow}>Mental Load Manager</Text>
          <Text style={styles.title}>Calendar</Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.calendarCard}>
          <View style={styles.monthNav}>
            <Pressable style={styles.navBtn} onPress={prevMonth} hitSlop={10}>
              <Text style={styles.navBtnText}>‹</Text>
            </Pressable>
            <Text style={styles.monthLabel}>{label}</Text>
            <Pressable style={styles.navBtn} onPress={nextMonth} hitSlop={10}>
              <Text style={styles.navBtnText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.dayRow}>
            {DAY_LABELS.map((d) => (
              <Text key={d} style={styles.dayLabel}>
                {d}
              </Text>
            ))}
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={COLORS.primary} />
            </View>
          ) : (
            <View style={styles.grid}>
              {grid.map((day, index) => {
                if (day === null) {
                  return <View key={`blank-${index}`} style={styles.cell} />;
                }

                const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                const isToday = iso === today.iso;
                const isSelected = iso === selectedIso && !isToday;
                const hasEvent = Boolean(eventsByDate[iso]?.length);

                return (
                  <Pressable
                    key={iso}
                    style={[
                      styles.cell,
                      isToday && styles.cellToday,
                      isSelected && styles.cellSelected,
                    ]}
                    onPress={() => setSelectedIso(iso)}
                  >
                    <Text
                      style={[
                        styles.cellText,
                        isToday && styles.cellTextToday,
                        isSelected && styles.cellTextSelected,
                      ]}
                    >
                      {day}
                    </Text>
                    {hasEvent && !isToday && (
                      <View style={[styles.eventDot, isSelected && styles.eventDotSelected]} />
                    )}
                    {hasEvent && isToday && <View style={styles.eventDotOnToday} />}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedIso === today.iso
              ? 'Today'
              : parseIso(selectedIso).toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
          </Text>

          {selectedEvents.length === 0 ? (
            <Text style={styles.emptyText}>No events on this day.</Text>
          ) : (
            selectedEvents.map((ev) => (
              <Pressable key={ev.id} style={styles.eventCard} onPress={() => setSelectedEventId(ev.id)}>
                <View style={styles.eventRow}>
                  <View style={styles.eventDotLarge} />
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                    {(ev.person || ev.household_name) ? (
                      <Text style={styles.eventMeta}>
                        {[ev.person, ev.household_name].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    <Text style={styles.eventLinkText}>Tap to view details</Text>
                  </View>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {upcomingEvents.length > 0 && selectedIso === today.iso ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming</Text>
            {upcomingEvents.map((ev) => {
              const d = parseIso(ev.date);
              const dayNum = d.getDate();
              const shortMonth = d.toLocaleDateString(undefined, { month: 'short' });
              return (
                <Pressable
                  key={ev.id}
                  style={styles.upcomingRow}
                  onPress={() => setSelectedEventId(ev.id)}
                >
                  <View style={styles.upcomingDate}>
                    <Text style={styles.upcomingDateDay}>{dayNum}</Text>
                    <Text style={styles.upcomingDateMonth}>{shortMonth}</Text>
                  </View>
                  <View style={styles.eventInfo}>
                    <Text style={styles.eventTitle}>{ev.title}</Text>
                    {(ev.person || ev.household_name) ? (
                      <Text style={styles.eventMeta}>
                        {[ev.person, ev.household_name].filter(Boolean).join(' · ')}
                      </Text>
                    ) : null}
                    <Text style={styles.eventLinkText}>Tap to view details</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={Boolean(selectedEvent)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEventId(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedEventId(null)} />
          <View style={styles.modalCard}>
            {selectedEvent ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderContent}>
                    <Text style={styles.modalEyebrow}>Calendar Task</Text>
                    <Text style={styles.modalTitle}>{selectedEvent.title}</Text>
                  </View>
                  <Pressable style={styles.modalCloseButton} onPress={() => setSelectedEventId(null)}>
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </Pressable>
                </View>

                <View style={styles.modalMetaGrid}>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Due Date</Text>
                    <Text style={styles.modalMetaValue}>{selectedEventDateLabel}</Text>
                  </View>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Household</Text>
                    <Text style={styles.modalMetaValue}>
                      {selectedEvent.household_name || 'No household'}
                    </Text>
                  </View>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Assigned To</Text>
                    <Text style={styles.modalMetaValue}>{selectedEvent.person || 'Unassigned'}</Text>
                  </View>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Category</Text>
                    <Text style={styles.modalMetaValue}>
                      {selectedEvent.category_name || 'Other'}
                    </Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Description</Text>
                  <Text style={styles.modalBodyText}>
                    {selectedEvent.description?.trim() || 'No description added yet.'}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Recurrence</Text>
                  <Text style={styles.modalBodyText}>
                    {selectedEvent.recurrence_enabled
                      ? selectedEvent.recurrence_label || 'Repeats on a recurring schedule.'
                      : 'Does not repeat.'}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingTop: 16,
  },
  pageContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 32,
  },
  headerWrap: {
    marginBottom: 4,
    gap: 3,
  },
  eyebrow: {
    color: COLORS.primary,
    letterSpacing: 1,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: COLORS.text,
    fontSize: 30,
    fontWeight: '800',
  },
  errorText: {
    color: '#a22929',
    fontWeight: '600',
  },
  calendarCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  navBtnText: {
    fontSize: 20,
    color: COLORS.text,
    lineHeight: 24,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  dayRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: `${100 / 7}%` as any,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    position: 'relative',
  },
  cellToday: {
    backgroundColor: COLORS.todayBg,
    borderRadius: 8,
  },
  cellSelected: {
    backgroundColor: COLORS.selectedBg,
    borderRadius: 8,
  },
  cellText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  cellTextToday: {
    color: '#fff',
    fontWeight: '700',
  },
  cellTextSelected: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  eventDot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.terracotta,
  },
  eventDotSelected: {
    backgroundColor: COLORS.primary,
  },
  eventDotOnToday: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  section: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  emptyText: {
    color: COLORS.muted,
    fontStyle: 'italic',
    fontSize: 13,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  eventCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fffcf8',
    padding: 10,
  },
  eventDotLarge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.terracotta,
    marginTop: 4,
    flexShrink: 0,
  },
  eventInfo: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  eventMeta: {
    fontSize: 12,
    color: COLORS.muted,
  },
  eventLinkText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    backgroundColor: '#fffcf8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  upcomingDate: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fceee8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upcomingDateDay: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.terracotta,
    lineHeight: 18,
  },
  upcomingDateMonth: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.terracotta,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(28, 25, 22, 0.2)',
  },
  modalBackdrop: {
    flex: 1,
  },
  modalCard: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    gap: 16,
    maxHeight: '75%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalHeaderContent: {
    flex: 1,
    minWidth: 0,
  },
  modalEyebrow: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 4,
  },
  modalCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
  },
  modalCloseButtonText: {
    color: COLORS.text,
    fontWeight: '700',
  },
  modalMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  modalMetaCard: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fffdfa',
    padding: 12,
    gap: 4,
  },
  modalMetaLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modalMetaValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  modalSection: {
    gap: 6,
  },
  modalSectionLabel: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  modalBodyText: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 20,
  },
});

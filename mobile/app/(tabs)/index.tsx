import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  createKanbanTask,
  deleteKanbanTask,
  fetchHouseholds,
  fetchKanbanTasks,
  updateKanbanTaskStatus,
  type UiTask,
} from '../../../shared/index.js';
import { mobileApiBaseUrl, mobileApiClient } from '@/lib/api';

const COLORS = {
  bg: '#f7f6f2',
  card: '#ffffff',
  text: '#2b2a28',
  muted: '#78736b',
  border: '#ddd7ca',
  primary: '#64786f',
  todo: '#d49a00',
  doing: '#5470b3',
  done: '#4f8a62',
  archive: '#8a7bbf',
} as const;

const COLUMN_ORDER = ['todo', 'in-progress', 'done', 'archive'] as const;
const ALL_HOUSEHOLDS = '__all_households__';

const COLUMN_LABELS: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  done: 'Done',
  archive: 'Archive',
};

const STATUS_COLORS: Record<string, string> = {
  todo: COLORS.todo,
  'in-progress': COLORS.doing,
  done: COLORS.done,
  archive: COLORS.archive,
};
const PRIORITY_STYLES: Record<
  string,
  { backgroundColor: string; borderColor: string; textColor: string }
> = {
  low: {
    backgroundColor: '#e6efe9',
    borderColor: 'rgba(86, 143, 114, 0.3)',
    textColor: '#568f72',
  },
  medium: {
    backgroundColor: 'rgba(232, 151, 48, 0.15)',
    borderColor: 'rgba(232, 151, 48, 0.3)',
    textColor: '#e89730',
  },
  high: {
    backgroundColor: '#f8ece8',
    borderColor: 'rgba(219, 145, 112, 0.3)',
    textColor: '#db9170',
  },
};
const BOTTOM_REFRESH_THRESHOLD = 80;
const SCROLL_REFRESH_COOLDOWN_MS = 15000;

function getAssigneeLabel(task: UiTask) {
  return task.assigneeLabel || 'Unassigned';
}

function formatStatusLabel(status: string) {
  return String(status || '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function getPriorityStyle(priority: string) {
  return PRIORITY_STYLES[String(priority || '').toLowerCase()] || PRIORITY_STYLES.medium;
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [households, setHouseholds] = useState<{ household_id: string | number; name: string }[]>(
    []
  );
  const [selectedHouseholdId, setSelectedHouseholdId] = useState<string>(ALL_HOUSEHOLDS);
  const [activeColumn, setActiveColumn] = useState<(typeof COLUMN_ORDER)[number]>('todo');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addTaskSaving, setAddTaskSaving] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const lastScrollRefreshAtRef = useRef(0);

  const selectedHouseholdFilter =
    selectedHouseholdId === ALL_HOUSEHOLDS ? null : selectedHouseholdId;

  const selectedHouseholdName = useMemo(() => {
    if (selectedHouseholdId === ALL_HOUSEHOLDS) return 'All households';
    const household = households.find(
      (item) => String(item.household_id) === String(selectedHouseholdId)
    );
    return household?.name || 'Selected household';
  }, [households, selectedHouseholdId]);

  const loadTasks = useCallback(async () => {
    setError(null);

    try {
      const data = await fetchKanbanTasks(mobileApiClient, selectedHouseholdFilter);
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load tasks');
    }
  }, [selectedHouseholdFilter]);

  const loadHouseholds = useCallback(async () => {
    try {
      const data = await fetchHouseholds(mobileApiClient);
      const nextHouseholds = Array.isArray(data?.households) ? data.households : [];
      setHouseholds(nextHouseholds);
    } catch (err: any) {
      setError(err?.message || 'Could not load households');
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        await loadHouseholds();
        await loadTasks();
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [loadHouseholds, loadTasks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHouseholds();
    await loadTasks();
    setRefreshing(false);
  }, [loadHouseholds, loadTasks]);

  const onScrollRefresh = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (loading || refreshing || addTaskSaving) return;

      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const isNearBottom =
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - BOTTOM_REFRESH_THRESHOLD;

      if (!isNearBottom) return;

      const now = Date.now();
      if (now - lastScrollRefreshAtRef.current < SCROLL_REFRESH_COOLDOWN_MS) return;
      lastScrollRefreshAtRef.current = now;
      void onRefresh();
    },
    [addTaskSaving, loading, onRefresh, refreshing]
  );

  const grouped = useMemo(() => {
    return COLUMN_ORDER.map((column) => {
      const columnTasks = tasks.filter((task) => task.status === column);
      return {
        id: column,
        title: COLUMN_LABELS[column],
        color: STATUS_COLORS[column],
        tasks: columnTasks,
      };
    });
  }, [tasks]);

  const activeColumnData = useMemo(
    () => grouped.find((column) => column.id === activeColumn) ?? grouped[0],
    [activeColumn, grouped]
  );
  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, tasks]
  );
  const selectedTaskHouseholdName = useMemo(() => {
    if (!selectedTask?.householdId) return selectedHouseholdName;
    const household = households.find(
      (item) => String(item.household_id) === String(selectedTask.householdId)
    );
    return household?.name || 'Unknown household';
  }, [households, selectedHouseholdName, selectedTask]);

  const onChangeStatus = useCallback(
    async (task: UiTask, targetStatus: string) => {
      const previous = tasks;

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id
            ? {
              ...item,
              status: targetStatus,
            }
            : item
        )
      );

      try {
        await updateKanbanTaskStatus(mobileApiClient, task.id, targetStatus);
      } catch {
        setTasks(previous);
        setError('Could not sync task status. Reverted local change.');
      }
    },
    [tasks]
  );
  const onDeleteTask = useCallback(
    async (task: UiTask) => {
      const previous = tasks;

      setError(null);
      setTasks((current) => current.filter((item) => item.id !== task.id));
      if (selectedTaskId === task.id) {
        setSelectedTaskId(null);
      }

      try {
        await deleteKanbanTask(mobileApiClient, task.id);
      } catch {
        setTasks(previous);
        setError('Could not delete task. Restored local change.');
      }
    },
    [selectedTaskId, tasks]
  );

  const onCreateTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title || addTaskSaving) return;

    setAddTaskError(null);
    setError(null);
    setAddTaskSaving(true);

    try {
      const householdId =
        selectedHouseholdFilter || (households[0]?.household_id ? String(households[0].household_id) : null);
      if (!householdId) {
        setAddTaskError('No household found. Create or join a household first.');
        return;
      }

      const createdTask = await createKanbanTask(mobileApiClient, {
        household_id: householdId,
        name: title,
        status: 'todo',
        description: null,
        priority: 'medium',
        due_date: null,
      });

      setTasks((previous) => [
        {
          id: String(createdTask?.task_id || `tmp-${Date.now()}`),
          householdId,
          title,
          description: '',
          status: 'todo',
          priority: 'medium',
          assigneeLabel: 'Unassigned',
          category: 'Other',
        },
        ...previous,
      ]);

      setNewTaskTitle('');
      setIsAddTaskOpen(false);
    } catch (err: any) {
      setAddTaskError(err?.message || 'Could not create task');
    } finally {
      setAddTaskSaving(false);
    }
  }, [addTaskSaving, households, newTaskTitle, selectedHouseholdFilter]);

  useEffect(() => {
    if (selectedHouseholdId === ALL_HOUSEHOLDS) return;
    const exists = households.some(
      (item) => String(item.household_id) === String(selectedHouseholdId)
    );
    if (!exists) {
      setSelectedHouseholdId(ALL_HOUSEHOLDS);
    }
  }, [households, selectedHouseholdId]);

  return (
    <>
      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.pageContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        onScroll={onScrollRefresh}
        scrollEventThrottle={250}
      >
        <View style={styles.headerWrap}>
          <Text style={styles.eyebrow}>Mental Load Manager</Text>
          <Text style={styles.title}>Tasks</Text>
          <Text style={styles.subtitle}>Backend: {mobileApiBaseUrl}</Text>
          <Text style={styles.subtitle}>View: {selectedHouseholdName}</Text>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          <Pressable
            onPress={() => setSelectedHouseholdId(ALL_HOUSEHOLDS)}
            style={[
              styles.filterChip,
              selectedHouseholdId === ALL_HOUSEHOLDS && styles.filterChipActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipText,
                selectedHouseholdId === ALL_HOUSEHOLDS && styles.filterChipTextActive,
              ]}
            >
              All households
            </Text>
          </Pressable>
          {households.map((household) => {
            const householdId = String(household.household_id);
            const isActive = selectedHouseholdId === householdId;
            return (
              <Pressable
                key={householdId}
                onPress={() => setSelectedHouseholdId(householdId)}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {household.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
        >
          {grouped.map((column) => {
            if (column.id === 'archive' && column.tasks.length === 0) return null;
            const isActive = activeColumn === column.id;
            return (
              <Pressable
                key={column.id}
                onPress={() => setActiveColumn(column.id as (typeof COLUMN_ORDER)[number])}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {column.title} ({column.tasks.length})
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {activeColumnData ? (
          <View key={activeColumnData.id} style={styles.columnCard}>
            <View style={styles.columnHeader}>
              <View style={[styles.dot, { backgroundColor: activeColumnData.color }]} />
              <Text style={styles.columnTitle}>{activeColumnData.title}</Text>
              <View style={styles.countPill}>
                <Text style={styles.countText}>{activeColumnData.tasks.length}</Text>
              </View>
            </View>

            {activeColumnData.tasks.length === 0 ? (
              <Text style={styles.emptyText}>No tasks in this column.</Text>
            ) : null}

            {activeColumnData.id === 'todo' ? (
              <View style={styles.addTaskWrap}>
                {isAddTaskOpen ? (
                  <View style={styles.addTaskForm}>
                    <TextInput
                      value={newTaskTitle}
                      onChangeText={setNewTaskTitle}
                      placeholder="What needs to be done?"
                      style={styles.addTaskInput}
                      editable={!addTaskSaving}
                    />
                    <View style={styles.addTaskActions}>
                      <Pressable
                        style={styles.ghostButton}
                        onPress={() => {
                          if (addTaskSaving) return;
                          setIsAddTaskOpen(false);
                          setNewTaskTitle('');
                          setAddTaskError(null);
                        }}
                      >
                        <Text style={styles.ghostButtonText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        style={[
                          styles.primaryButtonSmall,
                          (!newTaskTitle.trim() || addTaskSaving) &&
                            styles.primaryButtonSmallDisabled,
                        ]}
                        onPress={onCreateTask}
                        disabled={!newTaskTitle.trim() || addTaskSaving}
                      >
                        <Text style={styles.primaryButtonSmallText}>
                          {addTaskSaving ? 'Saving...' : 'Add Task'}
                        </Text>
                      </Pressable>
                    </View>
                    {addTaskError ? <Text style={styles.errorText}>{addTaskError}</Text> : null}
                  </View>
                ) : (
                  <Pressable style={styles.addTaskButton} onPress={() => setIsAddTaskOpen(true)}>
                    <Text style={styles.addTaskButtonText}>+ Add Task</Text>
                  </Pressable>
                )}
              </View>
            ) : null}

            {activeColumnData.tasks.map((task) => {
              const priorityStyle = getPriorityStyle(task.priority);

              return (
                <View key={task.id} style={styles.taskCard}>
                  <Pressable
                    style={styles.taskDetailsButton}
                    onPress={() => setSelectedTaskId(task.id)}
                  >
                    <View style={styles.taskHeader}>
                      <Text style={styles.taskTitle}>{task.title}</Text>
                      <View
                        style={[
                          styles.priorityPill,
                          {
                            backgroundColor: priorityStyle.backgroundColor,
                            borderColor: priorityStyle.borderColor,
                          },
                        ]}
                      >
                        <Text style={[styles.priorityText, { color: priorityStyle.textColor }]}>
                          {task.priority}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.taskMeta}>
                      {task.category} • {getAssigneeLabel(task)}
                    </Text>
                    {task.dueDate ? <Text style={styles.taskMeta}>Due {task.dueDate}</Text> : null}
                    <Text style={styles.taskLinkText}>Tap to view details</Text>
                  </Pressable>

                  <View style={styles.statusActions}>
                    {task.status === 'todo' ? (
                      <>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onChangeStatus(task, 'in-progress')}
                        >
                          <Text style={styles.secondaryButtonText}>Move to In Progress</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onChangeStatus(task, 'done')}
                        >
                          <Text style={styles.secondaryButtonText}>Move to Done</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {task.status === 'in-progress' ? (
                      <>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onChangeStatus(task, 'todo')}
                        >
                          <Text style={styles.secondaryButtonText}>Move to To Do</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onChangeStatus(task, 'done')}
                        >
                          <Text style={styles.secondaryButtonText}>Move to Done</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {task.status === 'done' ? (
                      <>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onChangeStatus(task, 'archive')}
                        >
                          <Text style={styles.secondaryButtonText}>Move to Archive</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onChangeStatus(task, 'todo')}
                        >
                          <Text style={styles.secondaryButtonText}>Move to To Do</Text>
                        </Pressable>
                      </>
                    ) : null}
                    {task.status === 'archive' ? (
                      <>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onDeleteTask(task)}
                        >
                          <Text style={styles.secondaryButtonText}>Delete Task</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.secondaryButton, styles.statusActionButton]}
                          onPress={() => onChangeStatus(task, 'done')}
                        >
                          <Text style={styles.secondaryButtonText}>Move to Done</Text>
                        </Pressable>
                      </>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={Boolean(selectedTask)}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedTaskId(null)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTaskId(null)} />
          <View style={styles.modalCard}>
            {selectedTask ? (
              <>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderContent}>
                    <Text style={styles.modalEyebrow}>{selectedTaskHouseholdName}</Text>
                    <Text style={styles.modalTitle}>{selectedTask.title}</Text>
                  </View>
                  <Pressable style={styles.modalCloseButton} onPress={() => setSelectedTaskId(null)}>
                    <Text style={styles.modalCloseButtonText}>Close</Text>
                  </Pressable>
                </View>

                <View style={styles.modalMetaGrid}>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Status</Text>
                    <Text style={styles.modalMetaValue}>{formatStatusLabel(selectedTask.status)}</Text>
                  </View>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Priority</Text>
                    <Text style={styles.modalMetaValue}>{formatStatusLabel(selectedTask.priority)}</Text>
                  </View>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Assigned To</Text>
                    <Text style={styles.modalMetaValue}>{getAssigneeLabel(selectedTask)}</Text>
                  </View>
                  <View style={styles.modalMetaCard}>
                    <Text style={styles.modalMetaLabel}>Category</Text>
                    <Text style={styles.modalMetaValue}>{selectedTask.category || 'Other'}</Text>
                  </View>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Description</Text>
                  <Text style={styles.modalBodyText}>
                    {selectedTask.description?.trim() || 'No description added yet.'}
                  </Text>
                </View>

                <View style={styles.modalSection}>
                  <Text style={styles.modalSectionLabel}>Schedule</Text>
                  <Text style={styles.modalBodyText}>
                    {selectedTask.dueDate ? `Due ${selectedTask.dueDate}` : 'No due date set.'}
                  </Text>
                  {selectedTask.recurrenceEnabled ? (
                    <Text style={styles.modalBodyText}>
                      Repeats {selectedTask.recurrenceLabel || 'on a recurring schedule'}.
                    </Text>
                  ) : (
                    <Text style={styles.modalBodyText}>No recurrence configured.</Text>
                  )}
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
    paddingTop: 16
  },
  pageContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 28,
  },
  headerWrap: {
    marginBottom: 4,
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
  subtitle: {
    color: COLORS.muted,
    marginTop: 4,
  },
  loadingWrap: {
    paddingVertical: 22,
  },
  errorText: {
    color: '#a22929',
    fontWeight: '600',
  },
  columnCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 10,
  },
  filtersRow: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterChipText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 12,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  columnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 99,
  },
  columnTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  countPill: {
    marginLeft: 'auto',
    borderRadius: 999,
    backgroundColor: '#ede8db',
    paddingHorizontal: 9,
    paddingVertical: 2,
  },
  countText: {
    color: COLORS.muted,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyText: {
    color: COLORS.muted,
    fontStyle: 'italic',
  },
  taskCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fffdfa',
    padding: 12,
    gap: 7,
  },
  taskDetailsButton: {
    gap: 7,
  },
  taskHeader: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  taskTitle: {
    color: COLORS.text,
    fontWeight: '700',
    flex: 1,
  },
  priorityPill: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  priorityText: {
    textTransform: 'capitalize',
    fontWeight: '600',
    fontSize: 12,
  },
  taskMeta: {
    color: COLORS.muted,
    fontSize: 12,
  },
  taskLinkText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  statusActions: {
    marginTop: 4,
    gap: 8,
  },
  statusActionButton: {
    marginTop: 0,
  },
  addTaskWrap: {
    marginTop: 4,
  },
  addTaskButton: {
    borderRadius: 10,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: COLORS.border,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  addTaskButtonText: {
    color: COLORS.muted,
    fontWeight: '600',
  },
  addTaskForm: {
    gap: 8,
  },
  addTaskInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    color: COLORS.text,
  },
  addTaskActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  ghostButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: '#fff',
  },
  ghostButtonText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  primaryButtonSmall: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: COLORS.primary,
  },
  primaryButtonSmallDisabled: {
    opacity: 0.6,
  },
  primaryButtonSmallText: {
    color: '#fff',
    fontWeight: '700',
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
    maxHeight: '80%',
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

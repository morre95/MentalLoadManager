import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
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
  hold: '#8a7bbf',
  done: '#4f8a62',
} as const;

const COLUMN_ORDER = ['todo', 'in-progress', 'on-hold', 'done'] as const;

const COLUMN_LABELS: Record<string, string> = {
  todo: 'To Do',
  'in-progress': 'In Progress',
  'on-hold': 'On Hold',
  done: 'Done',
};

const STATUS_COLORS: Record<string, string> = {
  todo: COLORS.todo,
  'in-progress': COLORS.doing,
  'on-hold': COLORS.hold,
  done: COLORS.done,
};
const BOTTOM_REFRESH_THRESHOLD = 80;
const SCROLL_REFRESH_COOLDOWN_MS = 15000;

function nextStatus(status: string) {
  if (status === 'todo') return 'in-progress';
  if (status === 'in-progress') return 'on-hold';
  if (status === 'on-hold') return 'done';
  return 'todo';
}

function previousStatus(status: string) {
  if (status === 'done') return 'on-hold';
  if (status === 'on-hold') return 'in-progress';
  if (status === 'in-progress') return 'todo';
  return 'done';
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addTaskSaving, setAddTaskSaving] = useState(false);
  const [addTaskError, setAddTaskError] = useState<string | null>(null);
  const lastScrollRefreshAtRef = useRef(0);

  const loadTasks = useCallback(async () => {
    setError(null);

    try {
      const data = await fetchKanbanTasks(mobileApiClient);
      setTasks(Array.isArray(data?.tasks) ? data.tasks : []);
    } catch (err: any) {
      setError(err?.message || 'Could not load tasks');
    }
  }, []);

  useEffect(() => {
    let alive = true;

    const run = async () => {
      try {
        await loadTasks();
      } finally {
        if (alive) setLoading(false);
      }
    };

    run();

    return () => {
      alive = false;
    };
  }, [loadTasks]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTasks();
    setRefreshing(false);
  }, [loadTasks]);

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
    return COLUMN_ORDER.map((column) => ({
      id: column,
      title: COLUMN_LABELS[column],
      color: STATUS_COLORS[column],
      tasks: tasks.filter((task) => task.status === column),
    }));
  }, [tasks]);

  const onChangeStatus = useCallback(
    async (task: UiTask, direction: 'forward' | 'backward') => {
      const targetStatus =
        direction === 'forward' ? nextStatus(task.status) : previousStatus(task.status);
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

  const resolveHouseholdId = useCallback(async () => {
    const data = await fetchHouseholds(mobileApiClient);
    const firstHousehold = Array.isArray(data?.households) ? data.households[0] : null;
    const householdId = firstHousehold?.household_id;
    return householdId ? String(householdId) : null;
  }, []);

  const onCreateTask = useCallback(async () => {
    const title = newTaskTitle.trim();
    if (!title || addTaskSaving) return;

    setAddTaskError(null);
    setError(null);
    setAddTaskSaving(true);

    try {
      const householdId = await resolveHouseholdId();
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
          title,
          description: '',
          status: 'todo',
          priority: 'medium',
          assignee: 'Unassigned',
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
  }, [addTaskSaving, newTaskTitle, resolveHouseholdId]);

  return (
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
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {grouped.map((column) => (
        <View key={column.id} style={styles.columnCard}>
          <View style={styles.columnHeader}>
            <View style={[styles.dot, { backgroundColor: column.color }]} />
            <Text style={styles.columnTitle}>{column.title}</Text>
            <View style={styles.countPill}>
              <Text style={styles.countText}>{column.tasks.length}</Text>
            </View>
          </View>

          {column.tasks.length === 0 ? (
            <Text style={styles.emptyText}>No tasks in this column.</Text>
          ) : null}

          {column.id === 'todo' ? (
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
                        (!newTaskTitle.trim() || addTaskSaving) && styles.primaryButtonSmallDisabled,
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

          {column.tasks.map((task) => (
            <View key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskTitle}>{task.title}</Text>
                <View style={styles.priorityPill}>
                  <Text style={styles.priorityText}>{task.priority}</Text>
                </View>
              </View>

              <Text style={styles.taskMeta}>
                {task.category} • {task.assignee}
              </Text>
              {task.dueDate ? <Text style={styles.taskMeta}>Due {task.dueDate}</Text> : null}

              <View style={styles.statusActions}>
                <Pressable
                  style={[styles.secondaryButton, styles.statusActionButton]}
                  onPress={() => onChangeStatus(task, 'backward')}
                >
                  <Text style={styles.secondaryButtonText}>
                    Move back to {COLUMN_LABELS[previousStatus(task.status)]}
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.secondaryButton, styles.statusActionButton]}
                  onPress={() => onChangeStatus(task, 'forward')}
                >
                  <Text style={styles.secondaryButtonText}>
                    Move to {COLUMN_LABELS[nextStatus(task.status)]}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}


        </View>
      ))}
    </ScrollView>
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
    backgroundColor: '#f2efe6',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  priorityText: {
    color: COLORS.muted,
    textTransform: 'capitalize',
    fontWeight: '600',
    fontSize: 12,
  },
  taskMeta: {
    color: COLORS.muted,
    fontSize: 12,
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
});

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
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

function nextStatus(status: string) {
  if (status === 'todo') return 'in-progress';
  if (status === 'in-progress') return 'on-hold';
  if (status === 'on-hold') return 'done';
  return 'todo';
}

export default function TasksScreen() {
  const [tasks, setTasks] = useState<UiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const grouped = useMemo(() => {
    return COLUMN_ORDER.map((column) => ({
      id: column,
      title: COLUMN_LABELS[column],
      color: STATUS_COLORS[column],
      tasks: tasks.filter((task) => task.status === column),
    }));
  }, [tasks]);

  const onCycleStatus = useCallback(
    async (task: UiTask) => {
      const targetStatus = nextStatus(task.status);
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

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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

              <Pressable style={styles.secondaryButton} onPress={() => onCycleStatus(task)}>
                <Text style={styles.secondaryButtonText}>
                  Move to {COLUMN_LABELS[nextStatus(task.status)]}
                </Text>
              </Pressable>
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
});

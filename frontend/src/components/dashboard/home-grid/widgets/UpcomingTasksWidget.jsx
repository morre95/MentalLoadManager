import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { formatRelativeDate } from "@/components/dashboard/home-grid/helpers";
import { EmptyState, WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";

export function UpcomingTasksWidget({ tasks, loading, error }) {
  const upcomingTasks = useMemo(() => {
    return [...tasks]
      .filter((task) => !["done", "archive", "on-hold"].includes(String(task?.status || "")) && task?.dueDateValue)
      .sort((left, right) => String(left.dueDateValue).localeCompare(String(right.dueDateValue)))
      .slice(0, 6);
  }, [tasks]);

  return (
    <WidgetShell
      title="Upcoming Tasks"
      description="What needs attention next."
      accent="h-9 w-9 rounded-2xl bg-status-todo/15"
    >
      {loading ? (
        <EmptyState message="Loading tasks..." />
      ) : error ? (
        <EmptyState message="Could not load upcoming tasks." />
      ) : upcomingTasks.length === 0 ? (
        <EmptyState message="No upcoming due dates." />
      ) : (
        <div className="space-y-2 overflow-y-auto">
          {upcomingTasks.map((task) => (
            <div key={task.id} className="rounded-2xl border border-border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {task.category || "Uncategorized"}
                    {task.assigneeLabel ? ` · ${task.assigneeLabel}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {formatRelativeDate(task.dueDateValue)}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </WidgetShell>
  );
}

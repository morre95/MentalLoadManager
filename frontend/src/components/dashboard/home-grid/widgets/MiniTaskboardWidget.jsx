import { useMemo } from "react";
import { GripVertical } from "lucide-react";
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { priorityStyles } from "@/components/dashboard/home-grid/helpers";
import { EmptyState, WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";
import { useMiniTaskboardDnd } from "@/components/dashboard/home-grid/widgets/miniTaskboard/useMiniTaskboardDnd";

function MiniTaskCard({ task }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className={isDragging ? "opacity-40" : ""}>
      <div className="rounded-xl border border-border bg-background p-2.5">
        <div className="flex items-start gap-2">
          <div
            {...attributes}
            {...listeners}
            className="mt-0.5 cursor-grab rounded-md p-1 text-muted-foreground/60 transition-colors hover:bg-muted active:cursor-grabbing"
            role="button"
            tabIndex={0}
            aria-label={`Move ${task.title}`}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xs font-medium text-foreground">{task.title}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] text-muted-foreground">
                {task.assigneeLabel || "Unassigned"}
              </span>
              {task.priority ? (
                <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${priorityStyles[String(task.priority).toLowerCase()] || priorityStyles.medium}`}>
                  {String(task.priority)}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniTaskOverlay({ task }) {
  if (!task) return null;

  return (
    <div className="w-52 rounded-xl border border-border bg-card p-2.5 shadow-xl ring-2 ring-primary/15">
      <p className="truncate text-xs font-medium text-foreground">{task.title}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[11px] text-muted-foreground">
          {task.assigneeLabel || "Unassigned"}
        </span>
        {task.priority ? (
          <span className={`rounded-full border px-1.5 py-0.5 text-[10px] ${priorityStyles[String(task.priority).toLowerCase()] || priorityStyles.medium}`}>
            {String(task.priority)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function MiniTaskColumn({ column, tasks }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className={`flex min-h-0 flex-col rounded-2xl bg-muted/25 p-3 transition-colors ${isOver ? "ring-2 ring-primary/25 bg-primary/5" : ""}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${column.tone}`} />
        <p className="text-xs font-medium text-foreground">{column.title}</p>
        <Badge variant="outline" className="ml-auto h-5 rounded-full px-1.5 text-[10px]">
          {tasks.length}
        </Badge>
      </div>

      <div ref={setNodeRef} className="min-h-[5.5rem] space-y-2 overflow-y-auto">
        <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-background/60 p-2 text-[11px] text-muted-foreground">
              Empty
            </div>
          ) : (
            tasks.map((task) => <MiniTaskCard key={task.id} task={task} />)
          )}
        </SortableContext>
      </div>
    </div>
  );
}

export function MiniTaskboardWidget({ tasks, setTasks, loading, error }) {
  const columns = useMemo(() => ([
    { id: "todo", title: "To Do", tone: "bg-status-todo" },
    { id: "in-progress", title: "Doing", tone: "bg-status-doing" },
    { id: "done", title: "Done", tone: "bg-status-done" },
  ]), []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const {
    activeTask,
    grouped,
    handleDragEnd,
    handleDragOver,
    handleDragStart,
    syncError,
  } = useMiniTaskboardDnd({ columns, tasks, setTasks });

  return (
    <WidgetShell
      title="Mini Taskboard"
      description="A compact task board with drag-and-drop moves."
      accent="h-9 w-9 rounded-2xl bg-primary/10"
    >
      {loading ? (
        <EmptyState message="Loading taskboard..." />
      ) : error ? (
        <EmptyState message="Could not load tasks." />
      ) : (
        <div className="flex h-full flex-col gap-3">
          {syncError ? (
            <p className="text-xs text-destructive">
              Couldn&apos;t sync the last task move. The board was restored.
            </p>
          ) : null}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div className="grid h-full grid-cols-1 gap-3 lg:grid-cols-3">
              {grouped.map((column) => (
                <MiniTaskColumn key={column.id} column={column} tasks={column.tasks} />
              ))}
            </div>
            <DragOverlay>
              <MiniTaskOverlay task={activeTask} />
            </DragOverlay>
          </DndContext>
        </div>
      )}
    </WidgetShell>
  );
}

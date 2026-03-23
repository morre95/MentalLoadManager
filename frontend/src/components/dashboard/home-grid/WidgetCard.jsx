import { motion } from "framer-motion";
import { EyeOff, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { sizeClasses } from "@/components/dashboard/home-grid/helpers";

export function WidgetShell({ title, description, accent, children }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border bg-card/95 p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {accent ? <div className={accent} /> : null}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}

export function EmptyState({ message }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function SortableWidget({ widget, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      className={`widget-card relative group ${sizeClasses[widget.size]} ${
        isDragging ? "widget-card-dragging opacity-50" : ""
      }`}
    >
      <div className="absolute right-3 top-3 z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          onClick={() => onRemove(widget.id)}
          className="rounded-lg bg-muted/90 p-1.5 text-muted-foreground transition-colors hover:text-destructive"
        >
          <EyeOff className="h-3.5 w-3.5" />
        </button>
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab rounded-lg bg-muted/90 p-1.5 active:cursor-grabbing"
          role="button"
          tabIndex={0}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      {widget.render()}
    </motion.div>
  );
}

export function WidgetOverlay({ widget }) {
  return (
    <div className={`widget-card widget-card-dragging ${sizeClasses[widget.size]}`}>
      {widget.render()}
    </div>
  );
}

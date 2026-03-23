import { motion } from "framer-motion";
import { EyeOff, GripVertical } from "lucide-react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { Badge } from "@/components/ui/badge";
import { sizeClasses } from "@/components/dashboard/home-grid/helpers";

export function WidgetShell({ title, description, accent, children, className = "", contentClassName = "" }) {
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-[1.35rem] border border-border bg-card/95 p-4 shadow-sm ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {accent ? <div className={accent} /> : null}
      </div>
      <div className={`min-h-0 flex-1 ${contentClassName}`}>{children}</div>
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

export function SortableWidget({ widget, onRemove, isEditing = false }) {
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
      } ${isEditing ? "before:pointer-events-none before:absolute before:inset-0 before:rounded-[1.45rem] before:border before:border-dashed before:border-primary/20 before:content-['']" : ""}`}
    >
      {isEditing ? (
        <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-2">
          <Badge variant="outline" className="border-border/60 bg-background/90 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Editable
          </Badge>
          <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-background/90 p-1">
            <button
              type="button"
              onClick={() => onRemove(widget.id)}
              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
              aria-label={`Hide ${widget.title}`}
            >
              <EyeOff className="h-3.5 w-3.5" />
            </button>
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted active:cursor-grabbing"
              role="button"
              tabIndex={0}
              aria-label={`Move ${widget.title}`}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          </div>
        </div>
      ) : null}
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

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { Eye, EyeOff, Plus, Repeat } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  readStoredWidgetIds,
  writeWidgetIds,
} from "@/components/dashboard/home-grid/helpers";
import { SortableWidget, WidgetOverlay } from "@/components/dashboard/home-grid/WidgetCard";
import { useDashboardHomeWidgets } from "@/components/dashboard/home-grid/useDashboardHomeWidgets";

export default function DashboardHomeGrid() {
  const storedWidgetIdsRef = useRef(readStoredWidgetIds());
  const hasHydratedLayoutRef = useRef(false);
  const { allWidgets, goalsLoading, analyticsLoading } = useDashboardHomeWidgets();
  const [activeWidgetIds, setActiveWidgetIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isManageOpen, setIsManageOpen] = useState(false);

  useEffect(() => {
    const catalogReady = !goalsLoading && !analyticsLoading;
    if (!catalogReady || allWidgets.length === 0 || hasHydratedLayoutRef.current) return;

    const availableIds = new Set(allWidgets.map((widget) => widget.id));
    const defaultIds = allWidgets.filter((widget) => widget.defaultVisible).map((widget) => widget.id);
    const storedIds = storedWidgetIdsRef.current;
    const baseIds = storedIds && storedIds.length > 0 ? storedIds : defaultIds;
    const filtered = baseIds.filter((id) => availableIds.has(id));
    const nextIds = filtered.length > 0 ? filtered : defaultIds.filter((id) => availableIds.has(id));

    queueMicrotask(() => {
      setActiveWidgetIds(nextIds);
    });
    hasHydratedLayoutRef.current = true;
  }, [allWidgets, analyticsLoading, goalsLoading]);

  useEffect(() => {
    if (!hasHydratedLayoutRef.current) return;
    writeWidgetIds(activeWidgetIds);
  }, [activeWidgetIds]);

  const activeWidgets = activeWidgetIds
    .map((id) => allWidgets.find((widget) => widget.id === id))
    .filter(Boolean);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    setActiveWidgetIds((items) => {
      const oldIndex = items.indexOf(String(active.id));
      const newIndex = items.indexOf(String(over.id));
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  const handleRemove = (id) => {
    setActiveWidgetIds((current) => current.filter((widgetId) => widgetId !== id));
  };

  const handleAdd = (id) => {
    setActiveWidgetIds((current) => (current.includes(id) ? current : [...current, id]));
  };

  const handleReset = () => {
    const defaultIds = allWidgets.filter((widget) => widget.defaultVisible).map((widget) => widget.id);
    setActiveWidgetIds(defaultIds);
  };

  const activeWidget = allWidgets.find((widget) => widget.id === activeId);

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Build your dashboard from live cards. Show only the widgets you actually want.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={handleReset}>
            <Repeat className="h-4 w-4" />
            Reset
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setIsManageOpen(true)}>
            <Plus className="h-4 w-4" />
            Manage widgets
          </Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={activeWidgetIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence>
              {activeWidgets.map((widget) => (
                <SortableWidget key={widget.id} widget={widget} onRemove={handleRemove} />
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        <DragOverlay>{activeWidget ? <WidgetOverlay widget={activeWidget} /> : null}</DragOverlay>
      </DndContext>

      <Dialog open={isManageOpen} onOpenChange={setIsManageOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Manage Dashboard Widgets</DialogTitle>
          </DialogHeader>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {allWidgets.map((widget) => {
              const isActive = activeWidgetIds.includes(widget.id);
              return (
                <div key={widget.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div className="min-w-0 pr-3">
                    <p className="truncate text-sm font-medium text-foreground">{widget.title}</p>
                    <p className="text-xs text-muted-foreground">{widget.description}</p>
                  </div>
                  <Button
                    variant={isActive ? "outline" : "default"}
                    size="sm"
                    className="gap-1.5 shrink-0"
                    onClick={() => (isActive ? handleRemove(widget.id) : handleAdd(widget.id))}
                  >
                    {isActive ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" />
                        Hide
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" />
                        Show
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

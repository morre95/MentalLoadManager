import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
import { Check, Eye, LayoutGrid, Plus, Repeat, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DASHBOARD_LAYOUT_PRESETS,
  getWidgetSizeLabel,
  inferWidgetCategory,
  readStoredWidgetIds,
  resolvePresetWidgetIds,
  writeWidgetIds,
} from "@/components/dashboard/home-grid/helpers";
import { SortableWidget, WidgetOverlay } from "@/components/dashboard/home-grid/WidgetCard";
import { useDashboardHomeWidgets } from "@/components/dashboard/home-grid/useDashboardHomeWidgets";

function getDefaultWidgetIds(allWidgets) {
  return allWidgets.filter((widget) => widget.defaultVisible).map((widget) => widget.id);
}

function HiddenWidgetCard({ widget, onAdd }) {
  return (
    <div className="rounded-[1.1rem] border border-border/70 bg-background/75 p-3 transition-colors hover:bg-background">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium text-foreground">{widget.title}</p>
            <Badge variant="outline" className="border-border/60 bg-muted/20 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {getWidgetSizeLabel(widget.size)}
            </Badge>
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{widget.description}</p>
        </div>
        <Button size="sm" variant="ghost" className="shrink-0 gap-1.5" onClick={() => onAdd(widget.id)}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Badge variant="outline" className="border-border/60 bg-background/80 text-muted-foreground">
          {inferWidgetCategory(widget)}
        </Badge>
      </div>
    </div>
  );
}

function PresetPreview({ preset }) {
  const columnsByPreset = {
    focus: [3, 2, 1],
    planner: [2, 3, 2],
    insights: [1, 2, 3],
  };

  const columns = columnsByPreset[preset.id] || [2, 2, 2];

  return (
    <div className="grid h-14 grid-cols-3 gap-1.5 rounded-2xl border border-border/60 bg-background/80 p-2">
      {columns.map((count, index) => (
        <div key={`${preset.id}-${index}`} className="flex flex-col gap-1">
          {Array.from({ length: count }).map((_, cellIndex) => (
            <div
              key={`${preset.id}-${index}-${cellIndex}`}
              className={`rounded-md bg-muted/70 ${
                cellIndex === 0 ? "h-4" : cellIndex === count - 1 ? "h-2.5" : "h-3"
              }`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function LayoutPresetCard({ preset, active, onApply }) {
  return (
    <button
      type="button"
      onClick={() => onApply(preset)}
      className={`w-full rounded-[1.2rem] border p-3.5 text-left transition-colors ${
        active
          ? "border-primary/35 bg-primary/5"
          : "border-border/70 bg-background/70 hover:border-primary/25 hover:bg-background"
      }`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{preset.label}</p>
              {active ? (
                <Badge className="gap-1 border-transparent bg-primary/12 text-primary hover:bg-primary/12">
                  <Check className="h-3 w-3" />
                  Active
                </Badge>
              ) : null}
            </div>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{preset.description}</p>
          </div>
          <Sparkles className={`mt-0.5 h-4 w-4 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <PresetPreview preset={preset} />
      </div>
    </button>
  );
}

function InlineInsertSlot({ open, hiddenWidgets, onToggle, onInsert }) {
  const quickPicks = hiddenWidgets.slice(0, 3);

  return (
    <div className="rounded-[1.15rem] border border-dashed border-border/70 bg-background/45 p-3 transition-colors hover:bg-background/70">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-center gap-2 rounded-xl px-3 py-5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <Plus className="h-4 w-4" />
        Add block here
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-xl border border-border/60 bg-background/90 p-2">
          <p className="px-2 pt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Quick insert
          </p>
          {quickPicks.map((widget) => (
            <button
              key={widget.id}
              type="button"
              onClick={() => onInsert(widget.id)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{widget.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{widget.description}</span>
              </span>
              <Badge variant="outline" className="border-border/60 bg-background/80 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {getWidgetSizeLabel(widget.size)}
              </Badge>
            </button>
          ))}
          {hiddenWidgets.length > 3 ? (
            <p className="px-2 pb-1 text-xs text-muted-foreground">
              More widgets are available in the library above.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function DashboardHomeGrid() {
  const storedWidgetIdsRef = useRef(readStoredWidgetIds());
  const hasHydratedLayoutRef = useRef(false);
  const { allWidgets, goalsLoading, analyticsLoading } = useDashboardHomeWidgets();
  const [activeWidgetIds, setActiveWidgetIds] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [activeInsertIndex, setActiveInsertIndex] = useState(null);

  useEffect(() => {
    const catalogReady = !goalsLoading && !analyticsLoading;
    if (!catalogReady || allWidgets.length === 0 || hasHydratedLayoutRef.current) return;

    const availableIds = new Set(allWidgets.map((widget) => widget.id));
    const defaultIds = getDefaultWidgetIds(allWidgets);
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

  const hiddenWidgets = useMemo(() => {
    return allWidgets.filter((widget) => !activeWidgetIds.includes(widget.id));
  }, [activeWidgetIds, allWidgets]);

  const groupedHiddenWidgets = useMemo(() => {
    return hiddenWidgets.reduce((acc, widget) => {
      const category = inferWidgetCategory(widget);
      acc[category] = [...(acc[category] || []), widget];
      return acc;
    }, {});
  }, [hiddenWidgets]);

  const activePresetId = useMemo(() => {
    for (const preset of DASHBOARD_LAYOUT_PRESETS) {
      const resolvedIds = resolvePresetWidgetIds(preset, allWidgets);
      if (
        resolvedIds.length === activeWidgetIds.length &&
        resolvedIds.every((id, index) => id === activeWidgetIds[index])
      ) {
        return preset.id;
      }
    }
    return null;
  }, [activeWidgetIds, allWidgets]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    if (!isEditing) return;
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event) => {
    setActiveId(null);

    if (!isEditing) return;

    const { active, over } = event;
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

  const handleInsertAt = (id, insertIndex) => {
    setActiveWidgetIds((current) => {
      if (current.includes(id)) return current;
      const next = [...current];
      next.splice(insertIndex, 0, id);
      return next;
    });
    setActiveInsertIndex(null);
  };

  const handleReset = () => {
    setActiveWidgetIds(getDefaultWidgetIds(allWidgets));
  };

  const handleApplyPreset = (preset) => {
    const nextIds = resolvePresetWidgetIds(preset, allWidgets);
    if (nextIds.length > 0) {
      setActiveWidgetIds(nextIds);
      setIsEditing(true);
      setActiveInsertIndex(null);
    }
  };

  const activeWidget = allWidgets.find((widget) => widget.id === activeId);

  return (
    <>
      <div className="mb-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-border/60 bg-background/70 text-muted-foreground">
                <LayoutGrid className="mr-1.5 h-3 w-3" />
                Dashboard
              </Badge>
              <Badge variant="outline" className="border-border/60 bg-background/70 text-muted-foreground">
                {activeWidgets.length} visible
              </Badge>
              <Badge variant="outline" className="border-border/60 bg-background/70 text-muted-foreground">
                {hiddenWidgets.length} in library
              </Badge>
            </div>
            <div>
              <p className="text-base font-medium text-foreground">
                Build the page you actually want to open every day.
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Drag cards to rearrange them. Start from a layout, then add blocks only when they earn their place.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={isEditing ? "default" : "ghost"}
              size="sm"
              className="gap-2"
              onClick={() => {
                setIsEditing((current) => {
                  const next = !current;
                  if (!next) setActiveInsertIndex(null);
                  return next;
                });
              }}
            >
              {isEditing ? <Check className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {isEditing ? "Done editing" : "Customize"}
            </Button>
            <Button variant="ghost" size="sm" className="gap-2" onClick={handleReset}>
              <Repeat className="h-4 w-4" />
              Reset layout
            </Button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {isEditing ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-5 space-y-5"
            >
              <Separator className="opacity-60" />

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Starter layouts</p>
                    <p className="text-xs text-muted-foreground">
                      A few clean starting points for different kinds of households.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 lg:grid-cols-3">
                  {DASHBOARD_LAYOUT_PRESETS.map((preset) => (
                    <LayoutPresetCard
                      key={preset.id}
                      preset={preset}
                      active={activePresetId === preset.id}
                      onApply={handleApplyPreset}
                    />
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Add widget</p>
                    <p className="text-xs text-muted-foreground">
                      Keep the page spare. Add from the library only when a block is genuinely useful.
                    </p>
                  </div>
                </div>

                {hiddenWidgets.length === 0 ? (
                  <div className="rounded-[1.2rem] border border-dashed border-border/70 bg-background/60 p-5 text-sm text-muted-foreground">
                    Every available widget is already on the page.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {Object.entries(groupedHiddenWidgets).map(([category, widgets]) => (
                      <div key={category} className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="border-border/60 bg-background/80 text-muted-foreground">
                            {category}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {widgets.length} available
                          </span>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {widgets.map((widget) => (
                            <HiddenWidgetCard key={widget.id} widget={widget} onAdd={handleAdd} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={activeWidgetIds} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {isEditing && hiddenWidgets.length > 0 ? (
              <InlineInsertSlot
                open={activeInsertIndex === 0}
                hiddenWidgets={hiddenWidgets}
                onToggle={() => setActiveInsertIndex((current) => (current === 0 ? null : 0))}
                onInsert={(id) => handleInsertAt(id, 0)}
              />
            ) : null}
            <AnimatePresence>
              {activeWidgets.map((widget, index) => (
                <Fragment key={widget.id}>
                  <SortableWidget
                    widget={widget}
                    onRemove={handleRemove}
                    isEditing={isEditing}
                  />
                  {isEditing && hiddenWidgets.length > 0 ? (
                    <InlineInsertSlot
                      open={activeInsertIndex === index + 1}
                      hiddenWidgets={hiddenWidgets}
                      onToggle={() =>
                        setActiveInsertIndex((current) => (current === index + 1 ? null : index + 1))
                      }
                      onInsert={(id) => handleInsertAt(id, index + 1)}
                    />
                  ) : null}
                </Fragment>
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>

        <DragOverlay>{isEditing && activeWidget ? <WidgetOverlay widget={activeWidget} /> : null}</DragOverlay>
      </DndContext>
    </>
  );
}

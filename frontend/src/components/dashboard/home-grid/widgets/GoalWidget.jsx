import { useMemo } from "react";

import GoalTrackerRenderer from "@/components/goals/GoalTrackerRenderer";
import { normalizeGoalForWidget } from "@/components/dashboard/home-grid/helpers";
import { WidgetShell } from "@/components/dashboard/home-grid/WidgetCard";

export function GoalWidget({ goal }) {
  const normalizedGoal = useMemo(() => normalizeGoalForWidget(goal), [goal]);
  const safeCurrent = Math.max(0, Number(goal?.current) || 0);
  const safeTarget = Math.max(1, Number(goal?.target) || 1);
  const progress = Math.min(100, Math.round((safeCurrent / safeTarget) * 100));

  return (
    <WidgetShell
      title={goal?.name || "Goal"}
      description={`${goal?.trackingStyle || "custom"} goal`}
      accent="h-9 w-9 rounded-2xl bg-sage-light"
    >
      <div className="flex h-full flex-col gap-4">
        <div className="flex min-h-[130px] items-center justify-center overflow-hidden rounded-[1.5rem] border border-border/70 bg-muted/15 px-2 py-3">
          <GoalTrackerRenderer goal={normalizedGoal} />
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-muted/15 p-3 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Now</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{safeCurrent}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Target</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{safeTarget}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Done</p>
            <p className="mt-1 text-sm font-semibold text-foreground">{progress}%</p>
          </div>
        </div>

        <div className="mt-auto">
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </WidgetShell>
  );
}

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import GoalTrackerRenderer from "./GoalTrackerRenderer";

const formatDateLabel = (value) => {
    if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
        return null;
    }

    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
    }).format(value);
};

const formatCompactNumber = (value) =>
    new Intl.NumberFormat(undefined, {
        notation: Math.abs(Number(value) || 0) >= 1000 ? "compact" : "standard",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

const getHistorySummary = (entry) => {
    const outcomeLabel = entry.completed ? "hit" : "missed";
    return `${entry.periodKey}: ${entry.current}/${entry.target} ${outcomeLabel}`;
};

const getProgressSteps = (goal) => {
    const safeTarget = Math.max(1, Number(goal?.target) || 1);
    const goalType = String(goal?.type || "");

    if (goalType === "savings" || goalType === "revenue") {
        if (safeTarget >= 10000) return [25, 100, 250, 500];
        if (safeTarget >= 2500) return [10, 50, 100, 250];
        if (safeTarget >= 500) return [5, 10, 25, 50];
        return [1, 5, 10, 25];
    }

    if (safeTarget >= 500) return [10, 25, 50, 100];
    if (safeTarget >= 100) return [5, 10, 25, 50];
    if (safeTarget >= 25) return [1, 2, 5, 10];
    if (safeTarget >= 10) return [1, 2, 3, 5];
    return [1];
};

const getDefaultStep = (goal) => {
    const steps = getProgressSteps(goal);
    return steps[Math.min(1, steps.length - 1)] || 1;
};

const CUSTOM_STEP = "__custom__";

const getLinkedAchievementLabel = (linkedAchievement) => {
    if (!linkedAchievement) {
        return null;
    }

    const isComplete = Boolean(
        linkedAchievement.current_milestone_complete ?? linkedAchievement.completed
    );
    if (isComplete) {
        return "Unlocked now";
    }

    if (linkedAchievement.has_unlocked_before) {
        if (linkedAchievement.last_unlocked_label) {
            return `Last unlocked at ${linkedAchievement.last_unlocked_label}`;
        }
        return "Previously unlocked";
    }

    return "Next achievement";
};

const GoalCard = ({
    goal,
    linkedAchievement,
    onUpdateProgress,
    onToggleTrainingDay,
    onDelete,
    isHighlighted = false,
}) => {
    const [isDetailsOpen, setIsDetailsOpen] = useState(Boolean(isHighlighted));
    const [selectedStep, setSelectedStep] = useState(() => getDefaultStep(goal));
    const [customAmount, setCustomAmount] = useState("");
    const shouldSpanTwoColumns =
        (goal.type === "reading" && Number(goal.target) > 69) ||
        (goal.type === "tasks" && Number(goal.target) > 20);
    const isTrainingGoal = goal.type === "training";
    const isAutoTrackedGoal = goal.type === "tasks";
    const historyEntries = Array.isArray(goal.history) ? goal.history.slice(0, 3) : [];
    const resetLabel = goal.isRecurring ? formatDateLabel(goal.periodEnd) : null;
    const safeCurrent = Math.max(0, Number(goal.current) || 0);
    const safeTarget = Math.max(1, Number(goal.target) || 1);
    const safePercentage = Math.min(Math.round((safeCurrent / safeTarget) * 100), 100);
    const remaining = Math.max(safeTarget - safeCurrent, 0);
    const progressSteps = useMemo(() => getProgressSteps(goal), [goal]);
    const isCustomStepSelected = selectedStep === CUSTOM_STEP;
    const parsedCustomAmount = Number(customAmount);
    const effectiveSelectedStep = !isCustomStepSelected && progressSteps.includes(selectedStep)
        ? selectedStep
        : isCustomStepSelected && Number.isFinite(parsedCustomAmount) && parsedCustomAmount > 0
        ? parsedCustomAmount
        : getDefaultStep(goal);
    const detailsOpen = isDetailsOpen || isHighlighted;

    const updateProgressByDelta = (delta) => {
        onUpdateProgress(goal.id, Math.max(0, safeCurrent + delta));
    };

    return (
        <motion.div
            id={`goal-card-${goal.id}`}
            className={cn("min-w-0", shouldSpanTwoColumns && "lg:col-span-2")}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
        >
            <Card
                className={cn(
                    "h-full min-w-0 overflow-hidden border-border bg-card/95 shadow-sm transition-all duration-300",
                    isHighlighted &&
                        "ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_18px_45px_-24px_hsl(var(--primary))]"
                )}
            >
                <CardContent className="min-w-0 max-w-full p-4">
                    <div className="flex justify-center overflow-hidden py-1">
                        <GoalTrackerRenderer goal={goal} onToggleTrainingDay={onToggleTrainingDay} />
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border border-border/70 bg-muted/20 p-3 text-center">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Progress</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                                {formatCompactNumber(safeCurrent)}/{formatCompactNumber(safeTarget)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">
                                {formatCompactNumber(remaining)}
                            </p>
                        </div>
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Status</p>
                            <p className="mt-1 text-sm font-semibold text-foreground">{safePercentage}%</p>
                        </div>
                    </div>

                    {!isTrainingGoal && !isAutoTrackedGoal ? (
                        <div className="mt-3 space-y-3 rounded-2xl border border-border/70 bg-card p-3">
                            <div className="flex flex-wrap gap-2">
                                {progressSteps.map((step) => (
                                    <Button
                                        key={step}
                                        variant={!isCustomStepSelected && effectiveSelectedStep === step ? "default" : "outline"}
                                        size="sm"
                                        className="rounded-full px-3"
                                        onClick={() => setSelectedStep(step)}
                                    >
                                        {step}
                                    </Button>
                                ))}
                                <Button
                                    variant={isCustomStepSelected ? "default" : "outline"}
                                    size="sm"
                                    className="rounded-full px-3"
                                    onClick={() => setSelectedStep(CUSTOM_STEP)}
                                >
                                    Custom
                                </Button>
                            </div>

                            {isCustomStepSelected ? (
                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                    <Input
                                        type="number"
                                        min="1"
                                        inputMode="numeric"
                                        value={customAmount}
                                        onChange={(event) => setCustomAmount(event.target.value)}
                                        placeholder="Custom amount"
                                        className="rounded-xl"
                                    />
                                    <Button
                                        variant="outline"
                                        className="rounded-xl px-3"
                                        onClick={() => setSelectedStep(getDefaultStep(goal))}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            ) : null}

                            <div className="grid grid-cols-2 items-center gap-2">
                                <Button
                                    variant="outline"
                                    className="h-11 rounded-xl px-3"
                                    onClick={() => updateProgressByDelta(effectiveSelectedStep * -1)}
                                    disabled={safeCurrent <= 0 || (isCustomStepSelected && (!Number.isFinite(parsedCustomAmount) || parsedCustomAmount <= 0))}
                                >
                                    <Minus className="h-4 w-4" />
                                    {effectiveSelectedStep}
                                </Button>
                                <Button
                                    className="h-11 rounded-xl px-3"
                                    onClick={() => updateProgressByDelta(effectiveSelectedStep)}
                                    disabled={isCustomStepSelected && (!Number.isFinite(parsedCustomAmount) || parsedCustomAmount <= 0)}
                                >
                                    <Plus className="h-4 w-4" />
                                    {effectiveSelectedStep}
                                </Button>
                            </div>
                        </div>
                    ) : null}

                    <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full px-3 text-muted-foreground"
                            onClick={() => setIsDetailsOpen((value) => !value)}
                        >
                            {detailsOpen ? "Hide details" : "Details"}
                            {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-full px-3 text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(goal.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                            Delete
                        </Button>
                    </div>

                    <AnimatePresence initial={false}>
                        {detailsOpen ? (
                            <motion.div
                                key="details"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-3 space-y-3 border-t border-border/60 pt-4">
                                    <div className="flex flex-wrap gap-2">
                                        <span className="rounded-full bg-muted px-3 py-1 text-xs capitalize text-muted-foreground">
                                            {goal.trackingStyle} tracking
                                        </span>
                                        {goal.isRecurring ? (
                                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                                                Recurring goal
                                            </span>
                                        ) : null}
                                    </div>

                                    {goal.isRecurring ? (
                                        <div className="grid grid-cols-3 gap-2 text-center">
                                            <div className="rounded-xl bg-muted/30 px-3 py-3">
                                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Streak</p>
                                                <p className="mt-1 text-sm font-semibold text-foreground">{goal.currentStreak}</p>
                                            </div>
                                            <div className="rounded-xl bg-muted/30 px-3 py-3">
                                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Best</p>
                                                <p className="mt-1 text-sm font-semibold text-foreground">{goal.bestStreak}</p>
                                            </div>
                                            <div className="rounded-xl bg-muted/30 px-3 py-3">
                                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Closed</p>
                                                <p className="mt-1 text-sm font-semibold text-foreground">{goal.completedPeriods}</p>
                                            </div>
                                        </div>
                                    ) : null}

                                    {goal.isRecurring ? (
                                        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                                            <p className="text-sm text-foreground">
                                                {safeCurrent >= safeTarget ? "This period is complete." : "This period is still in progress."}
                                            </p>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {resetLabel ? `Resets ${resetLabel}` : "Resets automatically next period"}
                                            </p>
                                        </div>
                                    ) : null}

                                    {linkedAchievement ? (
                                        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3">
                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Linked achievement</p>
                                            <div className="mt-2 flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-semibold text-foreground">{linkedAchievement.title}</p>
                                                    <p className="mt-1 text-xs text-muted-foreground">{linkedAchievement.description}</p>
                                                </div>
                                                <span className="rounded-full bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                                                    {getLinkedAchievementLabel(linkedAchievement)}
                                                </span>
                                            </div>
                                        </div>
                                    ) : null}

                                    {historyEntries.length ? (
                                        <div className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3">
                                            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent history</p>
                                            <div className="mt-2 space-y-2">
                                                {historyEntries.map((entry) => (
                                                    <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                                                        <span className="text-muted-foreground">{getHistorySummary(entry)}</span>
                                                        <span
                                                            className={cn(
                                                                "font-medium",
                                                                entry.completed ? "text-primary" : "text-muted-foreground"
                                                            )}
                                                        >
                                                            {entry.completed ? "Complete" : "Incomplete"}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default GoalCard;

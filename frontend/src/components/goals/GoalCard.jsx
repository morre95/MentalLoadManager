import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

const getHistorySummary = (entry) => {
    const outcomeLabel = entry.completed ? "hit" : "missed";
    return `${entry.periodKey}: ${entry.current}/${entry.target} ${outcomeLabel}`;
};

const GoalCard = ({
    goal,
    linkedAchievement,
    onUpdateProgress,
    onToggleTrainingDay,
    onDelete,
    isHighlighted = false,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const shouldSpanTwoColumns =
        (goal.type === "reading" && Number(goal.target) > 69) ||
        (goal.type === "tasks" && Number(goal.target) > 20);
    const isTrainingGoal = goal.type === "training";
    const isAutoTrackedGoal = goal.type === "tasks";
    const historyEntries = Array.isArray(goal.history) ? goal.history.slice(0, 3) : [];
    const resetLabel = goal.isRecurring ? formatDateLabel(goal.periodEnd) : null;

    const handleIncrement = () => {
        onUpdateProgress(goal.id, Math.min(goal.current + 1, goal.target * 2));
    };

    const handleDecrement = () => {
        onUpdateProgress(goal.id, Math.max(0, goal.current - 1));
    };

    return (
        <motion.div
            layout
            id={`goal-card-${goal.id}`}
            className={cn(shouldSpanTwoColumns && "lg:col-span-2")}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -4 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
        >
            <Card
                className={cn(
                    "border-border overflow-hidden h-full transition-all duration-500",
                    isHighlighted && "ring-2 ring-primary shadow-[0_0_0_1px_hsl(var(--primary)),0_18px_45px_-24px_hsl(var(--primary))]"
                )}
            >
                <CardContent className="p-6 relative">
                    <motion.div
                        className="absolute top-2 right-2 z-10"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isHovered ? 1 : 0 }}
                    >
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => onDelete(goal.id)}
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </motion.div>

                    <div className="flex justify-center py-4 w-full">
                        <GoalTrackerRenderer goal={goal} onToggleTrainingDay={onToggleTrainingDay} />
                    </div>

                    {!isTrainingGoal && !isAutoTrackedGoal && (
                        <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-border">
                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full"
                                onClick={handleDecrement}
                                disabled={goal.current <= 0}
                            >
                                <Minus className="h-4 w-4" />
                            </Button>

                            <div className="text-center min-w-[60px]">
                                <p className="text-sm text-muted-foreground">Progress</p>
                            </div>

                            <Button
                                variant="outline"
                                size="icon"
                                className="h-10 w-10 rounded-full"
                                onClick={handleIncrement}
                            >
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                    )}

                    <div className="flex justify-center mt-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground capitalize">
                            {goal.trackingStyle} tracking
                        </span>
                    </div>

                    <div className="mt-4 space-y-3">
                        {goal.isRecurring ? (
                            <div className="grid grid-cols-3 gap-2 text-center">
                                <div className="rounded-lg bg-muted/40 px-2 py-2">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Streak</p>
                                    <p className="text-sm font-semibold text-foreground">{goal.currentStreak}</p>
                                </div>
                                <div className="rounded-lg bg-muted/40 px-2 py-2">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Best</p>
                                    <p className="text-sm font-semibold text-foreground">{goal.bestStreak}</p>
                                </div>
                                <div className="rounded-lg bg-muted/40 px-2 py-2">
                                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Closed</p>
                                    <p className="text-sm font-semibold text-foreground">{goal.completedPeriods}</p>
                                </div>
                            </div>
                        ) : null}

                        {goal.isRecurring ? (
                            <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                                <p className="text-xs text-muted-foreground">
                                    {goal.current >= goal.target
                                        ? "This period is complete."
                                        : "This period is still in progress."}
                                </p>
                                <p className="text-xs font-medium text-foreground mt-1">
                                    {resetLabel ? `Resets ${resetLabel}` : "Resets automatically at the next period"}
                                </p>
                            </div>
                        ) : null}

                        {historyEntries.length ? (
                            <div className="rounded-lg border border-border/70 bg-card/70 px-3 py-3">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Recent history</p>
                                <div className="mt-2 space-y-1.5">
                                    {historyEntries.map((entry) => (
                                        <div key={entry.id} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="text-muted-foreground">{getHistorySummary(entry)}</span>
                                            <span className={cn("font-medium", entry.completed ? "text-primary" : "text-muted-foreground")}>
                                                {entry.completed ? "Complete" : "Incomplete"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : null}

                        {linkedAchievement ? (
                            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Linked achievement</p>
                                        <p className="text-sm font-medium text-foreground">{linkedAchievement.title}</p>
                                    </div>
                                    <span className="rounded-full bg-background px-2 py-1 text-[11px] font-medium capitalize text-muted-foreground">
                                        {linkedAchievement.rarity}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs text-muted-foreground">{linkedAchievement.description}</p>
                                <div className="mt-2 flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground">
                                        {linkedAchievement.current}/{linkedAchievement.target}
                                    </span>
                                    <span className={cn("font-medium", linkedAchievement.completed ? "text-primary" : "text-foreground")}>
                                        {linkedAchievement.completed ? "Unlocked" : "Next unlock"}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default GoalCard;

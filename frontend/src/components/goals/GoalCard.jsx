import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import GoalTrackerRenderer from "./GoalTrackerRenderer";

const GoalCard = ({
    goal,
    onUpdateProgress,
    onToggleTrainingDay,
    onDelete,
    onRunAICheckin,
    aiCheckin,
    aiLoading = false,
    isHighlighted = false,
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const shouldSpanTwoColumns =
        (goal.type === "reading" && Number(goal.target) > 69) ||
        (goal.type === "tasks" && Number(goal.target) > 20);
    const isTrainingGoal = goal.type === "training";
    const isAutoTrackedGoal = goal.type === "tasks";

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

                    <div className="mt-4 border-t border-border pt-4 space-y-3">
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => onRunAICheckin?.(goal.id)}
                            disabled={aiLoading}
                        >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {aiLoading ? "Checking in..." : "AI Check-in"}
                        </Button>

                        {aiCheckin ? (
                            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium text-foreground">{aiCheckin.status_summary}</p>
                                    <span className="text-xs capitalize text-muted-foreground">{aiCheckin.risk_level} risk</span>
                                </div>
                                <p className="text-muted-foreground">{aiCheckin.pace_needed}</p>
                                <p className="text-foreground"><span className="font-medium">Next:</span> {aiCheckin.next_step}</p>
                                <p className="text-muted-foreground"><span className="font-medium text-foreground">Adjust:</span> {aiCheckin.adjustment_suggestion}</p>
                                {(aiCheckin.evidence || []).length ? (
                                    <ul className="list-disc pl-4 text-muted-foreground space-y-1">
                                        {aiCheckin.evidence.map((item) => (
                                            <li key={item}>{item}</li>
                                        ))}
                                    </ul>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default GoalCard;

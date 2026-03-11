import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import GoalTrackerRenderer from "./GoalTrackerRenderer";

const GoalCard = ({ goal, onUpdateProgress, onToggleTrainingDay, onDelete }) => {
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
            className={cn(shouldSpanTwoColumns && "lg:col-span-2")}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            whileHover={{ y: -4 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
        >
            <Card className="border-border overflow-hidden h-full">
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
                </CardContent>
            </Card>
        </motion.div>
    );
};

export default GoalCard;

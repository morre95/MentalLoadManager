import { motion } from "framer-motion";
import { Check, Dumbbell } from "lucide-react";

const HabitGridTracker = ({ target, name, trainingDays, onToggleDay }) => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const todayIndex = (new Date().getDay() + 6) % 7;
    const safeTarget = Math.max(0, Math.min(7, Number(target) || 0));
    const normalizedDays =
        Array.isArray(trainingDays) && trainingDays.length === 7
            ? trainingDays.map(Boolean)
            : Array(7).fill(false);
    const completedCount = normalizedDays.filter(Boolean).length;

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="w-full max-w-sm">
                <div className="grid grid-cols-7 gap-2">
                    {days.map((day, i) => {
                        const isCompleted = normalizedDays[i];
                        const isToday = i === todayIndex;

                        return (
                            <motion.button
                                type="button"
                                key={day}
                                className="flex flex-col items-center gap-2"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                onClick={() => onToggleDay?.(i)}
                            >
                                <span
                                    className={`text-xs font-medium ${
                                        isToday ? "text-sky" : "text-muted-foreground"
                                    }`}
                                >
                                    {day}
                                </span>

                                <motion.div
                                    className={`relative flex h-16 w-full min-w-[42px] items-center justify-center rounded-2xl border transition-colors ${
                                        isCompleted
                                            ? "border-sage bg-sage text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--sage))]"
                                            : "border-border bg-muted/25 text-muted-foreground/60 hover:border-sky/50 hover:bg-sky-light/40 hover:text-sky"
                                    } ${isToday ? "ring-2 ring-sky/30 ring-offset-2 ring-offset-background" : ""}`}
                                    animate={isCompleted ? { y: [0, -2, 0], scale: [1, 1.03, 1] } : undefined}
                                    transition={isCompleted ? { delay: i * 0.04, duration: 0.35 } : undefined}
                                >
                                    {isCompleted ? (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                            className="flex flex-col items-center gap-1"
                                        >
                                            <Dumbbell className="h-4 w-4" />
                                            <Check className="h-3 w-3" />
                                        </motion.div>
                                    ) : (
                                        <Dumbbell className="h-4 w-4 opacity-70" />
                                    )}
                                </motion.div>
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            <div className="mt-4 text-center">
                <motion.p
                    className="text-2xl font-bold text-sage"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {completedCount}/{safeTarget}
                </motion.p>
                <p className="text-sm text-muted-foreground">workouts this week</p>

                {completedCount >= safeTarget && safeTarget > 0 && (
                    <motion.p
                        className="text-xs font-medium text-sage mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        Weekly goal achieved!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default HabitGridTracker;

import { motion } from "framer-motion";
import { Check } from "lucide-react";

const HabitGridTracker = ({ current, target, name }) => {
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="grid grid-cols-7 gap-2">
                {days.map((day, i) => {
                    const isCompleted = i < current;
                    const isTargetDay = i < target;

                    return (
                        <motion.div
                            key={day}
                            className="flex flex-col items-center gap-1"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.08 }}
                        >
                            <span className="text-xs text-muted-foreground">{day}</span>

                            <motion.div
                                className={`w-9 h-9 rounded-lg flex items-center justify-center border-2 cursor-pointer transition-colors ${isCompleted
                                        ? "bg-sage border-sage"
                                        : isTargetDay
                                            ? "border-sage/40 bg-sage-light hover:bg-sage/20"
                                            : "border-border bg-muted/30"
                                    }`}
                                whileHover={{ scale: 1.1 }}
                                whileTap={{ scale: 0.95 }}
                            >
                                {isCompleted && (
                                    <motion.div
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                                    >
                                        <Check className="h-4 w-4 text-primary-foreground" />
                                    </motion.div>
                                )}
                            </motion.div>
                        </motion.div>
                    );
                })}
            </div>

            <div className="mt-4 text-center">
                <motion.p
                    className="text-2xl font-bold text-sage"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {current}/{target}
                </motion.p>
                <p className="text-sm text-muted-foreground">workouts this week</p>

                {current >= target && (
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
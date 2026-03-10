import { motion } from "framer-motion";
import { Flag } from "lucide-react";

const WeightJourneyTracker = ({ current, target, name }) => {
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const percentage = Math.min((safeCurrent / safeTarget) * 100, 100);
    const remaining = Math.max(safeTarget - safeCurrent, 0);
    const isComplete = percentage >= 100;

    const getTickStep = (value) => {
        if (value <= 10) return 1;
        if (value <= 20) return 2;
        if (value <= 50) return 5;
        if (value <= 100) return 10;
        return 25;
    };

    const tickStep = getTickStep(safeTarget);
    const ticks = Array.from(
        { length: Math.floor(safeTarget / tickStep) + 1 },
        (_, i) => i * tickStep
    );

    if (ticks[ticks.length - 1] !== safeTarget) {
        ticks.push(safeTarget);
    }

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-full max-w-sm">
                <div className="relative h-20">
                    <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-muted" />
                    <motion.div
                        className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-terracotta to-sage"
                        initial={{ width: "0%" }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />

                    {ticks.map((tick) => {
                        const position = (tick / safeTarget) * 100;
                        const isComplete = safeCurrent >= tick;
                        return (
                            <div
                                key={tick}
                                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                                style={{ left: `${position}%` }}
                            >
                                <div
                                    className={`h-3 w-px rounded-full ${isComplete ? "bg-sage/50" : "bg-border/50"}`}
                                />
                                <span className="absolute top-5 left-1/2 -translate-x-1/2 text-[10px] font-medium text-muted-foreground/80 whitespace-nowrap">
                                    {tick}
                                </span>
                            </div>
                        );
                    })}

                    <div className="absolute left-0 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-border bg-card" />

                    <motion.div
                        className="absolute z-10"
                        initial={{ left: "0%" }}
                        animate={{ left: `${percentage}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        style={{ transform: "translate(-50%, -50%)", top: "50%" }}
                    >
                        <motion.div
                            animate={
                                isComplete
                                    ? { y: [0, -4, 0], rotate: [0, -12, 12, -8, 8, 0], scale: [1, 1.08, 1] }
                                    : { y: [0, -5, 0] }
                            }
                            transition={
                                isComplete
                                    ? { repeat: Infinity, duration: 0.9 }
                                    : { repeat: Infinity, duration: 0.5 }
                            }
                            className="text-xl leading-none"
                        >
                            {isComplete ? "💃" : "🏃‍➡️"}
                        </motion.div>
                    </motion.div>

                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-6">
                        <Flag
                            className={`h-6 w-6 ${percentage >= 100 ? "fill-sage text-sage" : "fill-none text-muted-foreground"}`}
                        />
                    </div>
                </div>
            </div>

            <div className="mt-6 text-center">
                <motion.p
                    className="text-2xl font-bold text-terracotta"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {safeCurrent} kg lost
                </motion.p>
                <p className="text-sm text-muted-foreground">Goal: {safeTarget} kg</p>
                {isComplete ? (
                    <motion.p
                        className="text-xs font-medium text-sage mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        🏁✨ Goal reached!
                    </motion.p>
                ) : (
                    <p className="text-xs font-medium text-foreground mt-1">
                        {remaining} kg to go!
                    </p>
                )}
            </div>
        </div>
    );
};

export default WeightJourneyTracker;

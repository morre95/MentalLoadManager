import { motion } from "framer-motion";
import { Flame } from "lucide-react";

const StreakFlameTracker = ({ current, target, name }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const intensity = Math.ceil(percentage / 20);

    const flameColors = [
        "from-terracotta/50 to-status-todo/30",
        "from-terracotta/70 to-status-todo/50",
        "from-terracotta to-status-todo/70",
        "from-terracotta to-status-todo",
        "from-terracotta via-status-todo to-[hsl(50,90%,60%)]",
    ];

    return (
        <div className="flex flex-col items-center">
            <h4 className="mb-4 text-center text-base font-semibold tracking-tight text-foreground">{name}</h4>

            <div className="relative">
                <motion.div
                    className="absolute inset-0 blur-xl rounded-full"
                    style={{
                        background: `radial-gradient(circle, hsl(var(--terracotta)) 0%, transparent 70%)`,
                    }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
                    transition={{ repeat: Infinity, duration: 2 }}
                />

                <div className="relative w-24 h-32">
                    <motion.div
                        className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-20 rounded-full bg-gradient-to-t ${flameColors[Math.min(intensity, 5) - 1]
                            }`}
                        animate={{
                            height: [70 + intensity * 8, 80 + intensity * 8, 70 + intensity * 8],
                            width: [60 + intensity * 4, 70 + intensity * 4, 60 + intensity * 4],
                        }}
                        transition={{ repeat: Infinity, duration: 0.5 }}
                        style={{ borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%" }}
                    />

                    <motion.div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-14 bg-gradient-to-t from-status-todo to-[hsl(50,90%,60%)]"
                        animate={{ height: [50 + intensity * 6, 60 + intensity * 6, 50 + intensity * 6] }}
                        transition={{ repeat: Infinity, duration: 0.4, delay: 0.1 }}
                        style={{ borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%" }}
                    />

                    <motion.div
                        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 bg-gradient-to-t from-[hsl(50,90%,60%)] to-[hsl(60,95%,85%)]"
                        animate={{ height: [30 + intensity * 4, 40 + intensity * 4, 30 + intensity * 4] }}
                        transition={{ repeat: Infinity, duration: 0.3, delay: 0.2 }}
                        style={{ borderRadius: "50% 50% 50% 50% / 60% 60% 40% 40%" }}
                    />

                    {intensity >= 3 &&
                        [...Array(3)].map((_, i) => (
                            <motion.div
                                key={i}
                                className="absolute w-1 h-1 bg-status-todo rounded-full"
                                style={{ bottom: "50%", left: `${30 + i * 20}%` }}
                                animate={{ y: [-20, -50], x: [0, (i - 1) * 10], opacity: [1, 0] }}
                                transition={{ repeat: Infinity, duration: 1, delay: i * 0.3 }}
                            />
                        ))}
                </div>
            </div>

            <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-1">
                    <Flame className="h-5 w-5 text-terracotta" />
                    <motion.p
                        className="text-2xl font-bold text-terracotta"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        {current} days
                    </motion.p>
                </div>
                <p className="text-sm text-muted-foreground">streak</p>
                {percentage >= 100 && (
                    <motion.p
                        className="text-xs font-medium text-terracotta mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        🔥✨ On fire!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default StreakFlameTracker;

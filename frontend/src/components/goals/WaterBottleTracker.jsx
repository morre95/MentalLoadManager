import { motion } from "framer-motion";
import { Droplet } from "lucide-react";

const WaterBottleTracker = ({ current, target, name }) => {
    const percentage = Math.min((current / target) * 100, 100);

    const segments = Array.from({ length: target }, (_, i) => i < current);

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-20 h-44">
                <svg viewBox="0 0 60 130" className="w-full h-full">
                    <rect x="20" y="0" width="20" height="10" rx="2" className="fill-sky" />

                    <path
                        d="M22 10 L22 20 Q15 25, 15 30 L15 30 L45 30 Q45 25, 38 20 L38 10 Z"
                        className="fill-sky-light stroke-sky"
                        strokeWidth="1"
                    />

                    <rect
                        x="10"
                        y="30"
                        width="40"
                        height="90"
                        rx="5"
                        className="fill-card stroke-border"
                        strokeWidth="2"
                    />

                    {Array.from({ length: target - 1 }).map((_, i) => {
                        const segmentHeight = 88 / target;
                        const y = 120 - (i + 1) * segmentHeight;
                        return (
                            <line
                                key={i}
                                x1="12"
                                y1={y}
                                x2="48"
                                y2={y}
                                className="stroke-border/30"
                                strokeWidth="0.5"
                                strokeDasharray="2 2"
                            />
                        );
                    })}

                    <motion.rect
                        x="12"
                        y={120 - percentage * 0.88}
                        width="36"
                        height={percentage * 0.88}
                        rx="3"
                        className="fill-sky"
                        initial={{ height: 0, y: 120 }}
                        animate={{ height: percentage * 0.88, y: 120 - percentage * 0.88 }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        opacity="0.7"
                    />

                    {current > 0 && (
                        <motion.circle
                            cx="25"
                            cy={115 - percentage * 0.4}
                            r="2"
                            className="fill-sky-light"
                            animate={{ y: [0, -10, 0], opacity: [0.3, 0.8, 0.3] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                        />
                    )}
                    {current > Math.floor(target / 2) && (
                        <motion.circle
                            cx="35"
                            cy={105 - percentage * 0.3}
                            r="1.5"
                            className="fill-sky-light"
                            animate={{ y: [0, -8, 0], opacity: [0.3, 0.8, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
                        />
                    )}

                    {Array.from({ length: target }).map((_, i) => {
                        const segmentHeight = 88 / target;
                        const y = 120 - (i + 1) * segmentHeight;
                        return (
                            <g key={`label-${i}`}>
                                <line
                                    x1="10"
                                    y1={y + segmentHeight / 2}
                                    x2="14"
                                    y2={y + segmentHeight / 2}
                                    className="stroke-border"
                                    strokeWidth="1"
                                />
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="mt-2 text-center">
                <div className="flex items-center justify-center gap-1">
                    <Droplet className="h-5 w-5 text-sky" />
                    <motion.p
                        className="text-2xl font-bold text-sky"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        {current}/{target}
                    </motion.p>
                </div>
                <p className="text-sm text-muted-foreground">glasses today</p>
                {percentage >= 100 && (
                    <motion.p
                        className="text-xs font-medium text-sky mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        💧✨ Fully hydrated!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default WaterBottleTracker;
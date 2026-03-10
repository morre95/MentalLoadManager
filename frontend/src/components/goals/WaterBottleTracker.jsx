import { motion } from "framer-motion";
import { Droplet } from "lucide-react";

const WaterBottleTracker = ({ current, target, name }) => {
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const guideCount = 10;

    const percentage = Math.min((safeCurrent / safeTarget) * 100, 100);
    const fillRatio = Math.min(safeCurrent / safeTarget, 1);

    const bottleX = 10;
    const bottleY = 30;
    const bottleWidth = 40;
    const bottleHeight = 90;
    const bottleRadius = 5;

    const innerX = bottleX;
    const innerY = bottleY;
    const innerWidth = bottleWidth;
    const innerHeight = bottleHeight;
    const fillHeight = innerHeight * fillRatio;
    const fillY = innerY + innerHeight - fillHeight;
    const guideValues = Array.from({ length: guideCount }, (_, i) => (i + 1) / guideCount);

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
                        x={bottleX}
                        y={bottleY}
                        width={bottleWidth}
                        height={bottleHeight}
                        rx={bottleRadius}
                        className="fill-card"
                    />

                    {guideValues.map((value) => {
                        const y = innerY + innerHeight - innerHeight * value;
                        return (
                            <line
                                key={`guide-${value}`}
                                x1={innerX}
                                y1={y}
                                x2={innerX + innerWidth}
                                y2={y}
                                className="stroke-border/30"
                                strokeWidth="0.5"
                                strokeDasharray="2 2"
                            />
                        );
                    })}

                    <rect
                        x={innerX}
                        y={fillY}
                        width={innerWidth}
                        height={fillHeight}
                        className="fill-sky"
                        opacity="0.85"
                        rx={bottleRadius}
                    />

                    <rect
                        x={bottleX}
                        y={bottleY}
                        width={bottleWidth}
                        height={bottleHeight}
                        rx={bottleRadius}
                        fill="none"
                        className="stroke-border"
                        strokeWidth="2"
                    />

                    {safeCurrent > 0 && fillHeight > 6 && (
                        <motion.circle
                            cx="25"
                            cy={Math.max(innerY + 6, fillY + 4)}
                            r="2"
                            className="fill-sky-light"
                            animate={{ y: [0, -10, 0], opacity: [0.3, 0.8, 0.3] }}
                            transition={{ repeat: Infinity, duration: 3 }}
                        />
                    )}
                    {safeCurrent > Math.floor(safeTarget / 2) && fillHeight > 10 && (
                        <motion.circle
                            cx="35"
                            cy={Math.max(innerY + 8, fillY + 10)}
                            r="1.5"
                            className="fill-sky-light"
                            animate={{ y: [0, -8, 0], opacity: [0.3, 0.8, 0.3] }}
                            transition={{ repeat: Infinity, duration: 2.5, delay: 0.5 }}
                        />
                    )}

                    {guideValues.map((value) => {
                        const y = innerY + innerHeight - innerHeight * value;
                        return (
                            <g key={`label-${value}`}>
                                <line
                                    x1="10"
                                    y1={y}
                                    x2="14"
                                    y2={y}
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
                        {safeCurrent}/{safeTarget}
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

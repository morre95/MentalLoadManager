import { motion } from "framer-motion";

const PETAL_COLORS = [
    "fill-lavender",
    "fill-terracotta",
    "fill-sky",
    "fill-primary",
    "fill-accent",
    "fill-status-todo",
];

const CENTER_COLORS = [
    "fill-terracotta",
    "fill-sky",
    "fill-primary",
    "fill-accent",
    "fill-status-todo",
    "fill-sand",
];

const getFlowerPalette = (seed) => {
    const petalColor = PETAL_COLORS[seed % PETAL_COLORS.length];
    const centerOffset = 1 + ((seed * 3) % (CENTER_COLORS.length - 1));
    const centerColor = CENTER_COLORS[(seed + centerOffset) % CENTER_COLORS.length];

    return {
        petalColor,
        centerColor,
    };
};

const renderBlossom = (
    x,
    y,
    scale = 1,
    petalColorClass = "fill-lavender",
    centerColorClass = "fill-terracotta"
) => (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
        {Array.from({ length: 8 }).map((_, index) => {
            const angle = index * 45;
            return (
                <ellipse
                    key={angle}
                    cx="0"
                    cy="-9"
                    rx="4.8"
                    ry="9"
                    className={petalColorClass}
                    transform={`rotate(${angle} 0 0)`}
                />
            );
        })}
        <circle cx="0" cy="0" r="5.2" className={centerColorClass} />
    </g>
);

const renderGrass = (width, y) => (
    <g>
        <rect x="0" y={y} width={width} height="12" rx="4" className="fill-sage/20" />
        {Array.from({ length: Math.max(10, Math.floor(width / 14)) }).map((_, index) => {
            const x = 8 + index * ((width - 16) / Math.max(1, Math.floor(width / 14) - 1));
            return (
                <path
                    key={index}
                    d={`M${x} ${y + 10} Q${x - 2} ${y + 2}, ${x - 4} ${y + 9} M${x} ${y + 10} Q${x + 1} ${y + 1}, ${x + 3} ${y + 8}`}
                    className="stroke-sage"
                    strokeWidth="1.2"
                    fill="none"
                    strokeLinecap="round"
                />
            );
        })}
    </g>
);

const PlantGrowthTracker = ({ current, target, name }) => {
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const isSingleFlowerMode = safeTarget <= 9;
    const isWideField = safeTarget > 20;

    const renderSingleFlower = () => {
        const completedSteps = Math.min(safeCurrent, safeTarget);
        const progressRatio = safeTarget > 0 ? completedSteps / safeTarget : 0;
        const stemTopY = 88 - progressRatio * 52;
        const blossomScale = 1.7;
        const leafSteps = Math.max(safeTarget - 1, 0);
        const leafCount = Math.min(completedSteps, Math.max(0, safeTarget - 1));

        return (
            <svg viewBox="0 0 100 130" className="w-full h-full">
                <path
                    d="M20 90 L25 120 Q25 125, 30 125 L70 125 Q75 125, 75 120 L80 90 Z"
                    className="fill-terracotta"
                />
                <rect x="15" y="85" width="70" height="8" rx="2" className="fill-terracotta" />
                <ellipse cx="50" cy="90" rx="30" ry="6" className="fill-[hsl(20,30%,25%)]" />

                {completedSteps > 0 && (
                    <motion.path
                        d={`M50 88 Q50 ${Math.max(stemTopY + 10, 42)}, 50 ${stemTopY}`}
                        className="stroke-sage"
                        strokeWidth="4"
                        fill="none"
                        strokeLinecap="round"
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.45 }}
                    />
                )}

                {Array.from({ length: leafCount }).map((_, index) => {
                    const totalLeaves = Math.max(1, leafSteps);
                    const y = 82 - ((index + 1) / (totalLeaves + 1)) * 44;
                    const isLeft = index % 2 === 0;
                    const leafX = isLeft ? 42 : 58;
                    const angle = isLeft ? -35 : 35;
                    const rx = safeTarget >= 8 ? 7 : 8;
                    const ry = safeTarget >= 8 ? 3.6 : 4.2;

                    return (
                        <motion.ellipse
                            key={index}
                            cx={leafX}
                            cy={y}
                            rx={rx}
                            ry={ry}
                            className="fill-sage"
                            transform={`rotate(${angle} ${leafX} ${y})`}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.05, duration: 0.2 }}
                        />
                    );
                })}

                {completedSteps >= safeTarget && (
                    <motion.g
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        {(() => {
                            const { petalColor, centerColor } = getFlowerPalette(safeTarget);
                            return renderBlossom(
                                50,
                                Math.max(stemTopY - 4, 24),
                                blossomScale,
                                petalColor,
                                centerColor
                            );
                        })()}
                    </motion.g>
                )}
            </svg>
        );
    };

    const renderFlowerField = () => {
        const spacing = isWideField ? 16 : 18;
        const padding = 12;
        const svgWidth = safeTarget * spacing + padding * 2;
        const grassY = 96;
        const stemBaseY = 96;

        return (
            <svg viewBox={`0 0 ${svgWidth} 130`} className="w-full h-full">
                {renderGrass(svgWidth, grassY)}
                {Array.from({ length: safeTarget }).map((_, index) => {
                    const x = padding + spacing / 2 + index * spacing;
                    const isComplete = index < safeCurrent;
                    const { petalColor, centerColor } = getFlowerPalette(index + safeTarget);

                    return (
                        <g key={index}>
                            {isComplete ? (
                                <>
                                    <motion.path
                                        d={`M${x} ${stemBaseY} Q${x - 1.5} 78, ${x} 60`}
                                        className="stroke-sage"
                                        strokeWidth="2.2"
                                        fill="none"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: 1 }}
                                        transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
                                    />
                                    <ellipse
                                        cx={x - 4}
                                        cy="78"
                                        rx="4"
                                        ry="2.5"
                                        className="fill-sage"
                                        transform={`rotate(-35 ${x - 4} 78)`}
                                    />
                                    <ellipse
                                        cx={x + 4}
                                        cy="72"
                                        rx="4"
                                        ry="2.5"
                                        className="fill-sage"
                                        transform={`rotate(35 ${x + 4} 72)`}
                                    />
                                    {renderBlossom(x, 55, 0.95, petalColor, centerColor)}
                                </>
                            ) : (
                                <path
                                    d={`M${x} ${stemBaseY} Q${x - 1} 88, ${x - 3} 92 M${x} ${stemBaseY} Q${x + 1} 88, ${x + 3} 92`}
                                    className="stroke-sage/45"
                                    strokeWidth="1.4"
                                    fill="none"
                                    strokeLinecap="round"
                                />
                            )}
                        </g>
                    );
                })}
            </svg>
        );
    };

    return (
        <div className="flex flex-col items-center">
            <h4 className="mb-4 text-center text-base font-semibold tracking-tight text-foreground">{name}</h4>

            <div className={`relative ${isSingleFlowerMode ? "w-32 h-40" : isWideField ? "w-full max-w-2xl h-32" : "w-full max-w-md h-32"}`}>
                {isSingleFlowerMode ? renderSingleFlower() : renderFlowerField()}
            </div>

            <div className="mt-2 text-center">
                <motion.p
                    className="text-2xl font-bold text-sage"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {safeCurrent}/{safeTarget}
                </motion.p>
                <p className="text-sm text-muted-foreground">tasks completed</p>
                {safeCurrent >= safeTarget && (
                    <motion.p
                        className="text-xs font-medium text-sage mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        🌸✨ In full bloom!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default PlantGrowthTracker;

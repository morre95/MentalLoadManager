import { motion } from "framer-motion";
import { useId, useMemo } from "react";

const SavingsJarTracker = ({ current, target, name }) => {
    const clipPathId = `jar-clip-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const fillRatio = Math.min(safeCurrent / safeTarget, 1);
    const percentage = fillRatio * 100;
    const isComplete = percentage >= 100;

    const coinLayout = useMemo(() => {
        const rows = [
            { y: 118, centerX: 50, spread: 33, count: 8 },
            { y: 112, centerX: 50, spread: 31, count: 8 },
            { y: 106, centerX: 50, spread: 34, count: 9 },
            { y: 100, centerX: 50, spread: 32, count: 8 },
            { y: 94, centerX: 50, spread: 34, count: 9 },
            { y: 88, centerX: 50, spread: 31, count: 8 },
            { y: 82, centerX: 50, spread: 33, count: 8 },
            { y: 76, centerX: 50, spread: 29, count: 7 },
            { y: 70, centerX: 50, spread: 26, count: 7 },
            { y: 64, centerX: 50, spread: 21, count: 6 },
            { y: 58, centerX: 50, spread: 18, count: 5 },
            { y: 52, centerX: 50, spread: 15, count: 4 },
            { y: 44, centerX: 50, spread: 11, count: 3 },
            { y: 36, centerX: 50, spread: 8, count: 3 },
            { y: 30, centerX: 50, spread: 6, count: 2 },
            { y: 28, centerX: 50, spread: 4, count: 2 },
        ];

        return rows.flatMap((row, rowIndex) => {
            return Array.from({ length: row.count }, (_, coinIndex) => {
                const normalizedPosition =
                    row.count === 1 ? 0 : (coinIndex / (row.count - 1)) * 2 - 1;
                const clusterPull = 1 - Math.abs(normalizedPosition) * 0.15;
                const x = row.centerX + normalizedPosition * row.spread * clusterPull;
                const variant = (rowIndex * 3 + coinIndex) % 4;
                const horizontalJitter = ((rowIndex * 11 + coinIndex * 7) % 9) - 4;
                const verticalJitter = ((rowIndex * 5 + coinIndex * 3) % 5) - 2;
                const tilt = ((rowIndex * 13 + coinIndex * 17) % 9) - 4;
                return {
                    cx: x + horizontalJitter,
                    cy: row.y + verticalJitter,
                    rx: variant === 0 ? 7.6 : variant === 1 ? 7 : variant === 2 ? 6.6 : 7.2,
                    ry: variant === 0 ? 3.5 : variant === 1 ? 3.3 : variant === 2 ? 3.1 : 3.4,
                    tilt,
                    rowY: row.y,
                    delay: Math.min(rowIndex * 0.04 + coinIndex * 0.01, 0.55),
                };
            });
        });
    }, []);

    const completionCoins = coinLayout.filter((coin) => coin.rowY <= 32);
    const baseCoins = coinLayout.filter((coin) => coin.rowY > 32);
    const visibleCoinCount = Math.max(0, Math.round(fillRatio * baseCoins.length));
    const visibleCoins = baseCoins.slice(0, visibleCoinCount);

    return (
        <div className="flex flex-col items-center">
            <h4 className="mb-4 text-center text-base font-semibold tracking-tight text-foreground">{name}</h4>

            <motion.div
                className="relative w-32 h-40"
                animate={isComplete ? { y: [0, -6, 0], scale: [1, 1.03, 1] } : undefined}
                transition={isComplete ? { duration: 0.6, ease: "easeOut" } : undefined}
            >
                <svg viewBox="0 0 100 130" className="w-full h-full">
                    <rect
                        x="25"
                        y="0"
                        width="50"
                        height="12"
                        rx="3"
                        className="fill-muted stroke-border"
                        strokeWidth="2"
                    />
                    <rect
                        x="20"
                        y="10"
                        width="60"
                        height="8"
                        rx="2"
                        className="fill-muted stroke-border"
                        strokeWidth="2"
                    />

                    <path
                        d="M15 20 Q15 25, 10 35 L10 115 Q10 125, 25 125 L75 125 Q90 125, 90 115 L90 35 Q85 25, 85 20 Z"
                        className="fill-card stroke-border"
                        strokeWidth="2"
                    />

                    <defs>
                        <clipPath id={clipPathId}>
                            <path d="M15 20 Q15 25, 12 35 L12 115 Q12 123, 25 123 L75 123 Q88 123, 88 115 L88 35 Q85 25, 85 20 Z" />
                        </clipPath>
                    </defs>

                    <g clipPath={`url(#${clipPathId})`}>
                        {visibleCoins.map((coin, index) => (
                            <motion.g
                                key={`coin-${index}`}
                                initial={{ opacity: 0, scale: 0.8, y: -28, rotate: coin.tilt - 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0, rotate: coin.tilt }}
                                transition={{
                                    delay: 0.1 + coin.delay,
                                    duration: 0.45,
                                    type: "spring",
                                    stiffness: 260,
                                    damping: 18,
                                }}
                            >
                                <ellipse
                                    cx={coin.cx}
                                    cy={coin.cy}
                                    rx={coin.rx}
                                ry={coin.ry}
                                className="fill-status-todo"
                                transform={`rotate(${coin.tilt} ${coin.cx} ${coin.cy})`}
                            />
                                <ellipse
                                    cx={coin.cx}
                                    cy={coin.cy - 0.6}
                                    rx={Math.max(coin.rx - 2, 3.2)}
                                    ry={Math.max(coin.ry - 1.5, 1.1)}
                                    className="fill-[hsl(45,95%,72%)]"
                                    opacity="0.55"
                                    transform={`rotate(${coin.tilt} ${coin.cx} ${coin.cy - 0.6})`}
                                />
                            </motion.g>
                        ))}
                        {isComplete &&
                            completionCoins.map((coin, index) => (
                                <motion.g
                                    key={`completion-coin-${index}`}
                                    initial={{ opacity: 0, scale: 0.8, y: -24, rotate: coin.tilt - 12 }}
                                    animate={{ opacity: 1, scale: 1, y: 0, rotate: coin.tilt }}
                                    transition={{
                                        delay: 0.3 + index * 0.025,
                                        duration: 0.42,
                                        type: "spring",
                                        stiffness: 250,
                                        damping: 18,
                                    }}
                                >
                                    <ellipse
                                        cx={coin.cx}
                                        cy={coin.cy}
                                        rx={coin.rx}
                                        ry={coin.ry}
                                        className="fill-status-todo"
                                        transform={`rotate(${coin.tilt} ${coin.cx} ${coin.cy})`}
                                    />
                                    <ellipse
                                        cx={coin.cx}
                                        cy={coin.cy - 0.6}
                                        rx={Math.max(coin.rx - 2, 3.2)}
                                        ry={Math.max(coin.ry - 1.5, 1.1)}
                                        className="fill-[hsl(45,95%,72%)]"
                                        opacity="0.55"
                                        transform={`rotate(${coin.tilt} ${coin.cx} ${coin.cy - 0.6})`}
                                    />
                                </motion.g>
                            ))}
                        {isComplete && (
                            <motion.rect
                                x="-18"
                                y="18"
                                width="28"
                                height="118"
                                fill="rgba(255,255,255,0.28)"
                                opacity="0"
                                transform="rotate(-12 0 0)"
                                animate={{ x: [-18, 104], opacity: [0, 0.75, 0] }}
                                transition={{ delay: 0.55, duration: 0.85, ease: "easeInOut" }}
                            />
                        )}
                    </g>

                    {isComplete && (
                        <motion.g
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1 }}
                        >
                            {[{ x: 20, y: 10 }, { x: 80, y: 15 }, { x: 50, y: 5 }].map(
                                (spark, i) => (
                                    <motion.text
                                        key={i}
                                        x={spark.x}
                                        y={spark.y}
                                        fontSize="10"
                                        textAnchor="middle"
                                        animate={{
                                            y: [spark.y, spark.y - 8, spark.y],
                                            opacity: [0.5, 1, 0.5],
                                        }}
                                        transition={{ repeat: Infinity, duration: 2, delay: i * 0.3 }}
                                    >
                                        ✨
                                    </motion.text>
                                )
                            )}
                        </motion.g>
                    )}
                </svg>
            </motion.div>

            <div className="mt-4 text-center">
                <motion.p
                    className="text-2xl font-bold text-sage"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    ${safeCurrent.toLocaleString()}
                </motion.p>
                <p className="text-sm text-muted-foreground">of ${safeTarget.toLocaleString()}</p>
                <p className="text-xs font-medium text-foreground mt-1">
                    {percentage.toFixed(0)}% saved
                </p>
                {isComplete && (
                    <motion.p
                        className="text-xs font-medium text-sage mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        🎉✨ Goal reached!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default SavingsJarTracker;

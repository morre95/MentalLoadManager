import { motion } from "framer-motion";

const SavingsJarTracker = ({ current, target, name }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const isComplete = percentage >= 100;

    const coinLayers = [
        {
            threshold: 5,
            coins: [
                { cx: 35, cy: 118, rx: 8, ry: 4 },
                { cx: 55, cy: 120, rx: 7, ry: 3 },
                { cx: 70, cy: 116, rx: 6, ry: 3 },
            ],
        },
        {
            threshold: 20,
            coins: [
                { cx: 30, cy: 108, rx: 7, ry: 3 },
                { cx: 50, cy: 112, rx: 8, ry: 4 },
                { cx: 68, cy: 106, rx: 6, ry: 3 },
            ],
        },
        {
            threshold: 35,
            coins: [
                { cx: 38, cy: 96, rx: 7, ry: 3 },
                { cx: 60, cy: 100, rx: 6, ry: 3 },
            ],
        },
        {
            threshold: 50,
            coins: [
                { cx: 32, cy: 86, rx: 6, ry: 3 },
                { cx: 52, cy: 88, rx: 7, ry: 3 },
                { cx: 72, cy: 84, rx: 5, ry: 3 },
            ],
        },
        {
            threshold: 65,
            coins: [
                { cx: 40, cy: 74, rx: 6, ry: 3 },
                { cx: 60, cy: 76, rx: 5, ry: 3 },
            ],
        },
        {
            threshold: 80,
            coins: [
                { cx: 35, cy: 62, rx: 6, ry: 3 },
                { cx: 55, cy: 66, rx: 7, ry: 3 },
            ],
        },
        { threshold: 90, coins: [{ cx: 45, cy: 52, rx: 6, ry: 3 }] },
    ];

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-32 h-40">
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
                        <clipPath id="jarClip">
                            <path d="M15 20 Q15 25, 12 35 L12 115 Q12 123, 25 123 L75 123 Q88 123, 88 115 L88 35 Q85 25, 85 20 Z" />
                        </clipPath>
                    </defs>

                    <motion.rect
                        x="10"
                        width="80"
                        rx="0"
                        fill="hsl(var(--sage))"
                        clipPath="url(#jarClip)"
                        opacity="0.8"
                        initial={{ y: 125, height: 0 }}
                        animate={{ y: 125 - percentage * 1.05, height: percentage * 1.05 }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />

                    {coinLayers.map(
                        (layer, layerIdx) =>
                            percentage > layer.threshold && (
                                <motion.g
                                    key={layerIdx}
                                    initial={{ opacity: 0, scale: 0 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: 0.3 + layerIdx * 0.15 }}
                                >
                                    {layer.coins.map((coin, coinIdx) => (
                                        <ellipse
                                            key={coinIdx}
                                            cx={coin.cx}
                                            cy={coin.cy}
                                            rx={coin.rx}
                                            ry={coin.ry}
                                            className="fill-status-todo"
                                        />
                                    ))}
                                </motion.g>
                            )
                    )}

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
            </div>

            <div className="mt-4 text-center">
                <motion.p
                    className="text-2xl font-bold text-sage"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    ${current.toLocaleString()}
                </motion.p>
                <p className="text-sm text-muted-foreground">of ${target.toLocaleString()}</p>
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
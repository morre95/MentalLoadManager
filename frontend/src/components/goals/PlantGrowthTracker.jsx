import { motion } from "framer-motion";

const PlantGrowthTracker = ({ current, target, name }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const growthStage = Math.floor(percentage / 20);

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-32 h-40">
                <svg viewBox="0 0 100 130" className="w-full h-full">
                    <path
                        d="M20 90 L25 120 Q25 125, 30 125 L70 125 Q75 125, 75 120 L80 90 Z"
                        className="fill-terracotta"
                    />
                    <rect x="15" y="85" width="70" height="8" rx="2" className="fill-terracotta" />

                    <ellipse cx="50" cy="90" rx="30" ry="6" className="fill-[hsl(20,30%,25%)]" />

                    {growthStage >= 1 && (
                        <motion.path
                            d={`M50 88 Q50 ${88 - growthStage * 12}, 50 ${88 - growthStage * 15}`}
                            className="stroke-sage"
                            strokeWidth="4"
                            fill="none"
                            strokeLinecap="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1 }}
                        />
                    )}

                    {growthStage >= 2 && (
                        <motion.g
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                        >
                            <ellipse
                                cx="40"
                                cy="70"
                                rx="12"
                                ry="6"
                                className="fill-sage"
                                transform="rotate(-30 40 70)"
                            />
                            <ellipse
                                cx="60"
                                cy="70"
                                rx="12"
                                ry="6"
                                className="fill-sage"
                                transform="rotate(30 60 70)"
                            />
                        </motion.g>
                    )}

                    {growthStage >= 3 && (
                        <motion.g
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.5 }}
                        >
                            <ellipse
                                cx="35"
                                cy="55"
                                rx="10"
                                ry="5"
                                className="fill-sage"
                                transform="rotate(-40 35 55)"
                            />
                            <ellipse
                                cx="65"
                                cy="55"
                                rx="10"
                                ry="5"
                                className="fill-sage"
                                transform="rotate(40 65 55)"
                            />
                        </motion.g>
                    )}

                    {growthStage >= 4 && (
                        <motion.g
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.7 }}
                        >
                            <ellipse
                                cx="38"
                                cy="40"
                                rx="8"
                                ry="4"
                                className="fill-sage"
                                transform="rotate(-35 38 40)"
                            />
                            <ellipse
                                cx="62"
                                cy="40"
                                rx="8"
                                ry="4"
                                className="fill-sage"
                                transform="rotate(35 62 40)"
                            />
                        </motion.g>
                    )}

                    {growthStage >= 5 && (
                        <motion.g
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 10, delay: 0.9 }}
                        >
                            <circle cx="50" cy="20" r="8" className="fill-terracotta" />
                            <circle cx="42" cy="15" r="6" className="fill-lavender" />
                            <circle cx="58" cy="15" r="6" className="fill-lavender" />
                            <circle cx="42" cy="25" r="6" className="fill-lavender" />
                            <circle cx="58" cy="25" r="6" className="fill-lavender" />
                            <circle cx="50" cy="20" r="4" className="fill-status-todo" />
                        </motion.g>
                    )}
                </svg>
            </div>

            <div className="mt-2 text-center">
                <motion.p
                    className="text-2xl font-bold text-sage"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {current}/{target}
                </motion.p>
                <p className="text-sm text-muted-foreground">tasks completed</p>
                {percentage >= 100 && (
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
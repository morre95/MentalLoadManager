import { motion } from "framer-motion";
import { Flag } from "lucide-react";

const WeightJourneyTracker = ({ current, target, name }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const steps = Array.from({ length: target }, (_, i) => i + 1);

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-full max-w-xs">
                <div className="relative h-16 flex items-center">
                    <div className="absolute inset-x-0 top-1/2 h-2 bg-muted rounded-full" />
                    <motion.div
                        className="absolute left-0 top-1/2 h-2 bg-gradient-to-r from-terracotta to-sage rounded-full"
                        initial={{ width: "0%" }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />

                    {steps.map((step, i) => (
                        <motion.div
                            key={step}
                            className={`absolute w-4 h-4 rounded-full border-2 ${current >= step ? "bg-sage border-sage" : "bg-card border-border"
                                }`}
                            style={{
                                left: `${((i + 1) / target) * 100}%`,
                                transform: "translateX(-50%)",
                            }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: i * 0.1 }}
                        />
                    ))}

                    <motion.div
                        className="absolute z-10"
                        initial={{ left: "0%" }}
                        animate={{ left: `${percentage}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        style={{ transform: "translateX(-50%)" }}
                    >
                        <motion.div
                            animate={{ y: [0, -5, 0] }}
                            transition={{ repeat: Infinity, duration: 0.5 }}
                            className="text-2xl"
                        >
                            🏃
                        </motion.div>
                    </motion.div>

                    <div className="absolute right-0 -top-2 transform translate-x-1/2">
                        <Flag
                            className={`h-6 w-6 ${percentage >= 100 ? "text-sage" : "text-muted-foreground"
                                }`}
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
                    {current} kg lost
                </motion.p>
                <p className="text-sm text-muted-foreground">Goal: {target} kg</p>
                {percentage >= 100 ? (
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
                        {target - current} kg to go!
                    </p>
                )}
            </div>
        </div>
    );
};

export default WeightJourneyTracker;
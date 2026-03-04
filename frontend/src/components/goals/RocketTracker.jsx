import React from "react";
import { motion } from "framer-motion";
import { Rocket } from "lucide-react";

const STAR_COUNT = 15;

function createStars() {
    return Array.from({ length: STAR_COUNT }, () => ({
        top: `${Math.random() * 70}%`,
        left: `${Math.random() * 100}%`,
        duration: 1 + Math.random() * 2,
        delay: Math.random(),
    }));
}

const RocketTracker = ({ current, target, name }) => {
    const percentage = Math.min((current / target) * 100, 100);

    // ✅ Random values generated once per mount (pure render)
    const stars = React.useMemo(() => createStars(), []);

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-32 h-48">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-b from-[hsl(240,30%,15%)] via-[hsl(260,40%,25%)] to-terracotta/30" />

                {stars.map((s, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-white rounded-full"
                        style={{ top: s.top, left: s.left }}
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{
                            repeat: Infinity,
                            duration: s.duration,
                            delay: s.delay,
                        }}
                    />
                ))}

                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-3 bg-muted rounded" />

                <motion.div
                    className="absolute left-1/2 -translate-x-1/2"
                    initial={{ bottom: "10%" }}
                    animate={{ bottom: `${10 + percentage * 0.7}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                >
                    <motion.div
                        className="absolute -bottom-6 left-1/2 -translate-x-1/2"
                        animate={{ scaleY: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
                        transition={{ repeat: Infinity, duration: 0.2 }}
                    >
                        <div className="w-4 h-8 bg-gradient-to-t from-terracotta via-status-todo to-transparent rounded-b-full" />
                    </motion.div>

                    <motion.div
                        animate={{ y: [0, -2, 0] }}
                        transition={{ repeat: Infinity, duration: 0.3 }}
                    >
                        <Rocket className="h-10 w-10 text-lavender rotate-0" />
                    </motion.div>
                </motion.div>

                <div className="absolute right-2 top-4 bottom-8 w-2 bg-muted/30 rounded-full overflow-hidden">
                    <motion.div
                        className="absolute bottom-0 w-full bg-gradient-to-t from-terracotta to-sage rounded-full"
                        initial={{ height: "0%" }}
                        animate={{ height: `${percentage}%` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                </div>
            </div>

            <div className="mt-2 text-center">
                <motion.p
                    className="text-2xl font-bold text-terracotta"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    ${current.toLocaleString()}
                </motion.p>
                <p className="text-sm text-muted-foreground">
                    of ${target.toLocaleString()} revenue
                </p>

                {percentage >= 100 && (
                    <motion.p
                        className="text-xs font-medium text-sage mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        🚀✨ Launch successful!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default RocketTracker;
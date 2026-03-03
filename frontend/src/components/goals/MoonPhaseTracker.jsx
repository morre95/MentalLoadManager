import { motion } from "framer-motion";

const MoonPhaseTracker = ({ current, target, name }) => {
    const percentage = Math.min((current / target) * 100, 100);
    const phase = Math.floor(percentage / 12.5);

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative">
                <motion.div
                    className="w-24 h-24 rounded-full relative overflow-hidden"
                    style={{
                        background:
                            "linear-gradient(135deg, hsl(var(--lavender-light)) 0%, hsl(var(--muted)) 100%)",
                    }}
                    animate={{
                        boxShadow:
                            phase > 4 ? `0 0 ${phase * 5}px hsl(var(--lavender))` : "none",
                    }}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-lavender/20 to-transparent" />

                    <motion.div
                        className="absolute inset-0 bg-foreground/90"
                        initial={{ clipPath: "inset(0 0% 0 0)" }}
                        animate={{ clipPath: `inset(0 ${percentage}% 0 0)` }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                    />

                    <motion.div
                        className="absolute w-4 h-4 rounded-full bg-lavender/30"
                        style={{ top: "20%", left: "30%" }}
                        animate={{ opacity: percentage > 30 ? 1 : 0 }}
                    />
                    <motion.div
                        className="absolute w-3 h-3 rounded-full bg-lavender/20"
                        style={{ top: "50%", left: "60%" }}
                        animate={{ opacity: percentage > 50 ? 1 : 0 }}
                    />
                    <motion.div
                        className="absolute w-2 h-2 rounded-full bg-lavender/25"
                        style={{ top: "70%", left: "40%" }}
                        animate={{ opacity: percentage > 70 ? 1 : 0 }}
                    />
                </motion.div>

                {[...Array(8)].map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute w-1 h-1 bg-lavender rounded-full"
                        style={{
                            top: `${50 + Math.cos((i * Math.PI) / 4) * 60}%`,
                            left: `${50 + Math.sin((i * Math.PI) / 4) * 60}%`,
                        }}
                        animate={{
                            opacity: [0.3, 1, 0.3],
                            scale: [0.8, 1.2, 0.8],
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 2,
                            delay: i * 0.2,
                        }}
                    />
                ))}
            </div>

            <div className="mt-4 text-center">
                <motion.p
                    className="text-2xl font-bold text-lavender"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {current} days
                </motion.p>
                <p className="text-sm text-muted-foreground">meditation streak</p>
                {percentage >= 100 && (
                    <motion.p
                        className="text-xs font-medium text-lavender mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        🌕✨ Full moon achieved!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default MoonPhaseTracker;
import { motion } from "framer-motion";
import { Zap } from "lucide-react";

const SkillTreeTracker = ({ current, target, name }) => {
    const nodes = target;
    const completed = Math.min(current, nodes);

    const generatePositions = (count) => {
        const positions = [];
        let level = 0;
        const maxY = 95;
        const minY = 10;

        const levels = [];
        let r = count;
        while (r > 0) {
            const nodesInLevel = Math.min(r, level === 0 ? 1 : Math.min(level + 1, 4));
            levels.push(nodesInLevel);
            r -= nodesInLevel;
            level++;
        }

        const totalLevels = levels.length;
        const ySpacing = totalLevels > 1 ? (maxY - minY) / (totalLevels - 1) : 0;

        levels.forEach((nodesInLevel, levelIdx) => {
            const y = maxY - levelIdx * ySpacing;
            const xSpacing = nodesInLevel > 1 ? 70 / (nodesInLevel - 1) : 0;
            const startX = nodesInLevel > 1 ? 15 : 50;

            for (let i = 0; i < nodesInLevel; i++) {
                positions.push({ x: startX + i * xSpacing, y });
            }
        });

        return positions;
    };

    const positions = generatePositions(nodes);

    const connections = [];
    const levels = [];
    let lvl = 0;
    let r = nodes;

    while (r > 0) {
        const n = Math.min(r, lvl === 0 ? 1 : Math.min(lvl + 1, 4));
        levels.push(n);
        r -= n;
        lvl++;
    }

    let prevStart = 0;
    for (let l = 1; l < levels.length; l++) {
        const prevCount = levels[l - 1];
        const currStart = prevStart + prevCount;
        const currCount = levels[l];

        for (let i = 0; i < currCount; i++) {
            const parentIdx = prevStart + Math.min(i, prevCount - 1);
            connections.push([parentIdx, currStart + i]);
        }
        prevStart = currStart;
    }

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-36 h-36">
                <svg viewBox="0 0 100 100" className="w-full h-full">
                    {connections.map(([from, to], i) => {
                        if (from >= positions.length || to >= positions.length) return null;
                        const fromPos = positions[from];
                        const toPos = positions[to];
                        const isActive = completed > from && completed > to;

                        return (
                            <motion.line
                                key={i}
                                x1={fromPos.x}
                                y1={fromPos.y}
                                x2={toPos.x}
                                y2={toPos.y}
                                className={isActive ? "stroke-sage" : "stroke-border"}
                                strokeWidth="2"
                                initial={{ pathLength: 0 }}
                                animate={{ pathLength: 1 }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                            />
                        );
                    })}

                    {positions.map((pos, i) => {
                        const isCompleted = i < completed;
                        return (
                            <motion.g key={i}>
                                <motion.circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r="7"
                                    className={isCompleted ? "fill-sage" : "fill-muted stroke-border"}
                                    strokeWidth="2"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ delay: i * 0.05, type: "spring" }}
                                />
                                {isCompleted && (
                                    <motion.circle
                                        cx={pos.x}
                                        cy={pos.y}
                                        r="10"
                                        fill="none"
                                        className="stroke-sage"
                                        strokeWidth="1"
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1.5, opacity: 0 }}
                                        transition={{
                                            delay: i * 0.05,
                                            duration: 1,
                                            repeat: Infinity,
                                            repeatDelay: 3,
                                        }}
                                    />
                                )}
                            </motion.g>
                        );
                    })}
                </svg>
            </div>

            <div className="mt-2 text-center">
                <div className="flex items-center justify-center gap-1">
                    <Zap className="h-5 w-5 text-sage" />
                    <motion.p
                        className="text-2xl font-bold text-sage"
                        initial={{ scale: 0.8 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 }}
                    >
                        {current}/{target}
                    </motion.p>
                </div>
                <p className="text-sm text-muted-foreground">lessons completed</p>
                {current >= target && (
                    <motion.p
                        className="text-xs font-medium text-sage mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        ⚡✨ Skill mastered!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default SkillTreeTracker;
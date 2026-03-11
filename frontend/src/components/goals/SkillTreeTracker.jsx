import { motion } from "framer-motion";
import { Zap } from "lucide-react";

const SkillTreeTracker = ({ current, target, name }) => {
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const displayMode = safeTarget <= 9 ? "lesson" : safeTarget <= 40 ? "module" : "milestone";
    const nodes =
        displayMode === "lesson"
            ? safeTarget
            : displayMode === "module"
              ? Math.min(12, Math.max(7, Math.ceil(safeTarget / 4)))
              : Math.min(10, Math.max(7, safeTarget));
    const displayedProgress = Math.min((safeCurrent / safeTarget) * nodes, nodes);
    const unitsPerNode = safeTarget / nodes;
    const roundedUnitsPerNode = Math.max(1, Math.round(unitsPerNode));
    const completed = Math.min(Math.floor(displayedProgress), nodes);
    const partialProgress =
        completed < nodes ? displayedProgress - completed : 0;

    const buildLevels = (count) => {
        const levels = [];
        let level = 0;
        let remaining = count;

        while (remaining > 0) {
            const nodesInLevel = Math.min(remaining, level === 0 ? 1 : Math.min(level + 1, 4));
            levels.push(nodesInLevel);
            remaining -= nodesInLevel;
            level++;
        }

        return levels;
    };

    const generatePositions = (levels) => {
        const positions = [];
        const maxY = 88;
        const minY = 8;

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

    const levels = buildLevels(nodes);
    const positions = generatePositions(levels);
    const itemLabel =
        displayMode === "lesson"
            ? safeTarget === 1
                ? "lesson"
                : "lessons"
            : displayMode === "module"
              ? "lessons per module"
              : "lessons per milestone";

    const connections = [];

    let prevStart = 0;
    for (let l = 1; l < levels.length; l++) {
        const prevCount = levels[l - 1];
        const currStart = prevStart + prevCount;
        const currCount = levels[l];

        for (let i = 0; i < currCount; i++) {
            const parentSlot =
                currCount === 1
                    ? (prevCount - 1) / 2
                    : (i * (prevCount - 1)) / (currCount - 1);
            const parentIdx = prevStart + Math.round(parentSlot);
            connections.push([parentIdx, currStart + i]);
        }
        prevStart = currStart;
    }

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-36 h-40">
                <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
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
                        const isPartial = i === completed && partialProgress > 0 && completed < nodes;
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
                                {isPartial && (
                                    <motion.circle
                                        cx={pos.x}
                                        cy={pos.y}
                                        r="7"
                                        fill="none"
                                        className="stroke-sage"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        initial={{ pathLength: 0 }}
                                        animate={{ pathLength: partialProgress }}
                                        transition={{ delay: i * 0.05, duration: 0.35 }}
                                        style={{
                                            rotate: -90,
                                            transformOrigin: `${pos.x}px ${pos.y}px`,
                                        }}
                                    />
                                )}
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
                        {safeCurrent}/{safeTarget}
                    </motion.p>
                </div>
                <p className="text-sm text-muted-foreground">
                    {displayMode === "lesson"
                        ? "lessons completed"
                        : `${roundedUnitsPerNode} ${itemLabel}`}
                </p>
                {safeCurrent >= safeTarget && (
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

import { motion } from "framer-motion";
import { useMemo } from "react";

const BookshelfTracker = ({ current, target, name }) => {
    const colors = ["fill-sage", "fill-terracotta", "fill-lavender", "fill-sky", "fill-status-todo"];
    const booksToShow = Math.min(current, target);

    const booksPerShelf = target <= 12 ? target : Math.ceil(target / Math.ceil(target / 12));
    const numShelves = Math.ceil(target / booksPerShelf);
    const shelfHeight = 70;
    const svgHeight = numShelves * shelfHeight + 20;
    const svgWidth = Math.max(160, booksPerShelf * 12 + 20);

    const bookHeights = useMemo(
        () => Array.from({ length: target }, (_, i) => 40 + ((i * 7 + 13) % 20)),
        [target]
    );

    return (
        <div className="flex flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div
                className="relative"
                style={{ width: Math.min(svgWidth, 240), height: Math.min(svgHeight, 250) }}
            >
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
                    {Array.from({ length: numShelves }).map((_, shelfIndex) => {
                        const shelfY = (shelfIndex + 1) * shelfHeight;
                        const startBook = shelfIndex * booksPerShelf;
                        const endBook = Math.min(startBook + booksPerShelf, target);

                        return (
                            <g key={shelfIndex}>
                                <rect
                                    x="5"
                                    y={shelfY - 5}
                                    width={svgWidth - 10}
                                    height="8"
                                    rx="2"
                                    className="fill-sand"
                                />
                                <rect
                                    x="5"
                                    y={shelfY}
                                    width={svgWidth - 10}
                                    height="5"
                                    className="fill-[hsl(35,30%,75%)]"
                                />

                                {Array.from({ length: endBook - startBook }).map((_, i) => {
                                    const bookIndex = startBook + i;
                                    const x = 10 + i * 12;
                                    const isRead = bookIndex < booksToShow;
                                    const height = bookHeights[bookIndex];

                                    return (
                                        <motion.g key={bookIndex}>
                                            {isRead ? (
                                                <motion.rect
                                                    x={x}
                                                    y={shelfY - 5 - height}
                                                    width="10"
                                                    height={height}
                                                    rx="1"
                                                    className={colors[bookIndex % colors.length]}
                                                    initial={{ scaleY: 0 }}
                                                    animate={{ scaleY: 1 }}
                                                    transition={{ delay: bookIndex * 0.05, duration: 0.4 }}
                                                    style={{ transformOrigin: `${x + 5}px ${shelfY - 5}px` }}
                                                />
                                            ) : (
                                                <rect
                                                    x={x}
                                                    y={shelfY - 5 - 45}
                                                    width="10"
                                                    height="45"
                                                    rx="1"
                                                    className="fill-muted/30 stroke-border"
                                                    strokeWidth="1"
                                                    strokeDasharray="3 3"
                                                />
                                            )}
                                        </motion.g>
                                    );
                                })}
                            </g>
                        );
                    })}
                </svg>
            </div>

            <div className="mt-2 text-center">
                <motion.p
                    className="text-2xl font-bold text-lavender"
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    {current}/{target}
                </motion.p>
                <p className="text-sm text-muted-foreground">books read</p>
                {current >= target && (
                    <motion.p
                        className="text-xs font-medium text-lavender mt-1"
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: [0, 1.3, 1] }}
                        transition={{ type: "spring" }}
                    >
                        📚✨ Reading goal complete!
                    </motion.p>
                )}
            </div>
        </div>
    );
};

export default BookshelfTracker;
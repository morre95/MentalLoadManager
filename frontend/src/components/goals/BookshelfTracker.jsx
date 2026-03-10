import { motion } from "framer-motion";
import { useMemo } from "react";

const BookshelfTracker = ({ current, target, name }) => {
    const colors = ["fill-sage", "fill-terracotta", "fill-lavender", "fill-sky", "fill-status-todo"];
    const safeTarget = Math.max(1, Number(target) || 1);
    const safeCurrent = Math.max(0, Number(current) || 0);
    const booksToShow = Math.min(safeCurrent, safeTarget);
    const isWideLayout = safeTarget > 69;
    const trackerWidth = isWideLayout ? 640 : 320;
    const innerWidth = trackerWidth - 20;

    const bookWidth = safeTarget >= 1000 ? 3 : safeTarget >= 500 ? 4 : safeTarget >= 241 ? 6 : safeTarget >= 101 ? 8 : 10;
    const bookGap = safeTarget >= 500 ? 1 : 2;
    const shelfPadding = 10;
    const booksPerShelf = Math.min(
        safeTarget,
        Math.max(isWideLayout ? 18 : 10, Math.floor((innerWidth - shelfPadding * 2) / (bookWidth + bookGap)))
    );
    const numShelves = Math.ceil(safeTarget / booksPerShelf);
    const shelfHeight = safeTarget >= 1000 ? 30 : safeTarget >= 500 ? 36 : safeTarget >= 241 ? 46 : safeTarget >= 101 ? 60 : 70;
    const emptyBookHeight = Math.max(18, shelfHeight - 22);
    const svgHeight = numShelves * shelfHeight + 20;
    const svgWidth = Math.max(160, booksPerShelf * (bookWidth + bookGap) + shelfPadding * 2);

    const bookHeights = useMemo(
        () =>
            Array.from({ length: safeTarget }, (_, i) => {
                const minHeight = Math.max(16, shelfHeight - 26);
                const variation = Math.max(6, Math.round(shelfHeight * 0.3));
                return minHeight + ((i * 7 + 13) % variation);
            }),
        [safeTarget, shelfHeight]
    );

    const bookColors = useMemo(
        () => {
            let seed = safeTarget * 214013 + 2531011;
            let previousIndex = -1;

            const nextRandom = () => {
                seed = (seed * 1664525 + 1013904223) % 4294967296;
                return seed / 4294967296;
            };

            return Array.from({ length: safeTarget }, (_, index) => {
                if (colors.length === 1) {
                    return colors[0];
                }

                let randomIndex = Math.floor(nextRandom() * colors.length);

                if (randomIndex === previousIndex) {
                    randomIndex = (randomIndex + 1 + (index % (colors.length - 1))) % colors.length;
                }

                previousIndex = randomIndex;
                return colors[randomIndex];
            });
        },
        [safeTarget]
    );

    return (
        <div className="flex w-full flex-col items-center">
            <h4 className="font-medium text-foreground mb-4 text-center">{name}</h4>

            <div className="relative w-full">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="block w-full h-auto">
                    {Array.from({ length: numShelves }).map((_, shelfIndex) => {
                        const shelfY = (shelfIndex + 1) * shelfHeight;
                        const startBook = shelfIndex * booksPerShelf;
                        const endBook = Math.min(startBook + booksPerShelf, safeTarget);

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
                                    const x = shelfPadding + i * (bookWidth + bookGap);
                                    const isRead = bookIndex < booksToShow;
                                    const height = bookHeights[bookIndex];

                                    return (
                                        <motion.g key={bookIndex}>
                                            {isRead ? (
                                                <motion.rect
                                                    x={x}
                                                    y={shelfY - 5 - height}
                                                    width={bookWidth}
                                                    height={height}
                                                    rx="1"
                                                    className={bookColors[bookIndex]}
                                                    initial={{ scaleY: 0 }}
                                                    animate={{ scaleY: 1 }}
                                                    transition={{ delay: Math.min(bookIndex * 0.01, 0.5), duration: 0.25 }}
                                                    style={{ transformOrigin: `${x + bookWidth / 2}px ${shelfY - 5}px` }}
                                                />
                                            ) : (
                                                <rect
                                                    x={x}
                                                    y={shelfY - 5 - emptyBookHeight}
                                                    width={bookWidth}
                                                    height={emptyBookHeight}
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
                    {safeCurrent}/{safeTarget}
                </motion.p>
                <p className="text-sm text-muted-foreground">books read</p>
                {safeCurrent >= safeTarget && (
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

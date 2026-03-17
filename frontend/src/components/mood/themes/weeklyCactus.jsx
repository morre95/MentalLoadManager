import { renderInteractiveShape } from "./helpers";

const REGION_SHAPES = [
    "M44 28 C34 28 28 36 28 48 C28 58 34 66 44 68 L44 28 Z",
    "M44 28 C54 28 60 36 60 48 C60 58 54 66 44 68 L44 28 Z",
    "M44 68 C34 66 28 74 28 86 C28 98 34 108 44 110 L44 68 Z",
    "M44 68 C54 66 60 74 60 86 C60 98 54 108 44 110 L44 68 Z",
    "M24 56 C14 56 10 64 10 74 C10 84 16 90 24 90 L24 56 Z",
    "M64 56 C74 56 78 64 78 74 C78 84 72 90 64 90 L64 56 Z",
    "M44 10 C36 10 32 16 32 24 C32 32 36 38 44 40 C52 38 56 32 56 24 C56 16 52 10 44 10 Z",
];

const DOT_POSITIONS = [
    { x: 21, y: 66 }, { x: 19, y: 74 }, { x: 23, y: 82 },
    { x: 33, y: 26 }, { x: 31, y: 38 }, { x: 31, y: 52 }, { x: 31, y: 66 }, { x: 31, y: 82 },
    { x: 39, y: 18 }, { x: 39, y: 32 }, { x: 39, y: 48 }, { x: 39, y: 64 }, { x: 39, y: 80 }, { x: 39, y: 96 },
    { x: 49, y: 18 }, { x: 49, y: 32 }, { x: 49, y: 48 }, { x: 49, y: 64 }, { x: 49, y: 80 }, { x: 49, y: 96 },
    { x: 57, y: 26 }, { x: 59, y: 38 }, { x: 59, y: 52 }, { x: 59, y: 66 }, { x: 59, y: 82 },
    { x: 67, y: 66 }, { x: 69, y: 74 }, { x: 65, y: 82 },
];

export default function renderWeeklyCactus({
    regionIds,
    paintedByRegion,
    selectedDate,
    onRegionClick,
    onRegionHover,
    colorClassByToken,
}) {
    return (
        <svg viewBox="0 0 88 132" className="h-full w-full">
            <rect x="6" y="6" width="76" height="120" rx="16" className="fill-sand-light" />

            <g>
                {regionIds.slice(0, 7).map((regionId, index) =>
                    renderInteractiveShape({
                        regionId,
                        entry: paintedByRegion[regionId],
                        selectedDate,
                        onRegionClick,
                        onRegionHover,
                        colorClassByToken,
                        children: (regionClass, isSelected) => (
                            <path
                                d={REGION_SHAPES[index]}
                                className={regionClass}
                                strokeWidth={isSelected ? "3" : "1.8"}
                                strokeLinejoin="round"
                            />
                        ),
                    })
                )}
            </g>

            <path
                d="M44 10
                   C36 10 32 15 32 24
                   L32 52
                   C32 56 30 58 26 58
                   C17 58 12 65 12 74
                   C12 83 17 90 26 90
                   C30 90 32 92 32 96
                   L32 102
                   C32 112 37 118 44 118
                   C51 118 56 112 56 102
                   L56 96
                   C56 92 58 90 62 90
                   C71 90 76 83 76 74
                   C76 65 71 58 62 58
                   C58 58 56 56 56 52
                   L56 24
                   C56 15 52 10 44 10 Z"
                fill="none"
                className="stroke-foreground"
                strokeWidth="1.8"
                strokeLinejoin="round"
            />

            <path d="M26 60 Q26 76 26 88" fill="none" className="stroke-foreground/65" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M34 18 Q32 44 34 104" fill="none" className="stroke-foreground/65" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M44 14 Q44 52 44 114" fill="none" className="stroke-foreground/65" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M54 18 Q56 44 54 104" fill="none" className="stroke-foreground/65" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M62 60 Q62 76 62 88" fill="none" className="stroke-foreground/65" strokeWidth="1.2" strokeLinecap="round" />

            <g className="fill-foreground/75">
                {DOT_POSITIONS.map((dot, index) => (
                    <circle key={index} cx={dot.x} cy={dot.y} r="1.2" />
                ))}
            </g>

            <ellipse cx="44" cy="104" rx="23" ry="6" className="fill-[hsl(28,32%,28%)]" />
            <path
                d="M24 98
                   C28 114 60 114 64 98
                   Q68 104 64 114
                   C60 122 28 122 24 114
                   Q20 104 24 98 Z"
                className="fill-terracotta stroke-foreground"
                strokeWidth="1.5"
                strokeLinejoin="round"
            />
            <ellipse cx="44" cy="116" rx="18" ry="4.5" className="fill-terracotta stroke-foreground" strokeWidth="1.3" />
        </svg>
    );
}

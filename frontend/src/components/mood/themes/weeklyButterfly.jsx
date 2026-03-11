import { renderInteractiveShape } from "./helpers";

export default function renderWeeklyButterfly({
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
}) {
  const segments = [
    { cx: 96, cy: 108, rx: 46, ry: 38, rotate: -20 },
    { cx: 82, cy: 162, rx: 38, ry: 28, rotate: 12 },
    { cx: 116, cy: 208, rx: 28, ry: 22, rotate: 28 },
    { cx: 204, cy: 108, rx: 46, ry: 38, rotate: 20 },
    { cx: 218, cy: 162, rx: 38, ry: 28, rotate: -12 },
    { cx: 184, cy: 208, rx: 28, ry: 22, rotate: -28 },
    { cx: 150, cy: 82, rx: 18, ry: 16, rotate: 0 },
  ];

  return (
    <svg viewBox="0 0 300 300" className="h-full w-full">
      <rect x="8" y="8" width="284" height="284" rx="28" className="fill-sky-light" />
      {segments.map((segment, index) =>
        renderInteractiveShape({
          regionId: regionIds[index],
          entry: paintedByRegion[regionIds[index]],
          selectedDate,
          onRegionClick,
          onRegionHover,
          children: (regionClass, isSelected) => (
            <ellipse
              cx={segment.cx}
              cy={segment.cy}
              rx={segment.rx}
              ry={segment.ry}
              className={regionClass}
              strokeWidth={isSelected ? "4" : "2.5"}
              transform={`rotate(${segment.rotate} ${segment.cx} ${segment.cy})`}
            />
          ),
        })
      )}
      <ellipse cx="150" cy="164" rx="14" ry="78" className="fill-foreground" />
      <path d="M145 88 Q128 64 114 52" className="stroke-foreground" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M155 88 Q172 64 186 52" className="stroke-foreground" strokeWidth="3" fill="none" strokeLinecap="round" />
      <circle cx="112" cy="50" r="5" className="fill-lavender" />
      <circle cx="188" cy="50" r="5" className="fill-terracotta" />
    </svg>
  );
}

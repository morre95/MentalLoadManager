import { renderInteractiveShape } from "./helpers";

export default function renderWeeklySeaside({
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
  colorClassByToken,
}) {
  const shells = [
    { cx: 56, cy: 212, rx: 24, ry: 18, rotate: -18 },
    { cx: 96, cy: 172, rx: 22, ry: 16, rotate: 12 },
    { cx: 132, cy: 220, rx: 24, ry: 18, rotate: -8 },
    { cx: 172, cy: 160, rx: 22, ry: 16, rotate: 18 },
    { cx: 206, cy: 212, rx: 24, ry: 18, rotate: -10 },
    { cx: 240, cy: 174, rx: 22, ry: 16, rotate: 16 },
    { cx: 150, cy: 116, rx: 26, ry: 20, rotate: 0 },
  ];

  return (
    <svg viewBox="0 0 300 300" className="h-full w-full">
      <rect x="8" y="8" width="284" height="284" rx="28" className="fill-sky-light" />
      <path d="M24 224 Q92 188 146 216 T276 204 L276 284 L24 284 Z" className="fill-sand-light" />
      <path d="M24 150 Q90 118 150 140 T276 132" className="stroke-sky" strokeWidth="4" fill="none" strokeLinecap="round" />
      {shells.map((shell, index) =>
        renderInteractiveShape({
          regionId: regionIds[index],
          entry: paintedByRegion[regionIds[index]],
          selectedDate,
          onRegionClick,
          onRegionHover,
          colorClassByToken,
          children: (regionClass, isSelected) => (
            <ellipse
              cx={shell.cx}
              cy={shell.cy}
              rx={shell.rx}
              ry={shell.ry}
              className={regionClass}
              strokeWidth={isSelected ? "4" : "2.5"}
              transform={`rotate(${shell.rotate} ${shell.cx} ${shell.cy})`}
            />
          ),
        })
      )}
      <circle cx="232" cy="62" r="18" className="fill-status-todo/80" />
    </svg>
  );
}

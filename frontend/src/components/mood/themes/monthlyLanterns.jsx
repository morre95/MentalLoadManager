import { renderInteractiveShape } from "./helpers";

export default function renderMonthlyLanterns({
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
  colorClassByToken,
}) {
  const columns = regionIds.length > 30 ? 6 : 5;
  const startX = 36;
  const spacingX = 54;
  const startY = 54;
  const spacingY = 48;

  return (
    <svg viewBox="0 0 360 320" className="h-full w-full">
      <rect x="8" y="8" width="344" height="304" rx="24" className="fill-muted" />
      <path d="M24 42 H336" className="stroke-foreground/70" strokeWidth="4" strokeLinecap="round" />
      {regionIds.map((regionId, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + column * spacingX;
        const y = startY + row * spacingY;
        const dropY = y - 18 - ((index + column) % 3) * 5;

        return (
          <g key={regionId}>
            <path d={`M${x} 42 L${x} ${dropY}`} className="stroke-foreground/60" strokeWidth="2" fill="none" />
            {renderInteractiveShape({
              regionId,
              entry: paintedByRegion[regionId],
              selectedDate,
              onRegionClick,
              onRegionHover,
              colorClassByToken,
              children: (regionClass, isSelected) => (
                <rect
                  x={x - 15}
                  y={y - 6}
                  width="30"
                  height="36"
                  rx="10"
                  className={regionClass}
                  strokeWidth={isSelected ? "4" : "2.5"}
                />
              ),
            })}
            <path d={`M${x - 8} ${y + 10} H${x + 8} M${x - 8} ${y + 20} H${x + 8}`} className="stroke-card" strokeWidth="2" strokeLinecap="round" />
          </g>
        );
      })}
    </svg>
  );
}

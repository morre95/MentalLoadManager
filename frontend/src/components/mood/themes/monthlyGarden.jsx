import { renderInteractiveShape } from "./helpers";

export default function renderMonthlyGarden({
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
  colorClassByToken,
}) {
  const columns = regionIds.length > 30 ? 6 : 5;
  const startX = 34;
  const spacingX = 56;
  const startY = 72;
  const spacingY = 46;

  return (
    <svg viewBox="0 0 360 320" className="h-full w-full">
      <rect x="8" y="8" width="344" height="304" rx="24" className="fill-sky-light" />
      <path d="M12 260 Q90 228 170 246 T348 238 L348 310 L12 310 Z" className="fill-sage-light" />
      {regionIds.map((regionId, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + column * spacingX;
        const y = startY + row * spacingY + (column % 2 === 0 ? 0 : 10);

        return (
          <g key={regionId}>
            <path d={`M${x} ${y + 16} Q${x} ${y + 34}, ${x} ${y + 52}`} className="stroke-sage" strokeWidth="3" fill="none" strokeLinecap="round" />
            <ellipse cx={x - 7} cy={y + 32} rx="7" ry="4" className="fill-sage" transform={`rotate(-28 ${x - 7} ${y + 32})`} />
            <ellipse cx={x + 7} cy={y + 26} rx="7" ry="4" className="fill-sage" transform={`rotate(28 ${x + 7} ${y + 26})`} />
            {renderInteractiveShape({
              regionId,
              entry: paintedByRegion[regionId],
              selectedDate,
              onRegionClick,
              onRegionHover,
              colorClassByToken,
              children: (regionClass, isSelected) => (
                <circle
                  cx={x}
                  cy={y}
                  r="14"
                  className={regionClass}
                  strokeWidth={isSelected ? "4" : "2.5"}
                />
              ),
            })}
          </g>
        );
      })}
    </svg>
  );
}

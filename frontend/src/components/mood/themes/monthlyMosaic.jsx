import { renderInteractiveShape } from "./helpers";

export default function renderMonthlyMosaic({
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
  colorClassByToken,
}) {
  const columns = regionIds.length > 30 ? 6 : 5;
  const tileWidth = 50;
  const tileHeight = 42;
  const horizontalGap = 10;
  const verticalGap = 12;
  const startX = 18;
  const startY = 18;

  return (
    <svg viewBox="0 0 360 320" className="h-full w-full">
      <rect x="8" y="8" width="344" height="304" rx="24" className="fill-sand-light" />
      {regionIds.map((regionId, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + column * (tileWidth + horizontalGap);
        const y = startY + row * (tileHeight + verticalGap) + (column % 2 === 0 ? 2 : 10);
        const rotate = ((index % 4) - 1.5) * 2.5;

        return renderInteractiveShape({
          regionId,
          entry: paintedByRegion[regionId],
          selectedDate,
          onRegionClick,
          onRegionHover,
          colorClassByToken,
          children: (regionClass, isSelected) => (
            <rect
              x={x}
              y={y}
              width={tileWidth}
              height={tileHeight}
              rx="10"
              className={regionClass}
              strokeWidth={isSelected ? "4" : "2"}
              transform={`rotate(${rotate} ${x + tileWidth / 2} ${y + tileHeight / 2})`}
            />
          ),
        });
      })}
    </svg>
  );
}

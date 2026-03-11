const COLOR_FILL_CLASS_BY_TOKEN = {
  sage: "fill-sage",
  terracotta: "fill-terracotta",
  lavender: "fill-lavender",
  sky: "fill-sky",
  primary: "fill-primary",
  accent: "fill-accent",
  sand: "fill-sand",
  "status-todo": "fill-status-todo",
  "status-doing": "fill-status-doing",
  "status-done": "fill-status-done",
};

const getRegionClasses = (entry, isSelectedDateRegion, isOccupiedByOtherDate) => {
  const fillClass = entry
    ? COLOR_FILL_CLASS_BY_TOKEN[entry.color_token] || "fill-primary"
    : "fill-muted/50";
  const strokeClass = isSelectedDateRegion
    ? "stroke-foreground"
    : isOccupiedByOtherDate
      ? "stroke-border"
      : "stroke-border/70 hover:stroke-foreground";

  return `${fillClass} ${strokeClass}`;
};

const renderInteractiveShape = ({
  regionId,
  entry,
  selectedDate,
  onRegionClick,
  onRegionHover,
  children,
}) => {
  const isSelectedDateRegion = entry?.date === selectedDate;
  const isOccupiedByOtherDate = Boolean(entry && entry.date !== selectedDate);

  return (
    <g
      key={regionId}
      className={isOccupiedByOtherDate ? "cursor-not-allowed" : "cursor-pointer"}
      onClick={() => {
        if (isOccupiedByOtherDate) return;
        onRegionClick(regionId);
      }}
      onMouseEnter={() => onRegionHover(regionId)}
      onMouseLeave={() => onRegionHover(null)}
    >
      {children(getRegionClasses(entry, isSelectedDateRegion, isOccupiedByOtherDate), isSelectedDateRegion)}
    </g>
  );
};

const renderWeeklyBloom = ({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover }) => {
  const petals = regionIds.map((regionId, index) => {
    const angle = (360 / regionIds.length) * index;
    return renderInteractiveShape({
      regionId,
      entry: paintedByRegion[regionId],
      selectedDate,
      onRegionClick,
      onRegionHover,
      children: (regionClass, isSelected) => (
        <ellipse
          cx="150"
          cy="82"
          rx="27"
          ry="54"
          className={regionClass}
          strokeWidth={isSelected ? "4" : "2.5"}
          transform={`rotate(${angle} 150 150)`}
        />
      ),
    });
  });

  return (
    <svg viewBox="0 0 300 300" className="h-full w-full">
      <defs>
        <linearGradient id="weeklyBloomBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" className="text-sage-light" stopColor="currentColor" />
          <stop offset="100%" className="text-sand-light" stopColor="currentColor" />
        </linearGradient>
      </defs>
      <rect x="8" y="8" width="284" height="284" rx="28" fill="url(#weeklyBloomBg)" />
      {petals}
      <circle cx="150" cy="150" r="34" className="fill-sand stroke-terracotta" strokeWidth="3" />
      <circle cx="150" cy="150" r="14" className="fill-terracotta" />
      <path d="M150 184 Q150 238 150 268" className="stroke-sage" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M150 220 Q126 214 116 198" className="stroke-sage" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M150 238 Q174 230 186 212" className="stroke-sage" strokeWidth="4" fill="none" strokeLinecap="round" />
      <ellipse cx="112" cy="196" rx="18" ry="9" className="fill-sage" transform="rotate(-28 112 196)" />
      <ellipse cx="188" cy="212" rx="18" ry="9" className="fill-sage" transform="rotate(28 188 212)" />
    </svg>
  );
};

const renderWeeklyButterfly = ({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover }) => {
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
};

const renderWeeklySeaside = ({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover }) => {
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
};

const renderMonthlyMosaic = ({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover }) => {
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
};

const renderMonthlyGarden = ({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover }) => {
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
};

const renderMonthlyLanterns = ({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover }) => {
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
};

export default function MoodArtwork({
  periodType,
  imageId,
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
}) {
  if (periodType === "weekly" && imageId === "weekly-bloom") {
    return renderWeeklyBloom({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover });
  }

  if (periodType === "weekly" && imageId === "weekly-butterfly") {
    return renderWeeklyButterfly({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover });
  }

  if (periodType === "weekly") {
    return renderWeeklySeaside({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover });
  }

  if (imageId === "monthly-garden") {
    return renderMonthlyGarden({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover });
  }

  if (imageId === "monthly-lanterns") {
    return renderMonthlyLanterns({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover });
  }

  return renderMonthlyMosaic({ regionIds, paintedByRegion, selectedDate, onRegionClick, onRegionHover });
}

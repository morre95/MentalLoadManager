import { renderInteractiveShape } from "./helpers";

export default function renderWeeklyBloom({
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
}) {
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
}

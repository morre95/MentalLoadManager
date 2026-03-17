export const COLOR_FILL_CLASS_BY_TOKEN = {
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

const getRegionClasses = (
  entry,
  isSelectedDateRegion,
  isOccupiedByOtherDate,
  colorClassByToken = COLOR_FILL_CLASS_BY_TOKEN
) => {
  const fillClass = entry
    ? colorClassByToken[entry.color_token] || COLOR_FILL_CLASS_BY_TOKEN[entry.color_token] || "fill-primary"
    : "fill-muted/50";
  const strokeClass = isSelectedDateRegion
    ? "stroke-foreground"
    : isOccupiedByOtherDate
      ? "stroke-border"
      : "stroke-border/70 hover:stroke-foreground";

  return `${fillClass} ${strokeClass}`;
};

export const renderInteractiveShape = ({
  regionId,
  entry,
  selectedDate,
  onRegionClick,
  onRegionHover,
  colorClassByToken,
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
      {children(
        getRegionClasses(entry, isSelectedDateRegion, isOccupiedByOtherDate, colorClassByToken),
        isSelectedDateRegion
      )}
    </g>
  );
};

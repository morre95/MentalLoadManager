import { useMemo } from "react";
import { fallbackThemeByPeriod, moodArtworkThemes } from "./themes";

const DEFAULT_COLOR_VALUE_BY_TOKEN = {
  accent: "hsl(var(--accent))",
  sky: "hsl(var(--sky))",
  sage: "hsl(var(--sage))",
  lavender: "hsl(var(--lavender))",
  terracotta: "hsl(var(--terracotta))",
  primary: "hsl(var(--primary))",
  sand: "hsl(var(--sand))",
  "status-todo": "hsl(var(--status-todo))",
  "status-doing": "hsl(var(--status-doing))",
  "status-done": "hsl(var(--status-done))",
};

function buildRenderedSvgMarkup({
  svgMarkup,
  paintedByRegion,
  periodType,
  selectedDate,
  colorValueByToken,
}) {
  if (typeof window === "undefined" || !svgMarkup) {
    return svgMarkup;
  }

  const parser = new window.DOMParser();
  const doc = parser.parseFromString(svgMarkup, "image/svg+xml");
  const svgRoot = doc.documentElement;
  const regionElements = doc.querySelectorAll("[data-region-id]");

  if (svgRoot?.tagName?.toLowerCase() === "svg") {
    svgRoot.setAttribute("preserveAspectRatio", "xMidYMin meet");
    if (periodType === "monthly") {
      const currentViewBox = svgRoot.getAttribute("viewBox");
      if (currentViewBox === "0 0 360 320") {
        svgRoot.setAttribute("viewBox", "0 40 360 320");
      }
    }
  }

  regionElements.forEach((element) => {
    const regionId = element.getAttribute("data-region-id");
    if (!regionId) return;

    const entry = paintedByRegion[regionId] || null;
    const isSelected = entry?.date === selectedDate;
    const fillValue = entry
      ? colorValueByToken[entry.color_token] || DEFAULT_COLOR_VALUE_BY_TOKEN[entry.color_token] || "hsl(var(--primary))"
      : "rgba(148, 163, 184, 0.20)";

    element.setAttribute("fill", fillValue);
    element.setAttribute("stroke", isSelected ? "hsl(var(--foreground))" : "rgba(100, 116, 139, 0.62)");
    element.setAttribute("stroke-width", isSelected ? "4" : "2.5");
    element.setAttribute("data-painted", entry ? "true" : "false");
    element.setAttribute("data-selected", isSelected ? "true" : "false");
    element.setAttribute("style", "cursor: pointer; transition: fill 160ms ease, stroke 160ms ease, stroke-width 160ms ease;");
  });

  return doc.documentElement.outerHTML;
}

export default function MoodArtwork({
  periodType,
  imageId,
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
  svgMarkup,
  colorValueByToken = {},
}) {
  const renderedSvgMarkup = useMemo(
    () =>
      buildRenderedSvgMarkup({
        svgMarkup,
        paintedByRegion,
        periodType,
        selectedDate,
        colorValueByToken,
      }),
    [colorValueByToken, paintedByRegion, periodType, selectedDate, svgMarkup]
  );

  if (renderedSvgMarkup) {
    return (
      <div
        className="h-full w-full overflow-hidden [&_svg]:block [&_svg]:h-full [&_svg]:w-full [&_svg]:max-h-full [&_svg]:max-w-full"
        style={{ contain: "layout paint size" }}
        onClick={(event) => {
          const regionElement = event.target.closest?.("[data-region-id]");
          const regionId = regionElement?.getAttribute?.("data-region-id");
          if (regionId) {
            onRegionClick(regionId);
          }
        }}
        onMouseOver={(event) => {
          const regionElement = event.target.closest?.("[data-region-id]");
          const regionId = regionElement?.getAttribute?.("data-region-id");
          onRegionHover(regionId || null);
        }}
        onMouseOut={(event) => {
          const regionElement = event.target.closest?.("[data-region-id]");
          const relatedRegionElement = event.relatedTarget?.closest?.("[data-region-id]") || null;
          const currentRegionId = regionElement?.getAttribute?.("data-region-id");
          const nextRegionId = relatedRegionElement?.getAttribute?.("data-region-id");

          if (currentRegionId && currentRegionId !== nextRegionId) {
            onRegionHover(null);
          }
        }}
        dangerouslySetInnerHTML={{ __html: renderedSvgMarkup }}
      />
    );
  }

  const renderTheme = moodArtworkThemes[imageId] || fallbackThemeByPeriod[periodType];
  return renderTheme({
    regionIds,
    paintedByRegion,
    selectedDate,
    onRegionClick,
    onRegionHover,
  });
}

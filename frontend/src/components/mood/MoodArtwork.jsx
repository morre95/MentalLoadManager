import { useEffect, useRef } from "react";
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

function applyRenderedSvgState({
  container,
  paintedByRegion,
  periodType,
  selectedDate,
  colorValueByToken,
}) {
  if (!container) {
    return;
  }

  const svgRoot = container.querySelector("svg");
  const regionElements = container.querySelectorAll("[data-region-id]");

  if (!svgRoot || !regionElements.length) {
    return;
  }

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
    const fillValue = entry
      ? colorValueByToken[entry.color_token] || DEFAULT_COLOR_VALUE_BY_TOKEN[entry.color_token] || "hsl(var(--primary))"
      : "transparent";

    element.setAttribute("fill", fillValue);
    element.setAttribute("data-painted", entry ? "true" : "false");
    element.setAttribute("data-selected", entry?.date === selectedDate ? "true" : "false");
    element.setAttribute("style", "cursor: pointer; transition: fill 160ms ease;");
  });
}

function mountSvgMarkup(container, svgMarkup) {
  if (typeof window === "undefined" || !container) {
    return;
  }

  container.replaceChildren();
  if (!svgMarkup) {
    return;
  }

  const parser = new window.DOMParser();
  const parsed = parser.parseFromString(svgMarkup, "image/svg+xml");
  const parsedRoot = parsed.documentElement;

  if (!parsedRoot || parsedRoot.tagName.toLowerCase() !== "svg") {
    return;
  }

  container.appendChild(document.importNode(parsedRoot, true));
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
  const containerRef = useRef(null);

  useEffect(() => {
    mountSvgMarkup(containerRef.current, svgMarkup);
  }, [svgMarkup]);

  useEffect(() => {
    applyRenderedSvgState({
      container: containerRef.current,
      paintedByRegion,
      periodType,
      selectedDate,
      colorValueByToken,
    });
  }, [colorValueByToken, paintedByRegion, periodType, selectedDate, svgMarkup]);

  if (svgMarkup) {
    return (
      <div
        ref={containerRef}
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

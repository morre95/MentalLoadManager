import { fallbackThemeByPeriod, moodArtworkThemes } from "./themes";

export default function MoodArtwork({
  periodType,
  imageId,
  regionIds,
  paintedByRegion,
  selectedDate,
  onRegionClick,
  onRegionHover,
  colorClassByToken,
}) {
  const renderTheme = moodArtworkThemes[imageId] || fallbackThemeByPeriod[periodType];

  return renderTheme({
    regionIds,
    paintedByRegion,
    selectedDate,
    onRegionClick,
    onRegionHover,
    colorClassByToken,
  });
}

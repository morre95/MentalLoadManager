import renderMonthlyGarden from "./monthlyGarden";
import renderMonthlyLanterns from "./monthlyLanterns";
import renderMonthlyMosaic from "./monthlyMosaic";
import renderWeeklyBloom from "./weeklyBloom";
import renderWeeklyButterfly from "./weeklyButterfly";
import renderWeeklyCactus from "./weeklyCactus";
import renderWeeklySeaside from "./weeklySeaside";

export const moodArtworkThemes = {
  "weekly-bloom": renderWeeklyBloom,
  "weekly-butterfly": renderWeeklyButterfly,
  "weekly-cactus": renderWeeklyCactus,
  "weekly-seaside": renderWeeklySeaside,
  "monthly-mosaic": renderMonthlyMosaic,
  "monthly-garden": renderMonthlyGarden,
  "monthly-lanterns": renderMonthlyLanterns,
};

export const fallbackThemeByPeriod = {
  weekly: renderWeeklySeaside,
  monthly: renderMonthlyMosaic,
};

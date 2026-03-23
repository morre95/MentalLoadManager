export function toLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysToIso(isoDate, daysToAdd) {
  const date = new Date(`${isoDate}T00:00:00`);
  date.setDate(date.getDate() + daysToAdd);
  return toLocalIsoDate(date);
}

export function formatWeekdayOnly(value) {
  if (!value) return "";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { weekday: "short" });
}

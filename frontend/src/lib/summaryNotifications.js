export const WEEKLY_SUMMARY_READY_EVENT = "weekly-summary:ready";

const WEEKLY_SUMMARY_NOTIFICATIONS_STORAGE_KEY =
  "dashboard-weekly-summary-notifications-v1";

function normalizeNotificationRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const aiSummaryId = String(record.ai_summary_id || "").trim();
  const householdId = String(record.household_id || "").trim();
  const title = String(record.title || "").trim();
  const message = String(record.message || "").trim();

  if (!aiSummaryId || !householdId || !title || !message) {
    return null;
  }

  return {
    id: `weekly-summary:${aiSummaryId}`,
    type: "weekly_summary",
    ai_summary_id: aiSummaryId,
    household_id: householdId,
    household_name: String(record.household_name || "").trim(),
    week_start: String(record.week_start || "").trim(),
    week_end: String(record.week_end || "").trim(),
    model: String(record.model || "").trim(),
    title,
    message,
    actionLabel: "Open summary",
    createdAt: String(record.createdAt || new Date().toISOString()),
  };
}

export function readWeeklySummaryNotifications() {
  if (typeof window === "undefined") return [];

  try {
    const rawValue = window.localStorage.getItem(
      WEEKLY_SUMMARY_NOTIFICATIONS_STORAGE_KEY,
    );
    const parsedValue = rawValue ? JSON.parse(rawValue) : [];

    if (!Array.isArray(parsedValue)) {
      return [];
    }

    return parsedValue
      .map(normalizeNotificationRecord)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function writeWeeklySummaryNotifications(notifications) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    WEEKLY_SUMMARY_NOTIFICATIONS_STORAGE_KEY,
    JSON.stringify(notifications),
  );
}

export function storeWeeklySummaryNotification(summary) {
  const notification = normalizeNotificationRecord(summary);
  if (!notification) {
    return null;
  }

  const existingNotifications = readWeeklySummaryNotifications().filter(
    (entry) => entry.ai_summary_id !== notification.ai_summary_id,
  );
  const nextNotifications = [notification, ...existingNotifications].slice(0, 25);

  writeWeeklySummaryNotifications(nextNotifications);

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(WEEKLY_SUMMARY_READY_EVENT, {
        detail: notification,
      }),
    );
  }

  return notification;
}

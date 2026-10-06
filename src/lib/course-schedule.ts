export const COURSE_TIME_ZONE = "Europe/Moscow";
export const COURSE_TIME_ZONE_OFFSET = "+03:00";
export const COURSE_LENGTH_DAYS = 14;
const DAY_MS = 86_400_000;

/** A date-only admin selection means midnight in the course time zone. */
export function courseStartFromDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Укажите дату начала обучения");
  const midnight = new Date(`${date}T00:00:00${COURSE_TIME_ZONE_OFFSET}`);
  if (Number.isNaN(midnight.getTime()) || courseDate(midnight) !== date) {
    throw new Error("Некорректная дата начала обучения");
  }
  return midnight.toISOString();
}

export function courseDate(value: Date | string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COURSE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function dateOrdinal(date: string): number {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS;
}

export function courseDay(startAt: string | null, now = new Date()): number {
  if (!startAt) return 0;
  return Math.max(
    0,
    Math.min(
      COURSE_LENGTH_DAYS,
      dateOrdinal(courseDate(now)) - dateOrdinal(courseDate(startAt)) + 1,
    ),
  );
}

export function lessonOpensAt(startAt: string, dayNumber: number): string {
  if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > COURSE_LENGTH_DAYS) {
    throw new Error("Некорректный номер урока");
  }
  return new Date(Date.parse(startAt) + (dayNumber - 1) * DAY_MS).toISOString();
}

export function formatCourseDate(value: string): string {
  return new Date(value).toLocaleDateString("ru-RU", {
    timeZone: COURSE_TIME_ZONE,
    day: "numeric",
    month: "long",
  });
}

export function formatCourseDateTime(value: string): string {
  return new Date(value).toLocaleString("ru-RU", {
    timeZone: COURSE_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

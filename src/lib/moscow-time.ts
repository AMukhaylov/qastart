export const MOSCOW_TIME_ZONE = "Europe/Moscow";
const MOSCOW_UTC_OFFSET = "+03:00";

function partsFor(value: Date | string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(value instanceof Date ? value : new Date(value))
    .reduce<Record<string, string>>((parts, part) => {
      parts[part.type] = part.value;
      return parts;
    }, {});
}

export function toMoscowDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = partsFor(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function fromMoscowDatetimeLocal(value: string) {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(`${match[1]}:00${MOSCOW_UTC_OFFSET}`);
  if (Number.isNaN(date.getTime()) || toMoscowDatetimeLocal(date.toISOString()) !== match[1]) {
    return null;
  }
  return date.toISOString();
}

export function formatMoscowDateTime(value: string | null, emptyLabel = "Дата не указана") {
  if (!value) return emptyLabel;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return emptyLabel;
  return `${new Intl.DateTimeFormat("ru-RU", {
    timeZone: MOSCOW_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)} МСК`;
}

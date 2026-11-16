export const APPLICATION_STATUSES = ["new", "contacted", "confirmed", "declined"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];
export type ApplicationContactType = "telegram" | "vk";

export function normalizeApplicationContact(type: ApplicationContactType, value: string) {
  let contact = value.trim().normalize("NFKC").toLowerCase();
  if (type === "telegram") {
    contact = contact.replace(/^https?:\/\/(www\.)?t\.me\//, "").replace(/^@/, "");
  } else {
    contact = contact
      .replace(/^(?:https?:\/\/)?(?:www\.)?(?:m\.)?vk\.com\//, "")
      .replace(/^@/, "")
      .replace(/\/$/, "");
  }
  return `${type}:${contact.replace(/\s+/g, "")}`;
}

export function isValidApplicationContact(type: ApplicationContactType, value: string) {
  const contact = value.trim();
  if (
    contact.length < 2 ||
    contact.length > 160 ||
    [...contact].some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  )
    return false;

  if (type === "telegram") {
    const username = normalizeApplicationContact(type, contact).slice("telegram:".length);
    return /^[a-z0-9_]{5,32}$/.test(username);
  }

  const username = normalizeApplicationContact(type, contact).slice("vk:".length);
  return /^(?:id)?[0-9]{1,20}$/.test(username) || /^[a-z0-9_.]{3,32}$/.test(username);
}

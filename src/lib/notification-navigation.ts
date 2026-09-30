import type { Json } from "@/integrations/supabase/types";

export type NotificationNavigationTarget =
  | { kind: "student-homework"; lessonDay: number }
  | { kind: "admin-homework"; submissionId: string }
  | { kind: "link"; href: string };

type NotificationForNavigation = {
  type: string;
  link: string;
  metadata: Json;
};

const homeworkNotificationTypes = new Set([
  "homework_approved",
  "homework_rework",
  "homework_mentor_comment",
  "homework_submitted",
  "homework_resubmitted",
]);

function asRecord(value: Json): Record<string, Json> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Json>)
    : {};
}

function asPositiveDay(value: Json | undefined) {
  const day = typeof value === "number" ? value : Number(value);
  return Number.isInteger(day) && day > 0 ? day : null;
}

/**
 * Resolves every notification in one place. Homework notifications use stable
 * entity metadata; the persisted link is only a backward-compatible fallback.
 */
export function getNotificationNavigationTarget(
  notification: NotificationForNavigation,
  isAdmin: boolean,
): NotificationNavigationTarget {
  const metadata = asRecord(notification.metadata);
  const targetType = metadata.targetType;
  const targetId = metadata.targetId ?? metadata.submissionId;
  const lessonDay = asPositiveDay(metadata.lessonDay ?? metadata.day);
  const isHomework =
    targetType === "homework_submission" || homeworkNotificationTypes.has(notification.type);

  if (isHomework && typeof targetId === "string" && targetId) {
    if (isAdmin) return { kind: "admin-homework", submissionId: targetId };
    if (lessonDay) return { kind: "student-homework", lessonDay };
  }

  if (isHomework && !isAdmin && lessonDay) {
    return { kind: "student-homework", lessonDay };
  }

  return { kind: "link", href: notification.link };
}

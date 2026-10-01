import assert from "node:assert/strict";
import test from "node:test";
import { getNotificationNavigationTarget } from "../../src/lib/notification-navigation.ts";

test("homework notifications route students to the lesson from metadata", () => {
  assert.deepEqual(
    getNotificationNavigationTarget(
      {
        type: "homework_rework",
        link: "/dashboard",
        metadata: { targetType: "homework_submission", targetId: "submission-1", lessonDay: 11 },
      },
      false,
    ),
    { kind: "student-homework", lessonDay: 11 },
  );
});

test("homework notifications route admins to the matching submission", () => {
  assert.deepEqual(
    getNotificationNavigationTarget(
      {
        type: "homework_submitted",
        link: "/dashboard",
        metadata: { targetType: "homework_submission", targetId: "submission-2", lessonDay: 8 },
      },
      true,
    ),
    { kind: "admin-homework", submissionId: "submission-2" },
  );
});

test("legacy homework notifications use day metadata and invalid metadata falls back to link", () => {
  assert.deepEqual(
    getNotificationNavigationTarget(
      { type: "homework_approved", link: "/dashboard", metadata: { day: "7" } },
      false,
    ),
    { kind: "student-homework", lessonDay: 7 },
  );
  assert.deepEqual(
    getNotificationNavigationTarget(
      { type: "homework_approved", link: "/dashboard?tab=homework", metadata: { day: 0 } },
      false,
    ),
    { kind: "link", href: "/dashboard?tab=homework" },
  );
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  formatMoscowDateTime,
  fromMoscowDatetimeLocal,
  toMoscowDatetimeLocal,
} from "../../src/lib/moscow-time.ts";
import {
  getAvailableCourseDay,
  getFirstIncompletePrerequisiteDay,
} from "../../src/lib/lesson-sequence.ts";

test("meeting form interprets and displays date-time in Moscow regardless of browser timezone", () => {
  const utc = fromMoscowDatetimeLocal("2026-11-23T19:00");
  assert.equal(utc, "2026-11-23T16:00:00.000Z");
  assert.equal(toMoscowDatetimeLocal(utc), "2026-11-23T19:00");
  assert.match(formatMoscowDateTime(utc), /23\.11\.2026, 19:00 МСК/);
});

test("daily access through day 12 is independent of completed lessons and homework", () => {
  const lessons = Array.from({ length: 14 }, (_, index) => ({
    id: `lesson-${index + 1}`,
    day_number: index + 1,
  }));
  assert.equal(getAvailableCourseDay(12, lessons, new Set()), 12);
  assert.equal(getFirstIncompletePrerequisiteDay(12, lessons, new Set()), null);
});

test("practice waits for days 1-12 and final test waits for day 13 too", () => {
  const lessons = Array.from({ length: 14 }, (_, index) => ({
    id: `lesson-${index + 1}`,
    day_number: index + 1,
  }));
  const days1To12 = new Set(lessons.slice(0, 12).map((lesson) => lesson.id));
  assert.equal(getAvailableCourseDay(14, lessons, new Set()), 12);
  assert.equal(getAvailableCourseDay(14, lessons, days1To12), 13);
  assert.equal(getFirstIncompletePrerequisiteDay(13, lessons, days1To12), null);
  assert.equal(getFirstIncompletePrerequisiteDay(14, lessons, days1To12), 13);
  assert.equal(getAvailableCourseDay(14, lessons, new Set([...days1To12, "lesson-13"])), 14);
});

test("recording links are validated server-side and replace the live-meeting action for learners", () => {
  const server = readFileSync(
    new URL("../../src/server/meetings.functions.ts", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../../src/routes/dashboard.tsx", import.meta.url),
    "utf8",
  );
  assert.match(server, /recordingUrl:[\s\S]*?refine\(isHttpsUrl/);
  assert.match(server, /recording_url: data\.recordingUrl/);
  assert.match(dashboard, /meeting\.recording_url \?\s*\([\s\S]*?Посмотреть запись/);
  assert.match(dashboard, /Перейти на встречу/);
});

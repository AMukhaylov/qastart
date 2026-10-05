import assert from "node:assert/strict";
import test from "node:test";
import { applyFinalQuizCompletion } from "../../src/lib/course-completion.ts";

test("legacy Day 14 progress does not complete the course before passing the final quiz", () => {
  const completed = applyFinalQuizCompletion(["day-1", "day-14"], "day-14", false);
  assert.deepEqual([...completed], ["day-1"]);
});

test("passing the final quiz completes Day 14 even if its legacy progress row is missing", () => {
  const completed = applyFinalQuizCompletion(["day-1"], "day-14", true);
  assert.deepEqual([...completed], ["day-1", "day-14"]);
});

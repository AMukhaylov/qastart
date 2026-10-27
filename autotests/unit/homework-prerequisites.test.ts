import assert from "node:assert/strict";
import test from "node:test";
import {
  homeworkPrerequisitesComplete,
  type LessonBlock,
} from "../../src/lib/interactive-lesson.ts";

const block = (
  id: string,
  block_type: LessonBlock["block_type"],
  position: number,
  content: Record<string, unknown> = {},
) => ({ id, block_type, position, content });

test("homework can be submitted after required lesson steps without full lesson completion", () => {
  const blocks = [
    block("theory", "text", 1),
    block("check", "question", 2),
    block("homework", "homework", 3),
  ];

  assert.equal(
    homeworkPrerequisitesComplete(
      blocks,
      "homework",
      new Set(["theory", "check"]),
      new Set(["check"]),
      new Set(),
      false,
      false,
    ),
    true,
  );
});

test("homework remains locked until required steps before it are complete", () => {
  const blocks = [block("theory", "text", 1), block("homework", "homework", 2)];

  assert.equal(
    homeworkPrerequisitesComplete(
      blocks,
      "homework",
      new Set(),
      new Set(),
      new Set(),
      false,
      false,
    ),
    false,
  );
});

test("legacy homework without a homework block still requires all required lesson steps", () => {
  const blocks = [block("theory", "text", 1), block("optional", "guide", 2, { required: false })];

  assert.equal(
    homeworkPrerequisitesComplete(
      blocks,
      undefined,
      new Set(["theory"]),
      new Set(),
      new Set(),
      false,
      false,
    ),
    true,
  );
});

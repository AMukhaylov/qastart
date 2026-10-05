import assert from "node:assert/strict";
import test from "node:test";
import { getAcceptedSqlHomeworkLessonIds } from "../../src/lib/homework-status.ts";

const block = {
  id: "sandbox-block",
  lesson_id: "lesson-11",
  content: {
    mode: "sql_sandbox",
    sandbox: { tasks: [{ id: "sql_1" }, { id: "sql_2" }] },
  },
};

test("SQL homework is accepted only after all configured tasks pass", () => {
  const accepted = getAcceptedSqlHomeworkLessonIds(
    [block],
    [
      { block_id: "sandbox-block", lesson_id: "lesson-11", task_id: "sql_1", passed: true },
      { block_id: "sandbox-block", lesson_id: "lesson-11", task_id: "sql_2", passed: true },
    ],
  );

  assert.deepEqual([...accepted], ["lesson-11"]);
});

test("SQL homework remains unaccepted when a task is missing or belongs to another block", () => {
  const accepted = getAcceptedSqlHomeworkLessonIds(
    [block],
    [
      { block_id: "sandbox-block", lesson_id: "lesson-11", task_id: "sql_1", passed: true },
      { block_id: "another-block", lesson_id: "lesson-11", task_id: "sql_2", passed: true },
    ],
  );

  assert.equal(accepted.size, 0);
});

test("non-SQL homework blocks are not accepted from SQL sandbox attempts", () => {
  const accepted = getAcceptedSqlHomeworkLessonIds(
    [{ ...block, content: { ...block.content, mode: "written" } }],
    [
      { block_id: "sandbox-block", lesson_id: "lesson-11", task_id: "sql_1", passed: true },
      { block_id: "sandbox-block", lesson_id: "lesson-11", task_id: "sql_2", passed: true },
    ],
  );

  assert.equal(accepted.size, 0);
});

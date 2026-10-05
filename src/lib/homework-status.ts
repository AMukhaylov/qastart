type HomeworkBlockForStatus = {
  id: string;
  lesson_id: string;
  content: Record<string, unknown>;
};

type SqlSandboxAttemptForStatus = {
  block_id: string;
  lesson_id: string;
  task_id: string;
  passed: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function getAcceptedSqlHomeworkLessonIds(
  blocks: HomeworkBlockForStatus[],
  attempts: SqlSandboxAttemptForStatus[],
) {
  const passedAttempts = new Set(
    attempts
      .filter((attempt) => attempt.passed)
      .map((attempt) => `${attempt.lesson_id}:${attempt.block_id}:${attempt.task_id}`),
  );
  const acceptedLessonIds = new Set<string>();

  for (const block of blocks) {
    if (block.content.mode !== "sql_sandbox") continue;

    const sandbox = asRecord(block.content.sandbox);
    const taskIds = Array.isArray(sandbox?.tasks)
      ? sandbox.tasks.flatMap((task) => {
          const taskId = asRecord(task)?.id;
          return typeof taskId === "string" && taskId.length > 0 ? [taskId] : [];
        })
      : [];

    if (
      taskIds.length > 0 &&
      taskIds.every((taskId) => passedAttempts.has(`${block.lesson_id}:${block.id}:${taskId}`))
    ) {
      acceptedLessonIds.add(block.lesson_id);
    }
  }

  return acceptedLessonIds;
}

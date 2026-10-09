import initSqlJs from "sql.js";
import type { LessonBlock, SqlSandboxConfig, SqlSandboxTask } from "@/lib/interactive-lesson";
import type { Json } from "@/integrations/supabase/types";
import { runSandboxTask, seedSandboxDatabase, type SqlSandboxResult } from "@/lib/sql-sandbox";

type StoredAttempt = {
  block_id: string;
  task_id: string;
  query_text: string;
  passed: boolean;
  passed_at?: string | null;
};

let sqlRuntime: ReturnType<typeof initSqlJs> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sqlConfigForBlock(block: Pick<LessonBlock, "block_type" | "content">) {
  if (block.block_type !== "homework" || block.content.mode !== "sql_sandbox") return null;
  const config = block.content.sandbox;
  if (!isRecord(config) || !isRecord(config.tables) || !Array.isArray(config.tasks)) return null;
  return config as unknown as SqlSandboxConfig;
}

export function hideSqlAnswerKeyFromStudent<T extends { block_type: string; content: Json }>(
  block: T,
): T {
  // Database JSON is a serializable type; LessonBlock is intentionally looser
  // for editor/runtime use and cannot be sent through a Server Function.
  const lessonBlock = block as unknown as LessonBlock;
  const config = sqlConfigForBlock(lessonBlock);
  if (!config) return block;
  return {
    ...block,
    content: {
      ...(block.content as Record<string, Json | undefined>),
      sandbox: {
        ...config,
        tasks: config.tasks.map((task) => {
          const {
            expectedColumns: _columns,
            expectedRows: _rows,
            verificationQuery: _query,
            ...visibleTask
          } = task;
          return visibleTask;
        }),
      },
    } as Json,
  } as T;
}

export async function evaluateSqlTask(
  config: SqlSandboxConfig,
  task: SqlSandboxTask,
  query: string,
): Promise<SqlSandboxResult> {
  sqlRuntime ??= initSqlJs();
  const SQL = await sqlRuntime;
  const database = new SQL.Database();
  try {
    seedSandboxDatabase(database, config.tables);
    return runSandboxTask(database, query, task, config);
  } finally {
    database.close();
  }
}

export async function regradeStoredSqlAttempts(
  blocks: Pick<LessonBlock, "id" | "block_type" | "content">[],
  attempts: StoredAttempt[],
) {
  const result = new Map<string, SqlSandboxResult>();
  const blocksById = new Map(blocks.map((block) => [block.id, block]));
  for (const attempt of attempts) {
    const block = blocksById.get(attempt.block_id);
    const config = block && sqlConfigForBlock(block);
    const task = config?.tasks.find((item) => item.id === attempt.task_id);
    if (!config || !task) continue;
    result.set(
      `${attempt.block_id}:${attempt.task_id}`,
      await evaluateSqlTask(config, task, attempt.query_text),
    );
  }
  return result;
}

export async function hasPassedEverySqlTask(
  block: Pick<LessonBlock, "id" | "block_type" | "content">,
  attempts: StoredAttempt[],
) {
  const config = sqlConfigForBlock(block);
  if (!config || config.tasks.length === 0) return false;
  const blockAttempts = attempts.filter((attempt) => attempt.block_id === block.id);
  const graded = await regradeStoredSqlAttempts([block], blockAttempts);
  return config.tasks.every((task) => graded.get(`${block.id}:${task.id}`)?.passed === true);
}

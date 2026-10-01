import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type { SqlSandboxConfig, SqlSandboxTask } from "./interactive-lesson.ts";
import { runSandboxTask, seedSandboxDatabase } from "./sql-sandbox.ts";

self.onmessage = async (
  event: MessageEvent<{ config: SqlSandboxConfig; sql: string; task: SqlSandboxTask }>,
) => {
  const { config, sql, task } = event.data;
  let database: import("sql.js").Database | undefined;
  try {
    const SQL = await initSqlJs({ locateFile: () => wasmUrl });
    database = new SQL.Database();
    seedSandboxDatabase(database, config.tables);
    self.postMessage(runSandboxTask(database, sql, task, config));
  } catch {
    self.postMessage({
      columns: [],
      rows: [],
      passed: false,
      message: "Не удалось подготовить учебную SQLite-базу. Проверьте конфигурацию таблиц.",
    });
  } finally {
    database?.close();
  }
};

export {};

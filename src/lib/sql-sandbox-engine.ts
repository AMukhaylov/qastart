import SqlSandboxWorker from "./sql-sandbox.worker?worker";
import type { SqlSandboxConfig, SqlSandboxTask } from "./interactive-lesson.ts";
import type { SqlSandboxResult } from "./sql-sandbox.ts";

export function runSandboxTaskInWorker(
  config: SqlSandboxConfig,
  sql: string,
  task: SqlSandboxTask,
) {
  return new Promise<SqlSandboxResult>((resolve) => {
    const worker = new SqlSandboxWorker();
    const timer = window.setTimeout(() => {
      worker.terminate();
      resolve({
        columns: [],
        rows: [],
        passed: false,
        message:
          "Запрос выполнялся слишком долго и был остановлен. Упрости запрос и попробуй ещё раз.",
      });
    }, 5000);
    worker.onmessage = (event: MessageEvent<SqlSandboxResult>) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve(event.data);
    };
    worker.onerror = () => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve({
        columns: [],
        rows: [],
        passed: false,
        message: "Не удалось запустить учебную SQLite-базу. Обнови страницу и попробуй ещё раз.",
      });
    };
    worker.postMessage({ config, sql, task });
  });
}

import { useState } from "react";
import { CheckCircle2, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { runSandboxTaskInWorker } from "@/lib/sql-sandbox-engine";
import { getSqlSandboxSuccessMessage, type SqlSandboxResult } from "@/lib/sql-sandbox";
import type { SqlSandboxConfig, SqlSandboxTask } from "@/lib/interactive-lesson";

export type SavedSqlSandboxAttempt = {
  block_id: string;
  task_id: string;
  query_text: string;
  passed: boolean;
  passed_at?: string | null;
  result_columns: string[];
  result_rows: Array<Array<string | number | null>>;
  feedback: string;
};

export function SqlSandboxHomework({
  title,
  instruction,
  successMessage = "Все задания выполнены. Молодец!",
  config,
  attempts = [],
  onAttemptSaved,
}: {
  title: string;
  instruction: string;
  successMessage?: string;
  config: SqlSandboxConfig;
  attempts?: SavedSqlSandboxAttempt[];
  onAttemptSaved?: (taskId: string, query: string) => Promise<SqlSandboxResult> | SqlSandboxResult;
}) {
  const [queries, setQueries] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      config.tasks.map((task) => [
        task.id,
        attempts.find((attempt) => attempt.task_id === task.id)?.query_text ??
          task.starterSql ??
          "",
      ]),
    ),
  );
  const [results, setResults] = useState<Record<string, SqlSandboxResult>>(() =>
    Object.fromEntries(
      attempts.map((attempt) => [
        attempt.task_id,
        {
          columns: attempt.result_columns ?? [],
          rows: attempt.result_rows ?? [],
          passed: attempt.passed,
          message: attempt.feedback || (attempt.passed ? "Верно" : "Попробуй ещё раз."),
        },
      ]),
    ),
  );
  const [runningTask, setRunningTask] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const passedCount = config.tasks.filter(
    (task) =>
      attempts.some((attempt) => attempt.task_id === task.id && attempt.passed) ||
      (!onAttemptSaved && results[task.id]?.passed === true),
  ).length;

  async function run(task: SqlSandboxTask) {
    setRunningTask(task.id);
    setSaveError(null);
    try {
      const query = queries[task.id] ?? "";
      const result = onAttemptSaved
        ? await onAttemptSaved(task.id, query)
        : await runSandboxTaskInWorker(config, query, task);
      setResults((current) => ({ ...current, [task.id]: result }));
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить ответ. Проверь подключение и попробуй ещё раз.",
      );
    } finally {
      setRunningTask(null);
    }
  }

  return (
    <section className="space-y-5 rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
      <div>
        <h2 className="text-xl font-extrabold">{title}</h2>
        <p className="mt-2 leading-relaxed text-foreground/85">{instruction}</p>
      </div>
      {config.showSchema !== false && (
        <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
          <h3 className="font-bold">Учебная база данных</h3>
          <p className="text-xs text-muted-foreground">
            Это отдельная учебная SQLite-база. Её данные восстанавливаются перед каждой проверкой.
          </p>
          {Object.entries(config.tables).map(([tableName, table]) => (
            <div
              key={tableName}
              className="overflow-hidden rounded-lg border border-border bg-background"
            >
              <div className="border-b border-border px-3 py-2 font-semibold">{tableName}</div>
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-left text-sm">
                  <thead>
                    <tr>
                      {table.columns.map((column) => (
                        <th
                          key={column.name}
                          className="whitespace-nowrap border-b border-border bg-primary-soft/60 px-3 py-2"
                        >
                          {column.name}
                          <span className="ml-1 text-xs font-normal text-muted-foreground">
                            {column.type ?? "TEXT"}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {table.rows.map((row, index) => (
                      <tr key={index} className="odd:bg-muted/20">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="border-b border-border/70 px-3 py-2">
                            {cell === null ? (
                              <span className="text-muted-foreground">NULL</span>
                            ) : (
                              String(cell)
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-3 rounded-xl bg-primary-soft/70 px-4 py-3">
        <span className="font-semibold">{config.progressLabel ?? "Выполнено"}</span>
        <span className="rounded-full bg-background px-3 py-1 text-sm font-bold text-primary">
          {passedCount}/{config.tasks.length}
        </span>
      </div>
      {config.tasks.map((task, index) => {
        const result = results[task.id];
        const savedPassed = attempts.some(
          (attempt) => attempt.task_id === task.id && attempt.passed,
        );
        const lockedAsPassed = savedPassed || (!onAttemptSaved && result?.passed === true);
        const busy = runningTask === task.id;
        return (
          <article
            key={task.id}
            className="space-y-3 rounded-xl border border-border bg-background p-4 md:p-5"
          >
            <div>
              <h3 className="font-bold">{task.title || `Задание ${index + 1}`}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {task.instruction}
              </p>
            </div>
            <label className="block text-sm font-semibold" htmlFor={`sql-${task.id}`}>
              SQL-запрос
            </label>
            <Textarea
              id={`sql-${task.id}`}
              value={queries[task.id] ?? ""}
              onChange={(event) =>
                setQueries((current) => ({ ...current, [task.id]: event.target.value }))
              }
              className="min-h-28 resize-y font-mono text-sm"
              placeholder="SELECT ... FROM ..."
              spellCheck={false}
              disabled={lockedAsPassed}
            />
            {task.hint && !result?.passed && (
              <details className="text-sm">
                <summary className="cursor-pointer font-semibold text-primary">Подсказка</summary>
                <p className="mt-2 text-muted-foreground">{task.hint}</p>
              </details>
            )}
            <Button
              type="button"
              onClick={() => void run(task)}
              disabled={busy || lockedAsPassed}
              variant="hero"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : lockedAsPassed ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {busy
                ? "Проверяем…"
                : lockedAsPassed
                  ? "Верно"
                  : (config.runButtonLabel ?? "Проверить")}
            </Button>
            {result && (
              <div
                className={`rounded-lg border p-3 ${result.passed ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
                role="status"
              >
                <p className="font-semibold">
                  {getSqlSandboxSuccessMessage(task, queries[task.id] ?? "", result)}
                </p>
                {result.columns.length > 0 &&
                  result.rows.length > 0 &&
                  config.showResultTable !== false && (
                    <div className="mt-3 overflow-x-auto rounded-md border border-border bg-background text-foreground">
                      <table className="min-w-full border-collapse text-left text-sm">
                        <thead>
                          <tr>
                            {result.columns.map((column, columnIndex) => (
                              <th
                                key={`${column}-${columnIndex}`}
                                className="whitespace-nowrap border-b border-border bg-muted/50 px-3 py-2"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.rows.map((row, rowIndex) => (
                            <tr key={rowIndex} className="odd:bg-muted/20">
                              {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="border-b border-border/70 px-3 py-2">
                                  {cell === null ? (
                                    <span className="text-muted-foreground">NULL</span>
                                  ) : (
                                    String(cell)
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </div>
            )}
          </article>
        );
      })}
      {saveError && (
        <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {saveError}
        </p>
      )}
      {passedCount === config.tasks.length && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-semibold text-emerald-800">
          {successMessage}
        </p>
      )}
    </section>
  );
}

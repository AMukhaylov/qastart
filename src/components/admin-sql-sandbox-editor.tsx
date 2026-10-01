import { useMemo } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SqlSandboxConfig, SqlSandboxTable, SqlSandboxTask } from "@/lib/interactive-lesson";
import {
  createSqlSandboxTaskId,
  createEmptySqlSandbox,
  validateSqlSandboxEditor,
} from "@/lib/sql-sandbox-editor";

const columnTypes = ["INTEGER", "REAL", "TEXT", "NUMERIC", "BLOB"] as const;
type SqlCell = string | number | null;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeSandbox(value: unknown): SqlSandboxConfig {
  const empty = createEmptySqlSandbox();
  if (!isObject(value)) return empty;
  const tables: SqlSandboxConfig["tables"] = {};
  if (isObject(value.tables)) {
    for (const [name, raw] of Object.entries(value.tables)) {
      if (!isObject(raw)) continue;
      tables[name] = {
        columns: Array.isArray(raw.columns)
          ? raw.columns.filter(isObject).map((column) => ({
              name: typeof column.name === "string" ? column.name : "",
              ...(column.type
                ? { type: column.type as SqlSandboxTable["columns"][number]["type"] }
                : {}),
            }))
          : [],
        rows: Array.isArray(raw.rows)
          ? raw.rows.filter(Array.isArray).map((row) => row as SqlCell[])
          : [],
      };
    }
  }
  const tasks: SqlSandboxTask[] = Array.isArray(value.tasks)
    ? value.tasks.filter(isObject).map((task) => ({
        id: typeof task.id === "string" ? task.id : createSqlSandboxTaskId(),
        title: typeof task.title === "string" ? task.title : "",
        instruction: typeof task.instruction === "string" ? task.instruction : "",
        ...(typeof task.hint === "string" ? { hint: task.hint } : {}),
        ...(typeof task.successMessage === "string" ? { successMessage: task.successMessage } : {}),
        expectedColumns: Array.isArray(task.expectedColumns)
          ? task.expectedColumns.map(String)
          : [""],
        expectedRows: Array.isArray(task.expectedRows)
          ? task.expectedRows.filter(Array.isArray).map((row) => row as SqlCell[])
          : [],
        ...(typeof task.orderSensitive === "boolean"
          ? { orderSensitive: task.orderSensitive }
          : {}),
        ...(typeof task.starterSql === "string" ? { starterSql: task.starterSql } : {}),
        ...(typeof task.verificationQuery === "string"
          ? { verificationQuery: task.verificationQuery }
          : {}),
      }))
    : [];
  return {
    ...empty,
    ...value,
    tables,
    tasks,
  } as SqlSandboxConfig;
}

function move<T>(items: T[], index: number, offset: number): T[] {
  const target = index + offset;
  if (target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function parseCell(value: string, type?: string): SqlCell {
  if (value === "") return null;
  if (type === "INTEGER") {
    const number = Number(value);
    return Number.isInteger(number) ? number : value;
  }
  if (type === "REAL" || type === "NUMERIC") {
    const number = Number(value);
    return Number.isFinite(number) ? number : value;
  }
  return value;
}

function showCell(value: SqlCell) {
  return value === null ? "" : String(value);
}

export function AdminSqlSandboxEditor({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (config: SqlSandboxConfig) => void;
}) {
  const sandbox = useMemo(() => normalizeSandbox(value), [value]);
  const errors = useMemo(() => validateSqlSandboxEditor(sandbox), [sandbox]);
  const update = (patch: Partial<SqlSandboxConfig>) => onChange({ ...sandbox, ...patch });
  const updateTables = (tables: SqlSandboxConfig["tables"]) => update({ tables });
  const updateTasks = (tasks: SqlSandboxTask[]) => update({ tasks });

  const renameTable = (oldName: string, newName: string) => {
    if (newName === oldName || Object.hasOwn(sandbox.tables, newName)) return;
    const entries = Object.entries(sandbox.tables).map(
      ([name, table]) => [name === oldName ? newName : name, table] as const,
    );
    updateTables(Object.fromEntries(entries));
  };

  return (
    <div className="space-y-6 rounded-xl border border-border bg-background p-4 md:p-5">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold">Учебная база данных</h3>
            <p className="text-xs text-muted-foreground">
              Данные используются только в изолированной SQLite-песочнице.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={Object.keys(sandbox.tables).length >= 10}
            onClick={() => {
              let name = `table_${Object.keys(sandbox.tables).length + 1}`;
              while (Object.hasOwn(sandbox.tables, name)) name = `${name}_new`;
              updateTables({
                ...sandbox.tables,
                [name]: { columns: [{ name: "id", type: "INTEGER" }], rows: [] },
              });
            }}
          >
            <Plus className="h-4 w-4" /> Добавить таблицу
          </Button>
        </div>
        {Object.entries(sandbox.tables).map(([tableName, table]) => (
          <article key={tableName} className="space-y-4 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-48 flex-1 space-y-2">
                <Label>Название таблицы</Label>
                <Input
                  value={tableName}
                  onChange={(event) => renameTable(tableName, event.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={`Удалить таблицу ${tableName}`}
                disabled={Object.keys(sandbox.tables).length <= 1}
                onClick={() => {
                  const next = { ...sandbox.tables };
                  delete next[tableName];
                  updateTables(next);
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Столбцы</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={table.columns.length >= 20}
                  onClick={() =>
                    updateTables({
                      ...sandbox.tables,
                      [tableName]: {
                        ...table,
                        columns: [
                          ...table.columns,
                          { name: `column_${table.columns.length + 1}`, type: "TEXT" },
                        ],
                        rows: table.rows.map((row) => [...row, ""]),
                      },
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Добавить столбец
                </Button>
              </div>
              {table.columns.map((column, columnIndex) => (
                <div
                  key={`${columnIndex}-${column.name}`}
                  className="grid grid-cols-[minmax(0,1fr)_minmax(110px,0.5fr)_auto_auto_auto] items-center gap-2"
                >
                  <Input
                    aria-label={`Имя столбца ${columnIndex + 1}`}
                    value={column.name}
                    onChange={(event) => {
                      const columns = [...table.columns];
                      columns[columnIndex] = { ...column, name: event.target.value };
                      updateTables({ ...sandbox.tables, [tableName]: { ...table, columns } });
                    }}
                  />
                  <select
                    aria-label={`Тип столбца ${columnIndex + 1}`}
                    className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                    value={column.type ?? "TEXT"}
                    onChange={(event) => {
                      const columns = [...table.columns];
                      columns[columnIndex] = {
                        ...column,
                        type: event.target.value as typeof column.type,
                      };
                      const rows = table.rows.map((row) =>
                        row.map((cell, cellIndex) =>
                          cellIndex === columnIndex
                            ? parseCell(showCell(cell), event.target.value)
                            : cell,
                        ),
                      );
                      updateTables({ ...sandbox.tables, [tableName]: { ...table, columns, rows } });
                    }}
                  >
                    {columnTypes.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Столбец вверх"
                    disabled={columnIndex === 0}
                    onClick={() => {
                      const columns = move(table.columns, columnIndex, -1);
                      const rows = table.rows.map((row) => move(row, columnIndex, -1));
                      updateTables({ ...sandbox.tables, [tableName]: { ...table, columns, rows } });
                    }}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Столбец вниз"
                    disabled={columnIndex === table.columns.length - 1}
                    onClick={() => {
                      const columns = move(table.columns, columnIndex, 1);
                      const rows = table.rows.map((row) => move(row, columnIndex, 1));
                      updateTables({ ...sandbox.tables, [tableName]: { ...table, columns, rows } });
                    }}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Удалить столбец"
                    disabled={table.columns.length <= 1}
                    onClick={() => {
                      const columns = table.columns.filter((_, i) => i !== columnIndex);
                      const rows = table.rows.map((row) => row.filter((_, i) => i !== columnIndex));
                      updateTables({ ...sandbox.tables, [tableName]: { ...table, columns, rows } });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>Тестовые данные</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={table.rows.length >= 500}
                  onClick={() =>
                    updateTables({
                      ...sandbox.tables,
                      [tableName]: { ...table, rows: [...table.rows, table.columns.map(() => "")] },
                    })
                  }
                >
                  <Plus className="h-4 w-4" /> Добавить строку
                </Button>
              </div>
              {table.rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex items-start gap-1">
                  <div
                    className="grid min-w-0 flex-1 gap-2"
                    style={{
                      gridTemplateColumns: `repeat(${Math.min(table.columns.length, 4)}, minmax(0, 1fr))`,
                    }}
                  >
                    {table.columns.map((column, columnIndex) => (
                      <Input
                        key={`${column.name}-${columnIndex}`}
                        aria-label={`${tableName}, строка ${rowIndex + 1}, ${column.name}`}
                        value={showCell(row[columnIndex] ?? null)}
                        placeholder={column.name}
                        onChange={(event) => {
                          const rows = table.rows.map((current, index) =>
                            index === rowIndex
                              ? current.map((cell, i) =>
                                  i === columnIndex
                                    ? parseCell(event.target.value, column.type)
                                    : cell,
                                )
                              : current,
                          );
                          updateTables({ ...sandbox.tables, [tableName]: { ...table, rows } });
                        }}
                      />
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Строка данных вверх"
                    disabled={rowIndex === 0}
                    onClick={() =>
                      updateTables({
                        ...sandbox.tables,
                        [tableName]: { ...table, rows: move(table.rows, rowIndex, -1) },
                      })
                    }
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Строка данных вниз"
                    disabled={rowIndex === table.rows.length - 1}
                    onClick={() =>
                      updateTables({
                        ...sandbox.tables,
                        [tableName]: { ...table, rows: move(table.rows, rowIndex, 1) },
                      })
                    }
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Удалить строку данных"
                    onClick={() =>
                      updateTables({
                        ...sandbox.tables,
                        [tableName]: {
                          ...table,
                          rows: table.rows.filter((_, i) => i !== rowIndex),
                        },
                      })
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3 border-t border-border pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-bold">SQL-задания ({sandbox.tasks.length})</h3>
            <p className="text-xs text-muted-foreground">
              Количество заданий не фиксировано; прогресс рассчитает система.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              updateTasks([
                ...sandbox.tasks,
                {
                  id: createSqlSandboxTaskId(),
                  title: "",
                  instruction: "",
                  hint: "",
                  expectedColumns: [""],
                  expectedRows: [],
                  orderSensitive: false,
                  starterSql: "",
                },
              ])
            }
          >
            <Plus className="h-4 w-4" /> Добавить задание
          </Button>
        </div>
        {sandbox.tasks.map((task, taskIndex) => (
          <article
            key={`${task.id}-${taskIndex}`}
            className="space-y-4 rounded-xl border border-border bg-muted/20 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-semibold">Задание {taskIndex + 1}</h4>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Задание вверх"
                  disabled={taskIndex === 0}
                  onClick={() => updateTasks(move(sandbox.tasks, taskIndex, -1))}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Задание вниз"
                  disabled={taskIndex === sandbox.tasks.length - 1}
                  onClick={() => updateTasks(move(sandbox.tasks, taskIndex, 1))}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Дублировать задание"
                  onClick={() => {
                    const copy = {
                      ...task,
                      id: createSqlSandboxTaskId(),
                      expectedColumns: [...task.expectedColumns],
                      expectedRows: task.expectedRows.map((row) => [...row]),
                    };
                    const next = [...sandbox.tasks];
                    next.splice(taskIndex + 1, 0, copy);
                    updateTasks(next);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Удалить задание"
                  disabled={sandbox.tasks.length <= 1}
                  onClick={() => updateTasks(sandbox.tasks.filter((_, i) => i !== taskIndex))}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Название задания *</Label>
                <Input
                  value={task.title}
                  onChange={(event) =>
                    updateTasks(
                      sandbox.tasks.map((item, i) =>
                        i === taskIndex ? { ...item, title: event.target.value } : item,
                      ),
                    )
                  }
                  placeholder="Например: Найти активных пользователей"
                />
              </div>
              <div className="space-y-2">
                <Label>Подсказка</Label>
                <Input
                  value={task.hint ?? ""}
                  onChange={(event) =>
                    updateTasks(
                      sandbox.tasks.map((item, i) =>
                        i === taskIndex ? { ...item, hint: event.target.value } : item,
                      ),
                    )
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Условие задания *</Label>
              <Textarea
                rows={3}
                value={task.instruction}
                onChange={(event) =>
                  updateTasks(
                    sandbox.tasks.map((item, i) =>
                      i === taskIndex ? { ...item, instruction: event.target.value } : item,
                    ),
                  )
                }
                placeholder="Опиши нужные данные и ожидаемый результат."
              />
            </div>
            <div className="space-y-2">
              <Label>Сообщение при правильном ответе (необязательно)</Label>
              <Input
                value={task.successMessage ?? ""}
                onChange={(event) =>
                  updateTasks(
                    sandbox.tasks.map((item, i) => {
                      if (i !== taskIndex) return item;
                      const next = { ...item };
                      if (event.target.value.trim()) next.successMessage = event.target.value;
                      else delete next.successMessage;
                      return next;
                    }),
                  )
                }
                placeholder="Например: Заказ удалён"
              />
              <p className="text-xs text-muted-foreground">
                Если оставить пустым, система покажет стандартное сообщение.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Стартовый SQL для ученика (необязательно)</Label>
              <Textarea
                rows={3}
                spellCheck={false}
                className="font-mono text-xs"
                value={task.starterSql ?? ""}
                onChange={(event) =>
                  updateTasks(
                    sandbox.tasks.map((item, i) =>
                      i === taskIndex ? { ...item, starterSql: event.target.value } : item,
                    ),
                  )
                }
                placeholder="SELECT ..."
              />
            </div>
            <div className="space-y-2">
              <Label>Проверочный SQL (только для наставника/админа, необязательно)</Label>
              <Textarea
                rows={3}
                spellCheck={false}
                className="font-mono text-xs"
                value={task.verificationQuery ?? ""}
                onChange={(event) => {
                  const value = event.target.value;
                  updateTasks(
                    sandbox.tasks.map((item, i) => {
                      if (i !== taskIndex) return item;
                      const next = { ...item };
                      if (value.trim()) next.verificationQuery = value;
                      else delete next.verificationQuery;
                      return next;
                    }),
                  );
                }}
                placeholder="SELECT id, status FROM orders WHERE id = 123"
              />
              <p className="text-xs text-muted-foreground">
                Ученику этот запрос не показывается. После INSERT / UPDATE / DELETE без RETURNING
                одиночный SELECT выполнится в той же учебной SQLite-базе; результат сверяется с
                ожидаемыми столбцами и строками.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={task.orderSensitive === true}
                onChange={(event) =>
                  updateTasks(
                    sandbox.tasks.map((item, i) =>
                      i === taskIndex ? { ...item, orderSensitive: event.target.checked } : item,
                    ),
                  )
                }
              />
              Учитывать порядок строк в результате
            </label>
            <ExpectedResultEditor
              task={task}
              onChange={(nextTask) =>
                updateTasks(sandbox.tasks.map((item, i) => (i === taskIndex ? nextTask : item)))
              }
            />
          </article>
        ))}
      </section>

      {errors.length > 0 && (
        <div
          className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
          role="status"
        >
          <p className="font-semibold">Проверьте конфигурацию перед сохранением:</p>
          {errors.map((error, index) => (
            <p key={`${index}-${error}`}>• {error}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpectedResultEditor({
  task,
  onChange,
}: {
  task: SqlSandboxTask;
  onChange: (task: SqlSandboxTask) => void;
}) {
  const renameColumn = (index: number, name: string) =>
    onChange({
      ...task,
      expectedColumns: task.expectedColumns.map((column, i) => (i === index ? name : column)),
    });
  const reorderColumn = (index: number, offset: number) =>
    onChange({
      ...task,
      expectedColumns: move(task.expectedColumns, index, offset),
      expectedRows: task.expectedRows.map((row) => move(row, index, offset)),
    });
  const addColumn = () =>
    onChange({
      ...task,
      expectedColumns: [...task.expectedColumns, ""],
      expectedRows: task.expectedRows.map((row) => [...row, ""]),
    });
  const removeColumn = (index: number) =>
    onChange({
      ...task,
      expectedColumns: task.expectedColumns.filter((_, i) => i !== index),
      expectedRows: task.expectedRows.map((row) => row.filter((_, i) => i !== index)),
    });
  return (
    <div className="space-y-3 rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Ожидаемый результат</p>
          <p className="text-xs text-muted-foreground">
            Столбцы и строки должны соответствовать данным после выполнения запроса.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={task.expectedColumns.length >= 20}
          onClick={addColumn}
        >
          <Plus className="h-4 w-4" /> Столбец
        </Button>
      </div>
      {task.expectedColumns.map((column, index) => (
        <div
          key={index}
          className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto] items-center gap-2"
        >
          <Input
            aria-label={`Ожидаемый столбец ${index + 1}`}
            value={column}
            placeholder={`Столбец ${index + 1}`}
            onChange={(event) => renameColumn(index, event.target.value)}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Ожидаемый столбец вверх"
            disabled={index === 0}
            onClick={() => reorderColumn(index, -1)}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Ожидаемый столбец вниз"
            disabled={index === task.expectedColumns.length - 1}
            onClick={() => reorderColumn(index, 1)}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Удалить ожидаемый столбец"
            disabled={task.expectedColumns.length <= 1}
            onClick={() => removeColumn(index)}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2">
        <Label>Строки результата</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={task.expectedRows.length >= 500}
          onClick={() =>
            onChange({
              ...task,
              expectedRows: [...task.expectedRows, task.expectedColumns.map(() => "")],
            })
          }
        >
          <Plus className="h-4 w-4" /> Строка результата
        </Button>
      </div>
      {task.expectedRows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-1">
          <div
            className="grid min-w-0 flex-1 gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(task.expectedColumns.length, 4)}, minmax(0, 1fr))`,
            }}
          >
            {task.expectedColumns.map((column, columnIndex) => (
              <Input
                key={`${column}-${columnIndex}`}
                aria-label={`Ожидаемая строка ${rowIndex + 1}, ${column || `столбец ${columnIndex + 1}`}`}
                placeholder={column || `Столбец ${columnIndex + 1}`}
                value={showCell(row[columnIndex] ?? null)}
                onChange={(event) =>
                  onChange({
                    ...task,
                    expectedRows: task.expectedRows.map((cells, i) =>
                      i === rowIndex
                        ? cells.map((cell, j) =>
                            j === columnIndex ? parseCell(event.target.value) : cell,
                          )
                        : cells,
                    ),
                  })
                }
              />
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Ожидаемая строка вверх"
            disabled={rowIndex === 0}
            onClick={() =>
              onChange({ ...task, expectedRows: move(task.expectedRows, rowIndex, -1) })
            }
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Ожидаемая строка вниз"
            disabled={rowIndex === task.expectedRows.length - 1}
            onClick={() =>
              onChange({ ...task, expectedRows: move(task.expectedRows, rowIndex, 1) })
            }
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Удалить ожидаемую строку"
            onClick={() =>
              onChange({
                ...task,
                expectedRows: task.expectedRows.filter((_, i) => i !== rowIndex),
              })
            }
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}

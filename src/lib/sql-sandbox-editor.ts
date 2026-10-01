import type { SqlSandboxConfig } from "@/lib/interactive-lesson";
import { validateSandboxSelect } from "./sql-sandbox.ts";

export function createSqlSandboxTaskId() {
  return `sql-task-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`}`;
}

export function createEmptySqlSandbox(): SqlSandboxConfig {
  return {
    engine: "sqlite",
    readOnly: false,
    allowStatements: ["SELECT", "INSERT", "UPDATE", "DELETE"],
    resetDatabaseBeforeEachRun: true,
    tables: { users: { columns: [{ name: "id", type: "INTEGER" }], rows: [] } },
    tasks: [
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
    ],
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validateSqlSandboxEditor(value: unknown): string[] {
  if (!isObject(value)) return ["Добавьте конфигурацию учебной базы."];
  const errors: string[] = [];
  const tables = isObject(value.tables) ? Object.entries(value.tables) : [];
  if (!tables.length) errors.push("Добавьте хотя бы одну таблицу.");
  if (tables.length > 10) errors.push("Можно создать не более 10 таблиц.");
  for (const [tableName, raw] of tables) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName))
      errors.push(
        `Таблица «${tableName}»: используйте латинские буквы, цифры и _; имя не должно начинаться с цифры.`,
      );
    if (!isObject(raw)) {
      errors.push(`Таблица «${tableName}»: некорректная конфигурация.`);
      continue;
    }
    const columns = Array.isArray(raw.columns) ? raw.columns : [];
    const rows = Array.isArray(raw.rows) ? raw.rows : [];
    if (!columns.length || columns.length > 20)
      errors.push(`Таблица «${tableName}»: нужно от 1 до 20 столбцов.`);
    if (rows.length > 500) errors.push(`Таблица «${tableName}»: максимум 500 строк данных.`);
    const names = columns.map((column) => (isObject(column) ? column.name : ""));
    names.forEach((name, index) => {
      if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name))
        errors.push(`Таблица «${tableName}», столбец ${index + 1}: укажите корректное имя.`);
    });
    if (new Set(names).size !== names.length)
      errors.push(`Таблица «${tableName}»: имена столбцов должны быть уникальными.`);
    rows.forEach((row, index) => {
      if (
        !Array.isArray(row) ||
        row.length !== columns.length ||
        row.some(
          (cell) =>
            !(
              cell === null ||
              typeof cell === "string" ||
              (typeof cell === "number" && Number.isFinite(cell))
            ),
        )
      )
        errors.push(
          `Таблица «${tableName}», строка ${index + 1}: количество ячеек должно совпадать с количеством столбцов.`,
        );
    });
  }
  const tasks = Array.isArray(value.tasks) ? value.tasks : [];
  if (!tasks.length) errors.push("Добавьте хотя бы одно SQL-задание.");
  const ids = tasks.map((task) => (isObject(task) ? task.id : undefined));
  if (
    ids.some((id) => typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) ||
    new Set(ids).size !== ids.length
  )
    errors.push("ID заданий должны быть заполнены, безопасны и не повторяться.");
  tasks.forEach((raw, index) => {
    const ordinal = index + 1;
    if (!isObject(raw)) {
      errors.push(`Задание ${ordinal}: некорректные данные.`);
      return;
    }
    if (typeof raw.title !== "string" || !raw.title.trim())
      errors.push(`Задание ${ordinal}: заполните название.`);
    if (typeof raw.instruction !== "string" || !raw.instruction.trim())
      errors.push(`Задание ${ordinal}: заполните условие.`);
    if ("verificationQuery" in raw) {
      if (typeof raw.verificationQuery !== "string" || !raw.verificationQuery.trim()) {
        errors.push(`Задание ${ordinal}: проверочный SELECT должен быть непустым.`);
      } else {
        const result = validateSandboxSelect(raw.verificationQuery);
        if (!result.valid)
          errors.push(
            `Задание ${ordinal}: проверочный SELECT небезопасен или некорректен. ${result.message}`,
          );
      }
    }
    const columns = raw.expectedColumns;
    if (
      !Array.isArray(columns) ||
      columns.length < 1 ||
      columns.some((column) => typeof column !== "string" || !column.trim()) ||
      new Set(columns).size !== columns.length
    )
      errors.push(
        `Задание ${ordinal}: expectedColumns должны содержать непустые уникальные названия столбцов.`,
      );
    const width = Array.isArray(columns) ? columns.length : -1;
    if (
      !Array.isArray(raw.expectedRows) ||
      raw.expectedRows.some(
        (row) =>
          !Array.isArray(row) ||
          row.length !== width ||
          row.some(
            (cell) =>
              !(
                cell === null ||
                typeof cell === "string" ||
                (typeof cell === "number" && Number.isFinite(cell))
              ),
          ),
      )
    )
      errors.push(
        `Задание ${ordinal}: каждая строка expectedRows должна иметь ${Math.max(width, 0)} ячеек и содержать только текст, числа или NULL.`,
      );
  });
  return errors;
}

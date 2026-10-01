import type { Database } from "sql.js";
import type {
  SqlSandboxConfig,
  SqlSandboxStatement,
  SqlSandboxTask,
  SqlSandboxTable,
} from "./interactive-lesson.ts";

export type SqlSandboxResult = {
  columns: string[];
  rows: Array<Array<string | number | null>>;
  passed: boolean;
  message: string;
};

export function getSqlSandboxSuccessMessage(
  task: SqlSandboxTask,
  query: string,
  result: SqlSandboxResult,
) {
  if (!result.passed) return result.message;
  if (task.successMessage?.trim()) return task.successMessage;
  if (result.rows.length === 0) {
    return /\bDELETE\b/i.test(query) && /\borders\b/i.test(query)
      ? "Заказ удалён"
      : "Запрос верный. Строк не найдено.";
  }
  return result.message;
}

export function getSqlSandboxProgress(
  tasks: SqlSandboxTask[],
  attempts: Array<{ task_id: string; passed: boolean }>,
) {
  const passedIds = new Set(
    attempts.filter((attempt) => attempt.passed).map((attempt) => attempt.task_id),
  );
  const completed = tasks.filter((task) => passedIds.has(task.id)).length;
  return {
    completed,
    total: tasks.length,
    isComplete: tasks.length > 0 && completed === tasks.length,
  };
}

const supportedStatements = new Set<SqlSandboxStatement>(["SELECT", "INSERT", "UPDATE", "DELETE"]);

const blockedKeywords = new Set([
  "REPLACE",
  "DROP",
  "ALTER",
  "CREATE",
  "ATTACH",
  "DETACH",
  "PRAGMA",
  "VACUUM",
  "REINDEX",
  "ANALYZE",
  "BEGIN",
  "COMMIT",
  "ROLLBACK",
  "SAVEPOINT",
  "RELEASE",
  "LOAD_EXTENSION",
  "RANDOMBLOB",
  "ZEROBLOB",
  "PRINTF",
  "FORMAT",
  "READFILE",
  "WRITEFILE",
]);

/** Lex SQL outside literals/comments and allow only explicitly configured statement types. */
export function validateSandboxQuery(
  sql: string,
  allowedStatements: readonly SqlSandboxStatement[] = ["SELECT"],
): { valid: true; query: string } | { valid: false; message: string } {
  if (!sql.trim()) return { valid: false, message: "Напиши SQL-запрос и нажми «Проверить»." };
  if (sql.length > 4000)
    return { valid: false, message: "Запрос слишком длинный. Ограничение — 4 000 символов." };

  const tokens: string[] = [];
  let semicolons = 0;
  let lastSignificant = "";
  let i = 0;
  while (i < sql.length) {
    const char = sql[i]!;
    const next = sql[i + 1];
    if (char === "'" || char === '"' || char === "`" || char === "[") {
      const end = char === "[" ? "]" : char;
      lastSignificant = "VALUE";
      i += 1;
      while (i < sql.length) {
        if (sql[i] === end) {
          if (sql[i + 1] === end && end !== "]") {
            i += 2;
            continue;
          }
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    if (char === "-" && next === "-") {
      i += 2;
      while (i < sql.length && sql[i] !== "\n" && sql[i] !== "\r") i += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      i += 2;
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i += 1;
      if (i < sql.length) i += 2;
      continue;
    }
    if (char === ";") {
      semicolons += 1;
      lastSignificant = ";";
      i += 1;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      const start = i++;
      while (i < sql.length && /[A-Za-z0-9_$]/.test(sql[i]!)) i += 1;
      const token = sql.slice(start, i).toUpperCase();
      tokens.push(token);
      lastSignificant = token;
      continue;
    }
    if (!/\s/.test(char)) lastSignificant = char;
    i += 1;
  }
  if (semicolons > 1 || (semicolons === 1 && lastSignificant !== ";")) {
    return { valid: false, message: "Разрешён только один SQL-запрос без дополнительных команд." };
  }
  const statement = tokens[0];
  const allowed = allowedStatements.filter((entry) => supportedStatements.has(entry));
  if (!statement || !allowed.includes(statement as SqlSandboxStatement)) {
    const list = allowed.length > 0 ? allowed.join(", ") : "SELECT";
    return {
      valid: false,
      message: `В учебной песочнице разрешены только команды: ${list}.`,
    };
  }
  const forbidden = tokens.find((token) => blockedKeywords.has(token));
  if (forbidden)
    return {
      valid: false,
      message:
        "Разрешены только запросы SELECT. Изменяющие данные и настройки команды заблокированы.",
    };
  return { valid: true, query: sql.trim().replace(/;\s*$/u, "") };
}

/** Backwards-compatible SELECT-only validator for existing callers and tests. */
export function validateSandboxSelect(sql: string) {
  return validateSandboxQuery(sql, ["SELECT"]);
}

function quoteIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier))
    throw new Error("Некорректное имя учебного поля.");
  return `"${identifier}"`;
}

export function seedSandboxDatabase(database: Database, tables: Record<string, SqlSandboxTable>) {
  for (const [tableName, table] of Object.entries(tables)) {
    const name = quoteIdentifier(tableName);
    const columns = table.columns.map((column) => {
      const type = ["INTEGER", "REAL", "TEXT", "NUMERIC", "BLOB"].includes(
        String(column.type ?? "TEXT").toUpperCase(),
      )
        ? String(column.type ?? "TEXT").toUpperCase()
        : "TEXT";
      return `${quoteIdentifier(column.name)} ${type}`;
    });
    database.run(`CREATE TABLE ${name} (${columns.join(", ")})`);
    if (table.rows.length) {
      const placeholders = table.columns.map(() => "?").join(", ");
      const insert = database.prepare(`INSERT INTO ${name} VALUES (${placeholders})`);
      try {
        for (const row of table.rows) {
          insert.bind(row as (string | number | Uint8Array | null)[]);
          insert.step();
          insert.reset();
        }
      } finally {
        insert.free();
      }
    }
  }
}

function cellKey(value: unknown) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return `number:${Object.is(value, -0) ? 0 : value}`;
  if (typeof value === "string") return `string:${value}`;
  if (value instanceof Uint8Array) return `blob:${Array.from(value).join(",")}`;
  return `${typeof value}:${String(value)}`;
}

function canonicalRow(row: unknown[]) {
  return row.map(cellKey).sort().join("\u001f");
}

export function compareSandboxRows(
  actualRows: unknown[][],
  expectedRows: unknown[][],
  orderSensitive: boolean,
) {
  if (actualRows.length !== expectedRows.length) return false;
  const actual = actualRows.map(canonicalRow);
  const expected = expectedRows.map(canonicalRow);
  if (orderSensitive) return actual.every((row, index) => row === expected[index]);
  actual.sort();
  expected.sort();
  return actual.every((row, index) => row === expected[index]);
}

function resultFeedback(
  columns: string[],
  rows: unknown[][],
  task: SqlSandboxTask,
  rowsMatch: boolean,
) {
  if (columns.length !== task.expectedColumns.length) {
    const received = columns.length ? columns.join(", ") : "нет";
    return `Запрос вернул столбцов: ${columns.length} (${received}); ожидалось: ${task.expectedColumns.length} (${task.expectedColumns.join(", ")}). Проверь список после SELECT.`;
  }
  if (rows.length !== task.expectedRows.length) {
    return `Запрос вернул строк: ${rows.length}; ожидалось: ${task.expectedRows.length}. Проверь условие WHERE или связь таблиц в JOIN.`;
  }
  if (!rowsMatch && task.orderSensitive === true) {
    const firstDifferent = rows.findIndex(
      (row, index) => canonicalRow(row) !== canonicalRow(task.expectedRows[index] ?? []),
    );
    return `Данные строки ${firstDifferent + 1} не совпадают с ожидаемыми. Проверь поля и сортировку по ${task.expectedColumns.join(", ")}.`;
  }
  if (!rowsMatch)
    return `Количество строк верное (${rows.length}), но значения отличаются. Проверь выбранные поля, фильтр WHERE и условия JOIN.`;
  return "Верно";
}

function friendlySqlError(
  error: unknown,
  sql: string,
  task: SqlSandboxTask,
  tables: Record<string, SqlSandboxTable> = {},
) {
  const rawMessage = error instanceof Error ? error.message : "";
  const message = rawMessage.toLowerCase();
  const tableNames = Object.keys(tables);

  if (/no such table/u.test(message)) {
    const missing = rawMessage.match(/no such table:\s*["`[]?([\w.]+)["`\]]?/iu)?.[1];
    return missing
      ? `Таблица «${missing}» не найдена. В этой песочнице доступны: ${tableNames.join(", ") || "нет таблиц"}.`
      : `Таблица не найдена. Укажи таблицу после FROM или JOIN. Доступны: ${tableNames.join(", ") || "нет таблиц"}.`;
  }

  if (/no such column/u.test(message)) {
    const missing = rawMessage.match(/no such column:\s*["`[]?([\w.]+)["`\]]?/iu)?.[1];
    const orderByDirection = sql.match(/\bORDER\s+BY\s+(ASC|DESC)\b/iu)?.[1];
    if (orderByDirection) {
      const example = task.hint?.match(/\bORDER\s+BY\s+([A-Za-z_][\w]*)\s+(ASC|DESC)\b/iu);
      const suggestion = example
        ? `Для этого задания используй: ORDER BY ${example[1]} ${example[2]!.toUpperCase()}.`
        : "Сначала укажи столбец, затем направление ASC или DESC.";
      return `После ORDER BY указано ${orderByDirection.toUpperCase()}, но это направление сортировки, а не столбец. ${suggestion}`;
    }

    const referenced = Array.from(sql.matchAll(/\b(?:FROM|JOIN)\s+["`[]?([A-Za-z_][\w]*)/giu))
      .map((match) => match[1]!)
      .filter((name) => name in tables);
    const sourceTables = [...new Set(referenced)];
    const availableColumns = sourceTables.flatMap((name) =>
      tables[name]!.columns.map((column) => column.name),
    );
    const uniqueColumns = [...new Set(availableColumns)];
    const columnList =
      uniqueColumns.length > 0 ? uniqueColumns.join(", ") : "см. схему учебных таблиц";
    const where =
      sourceTables.length > 0
        ? ` в таблиц${sourceTables.length > 1 ? "ах" : "е"} ${sourceTables.map((name) => `«${name}»`).join(", ")}`
        : " в подключённых таблицах";
    return `Неизвестный столбец${missing ? ` «${missing}»` : ""}${where}. Доступные столбцы: ${columnList}.`;
  }

  const syntaxNear = rawMessage.match(/near\s+["']([^"']+)["']:\s*syntax error/iu)?.[1];
  if (syntaxNear && /\bORDER\s+BY\s+(?:ASC|DESC)\b/iu.test(sql)) {
    const example = task.hint?.match(/\bORDER\s+BY\s+([A-Za-z_][\w]*)\s+(ASC|DESC)\b/iu);
    const suggestion = example
      ? `Для этого задания используй: ORDER BY ${example[1]} ${example[2]!.toUpperCase()}.`
      : "Сначала укажи столбец, затем направление ASC или DESC.";
    return `Ошибка рядом с «${syntaxNear}»: направление сортировки указано без столбца. ${suggestion}`;
  }
  if (/syntax error|incomplete input|unrecognized token/u.test(message))
    return syntaxNear
      ? `Синтаксическая ошибка рядом с «${syntaxNear}». Проверь порядок ключевых слов и пропущенные части запроса.`
      : "Синтаксическая ошибка. Проверь ключевые слова, запятые и скобки.";
  if (/ambiguous column/u.test(message)) {
    const column = rawMessage.match(/ambiguous column name:\s*["`]?([\w]+)["`]?/iu)?.[1];
    return `Столбец${column ? ` «${column}»` : ""} есть в нескольких таблицах. Укажи его вместе с таблицей, например users.id.`;
  }
  return "Не удалось выполнить запрос. Проверь названия таблиц и столбцов, а также порядок частей SQL-запроса.";
}

export function runSandboxTask(
  database: Database,
  sql: string,
  task: SqlSandboxTask,
  config?: Pick<SqlSandboxConfig, "allowStatements" | "readOnly" | "tables">,
): SqlSandboxResult {
  const allowedStatements: readonly SqlSandboxStatement[] =
    config?.readOnly === true ? ["SELECT"] : (config?.allowStatements ?? ["SELECT"]);
  const validated = validateSandboxQuery(sql, allowedStatements);
  if (!validated.valid) return { columns: [], rows: [], passed: false, message: validated.message };
  let statement;
  let queryForErrorFeedback = validated.query;
  try {
    statement = database.prepare(validated.query);
    let columns = statement.getColumnNames();
    let rows = collectSandboxRows(statement);
    if (rows.length > 1000) return tooManySandboxRows(columns, rows);

    const isMutation = /^(?:INSERT|UPDATE|DELETE)\b/iu.test(validated.query);
    if (isMutation && columns.length === 0) {
      statement.free();
      statement = undefined;
      if (!task.verificationQuery?.trim()) {
        return {
          columns,
          rows,
          passed: false,
          message:
            "Запрос выполнился, но проверочный запрос для результата не настроен. Сообщи наставнику.",
        };
      }
      const verifiedQuery = validateSandboxSelect(task.verificationQuery);
      if (!verifiedQuery.valid) {
        return {
          columns: [],
          rows: [],
          passed: false,
          message: "Не удалось проверить результат изменения. Сообщи наставнику.",
        };
      }
      queryForErrorFeedback = verifiedQuery.query;
      statement = database.prepare(verifiedQuery.query);
      columns = statement.getColumnNames();
      rows = collectSandboxRows(statement);
      if (rows.length > 1000) return tooManySandboxRows(columns, rows);
    }

    const rowsMatch = compareSandboxRows(rows, task.expectedRows, task.orderSensitive === true);
    const passed = columns.length === task.expectedColumns.length && rowsMatch;
    return {
      columns,
      rows,
      passed,
      message: resultFeedback(columns, rows, task, rowsMatch),
    };
  } catch (error) {
    return {
      columns: [],
      rows: [],
      passed: false,
      message: friendlySqlError(error, queryForErrorFeedback, task, config?.tables),
    };
  } finally {
    statement?.free();
  }
}

function collectSandboxRows(statement: ReturnType<Database["prepare"]>) {
  const rows: Array<Array<string | number | null>> = [];
  while (statement.step()) {
    rows.push(statement.get() as Array<string | number | null>);
    if (rows.length > 1000) break;
  }
  return rows;
}

function tooManySandboxRows(columns: string[], rows: Array<Array<string | number | null>>) {
  return {
    columns,
    rows: rows.slice(0, 1000),
    passed: false,
    message: "Запрос вернул слишком много строк (больше 1 000).",
  };
}

export function runFreshSandboxTask(
  config: SqlSandboxConfig,
  sql: string,
  task: SqlSandboxTask,
  createDatabase: () => Database,
): SqlSandboxResult {
  const database = createDatabase();
  try {
    seedSandboxDatabase(database, config.tables);
    return runSandboxTask(database, sql, task, config);
  } finally {
    database.close();
  }
}

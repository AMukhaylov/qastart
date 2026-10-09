import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import initSqlJs from "sql.js";
import {
  getSqlSandboxSuccessMessage,
  getSqlSandboxProgress,
  runFreshSandboxTask,
  runSandboxTask,
  seedSandboxDatabase,
  validateSandboxQuery,
  validateSandboxSelect,
} from "../../src/lib/sql-sandbox.ts";
import type { SqlSandboxConfig, SqlSandboxTask } from "../../src/lib/interactive-lesson.ts";

const require = createRequire(import.meta.url);
const wasmPath = require.resolve("sql.js/dist/sql-wasm.wasm");
const SQL = await initSqlJs({ locateFile: () => wasmPath });

const config: SqlSandboxConfig = {
  tables: {
    users: {
      columns: [
        { name: "id", type: "INTEGER" },
        { name: "name", type: "TEXT" },
        { name: "email", type: "TEXT" },
      ],
      rows: [
        [1, "Анна", "anna@example.com"],
        [2, "Илья", "ilya@example.com"],
      ],
    },
  },
  tasks: [],
};

function db() {
  return new SQL.Database();
}

test("SQL sandbox defaults to SELECT only and blocks schema, transaction, and extension commands", () => {
  for (const sql of [
    "INSERT INTO users VALUES (3, 'x', 'x')",
    "UPDATE users SET name = 'x'",
    "DELETE FROM users",
    "DROP TABLE users",
    "ALTER TABLE users ADD COLUMN x",
    "CREATE TABLE x (id INTEGER)",
    "ATTACH DATABASE 'x' AS x",
    "PRAGMA table_info(users)",
    "SELECT 1; SELECT 2",
    "SELECT 1; DELETE FROM users",
    "WITH x AS (SELECT 1) SELECT * FROM x",
    "SELECT load_extension('x')",
    "WITH RECURSIVE loop(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM loop) SELECT x FROM loop",
    "SELECT randomblob(1000000000)",
  ]) {
    assert.equal(validateSandboxSelect(sql).valid, false, sql);
  }
  assert.equal(validateSandboxSelect("SELECT 'DROP; DELETE' AS message;").valid, true);
  assert.equal(validateSandboxSelect("SELECT 1 -- DELETE FROM users\n").valid, true);
});

test("SQL sandbox allows only explicitly whitelisted data mutations", () => {
  const writable = ["SELECT", "INSERT", "UPDATE", "DELETE"] as const;
  for (const sql of [
    "SELECT id FROM users",
    "INSERT INTO users VALUES (3, 'Вера', 'vera@example.com') RETURNING id",
    "UPDATE users SET name = 'Аня' WHERE id = 1 RETURNING name",
    "DELETE FROM users WHERE id = 2 RETURNING id",
  ]) {
    assert.equal(validateSandboxQuery(sql, writable).valid, true, sql);
  }

  for (const sql of [
    "INSERT INTO users VALUES (3, 'Вера', 'vera@example.com')",
    "REPLACE INTO users VALUES (3, 'Вера', 'vera@example.com')",
    "DELETE FROM users; SELECT 1",
    "UPDATE users SET name = 'x'; DROP TABLE users",
    "WITH target AS (SELECT 1) DELETE FROM users",
    "PRAGMA table_info(users)",
    "CREATE TABLE x (id INTEGER)",
  ]) {
    if (sql.startsWith("INSERT INTO")) {
      assert.equal(validateSandboxQuery(sql, writable).valid, true, sql);
    } else {
      assert.equal(validateSandboxQuery(sql, writable).valid, false, sql);
    }
  }

  assert.equal(
    validateSandboxQuery("DELETE FROM users", ["SELECT"]).valid,
    false,
    "existing SELECT-only lesson configs remain read-only",
  );
});

test("SQL sandbox accepts equivalent SELECTs regardless of aliases and output-column order", () => {
  const task: SqlSandboxTask = {
    id: "select-users",
    title: "Users",
    instruction: "Return name and email",
    expectedColumns: ["name", "email"],
    expectedRows: [
      ["Анна", "anna@example.com"],
      ["Илья", "ilya@example.com"],
    ],
  };
  const database = db();
  try {
    seedSandboxDatabase(database, config.tables);
    const result = runSandboxTask(
      database,
      "SELECT email AS contact, name AS full_name FROM users ORDER BY id",
      task,
    );
    assert.equal(result.passed, true);
    assert.deepEqual(result.columns, ["contact", "full_name"]);
    assert.equal(result.message, "Верно");
  } finally {
    database.close();
  }
});

test("SQL sandbox compares unordered rows as a multiset and ordered rows exactly", () => {
  const task: SqlSandboxTask = {
    id: "ids",
    title: "IDs",
    instruction: "Return both users",
    expectedColumns: ["id"],
    expectedRows: [[1], [2]],
    orderSensitive: true,
  };
  const database = db();
  try {
    seedSandboxDatabase(database, config.tables);
    assert.equal(runSandboxTask(database, "SELECT id FROM users ORDER BY id", task).passed, true);
    assert.equal(
      runSandboxTask(database, "SELECT id FROM users ORDER BY id DESC", task).passed,
      false,
    );
    assert.equal(
      runSandboxTask(database, "SELECT id FROM users ORDER BY id DESC", {
        ...task,
        orderSensitive: false,
      }).passed,
      true,
    );
    assert.equal(
      runSandboxTask(database, "SELECT id, name FROM users", task).passed,
      false,
      "extra column fails",
    );
    assert.equal(
      runSandboxTask(database, "SELECT id FROM users WHERE id=1", task).passed,
      false,
      "missing row fails",
    );
  } finally {
    database.close();
  }
});

test("SQLite errors are translated to Russian without exposing a solution query", () => {
  const task: SqlSandboxTask = {
    id: "x",
    title: "x",
    instruction: "x",
    expectedColumns: ["id"],
    expectedRows: [[1]],
  };
  const database = db();
  try {
    seedSandboxDatabase(database, config.tables);
    assert.match(runSandboxTask(database, "SELECT FROM", task).message, /синтаксическая ошибка/iu);
    assert.match(
      runSandboxTask(database, "SELECT * FROM missing_table", task).message,
      /Таблица «missing_table» не найдена/iu,
    );
    assert.match(
      runSandboxTask(database, "SELECT missing_column FROM users", task).message,
      /Неизвестный столбец/iu,
    );
  } finally {
    database.close();
  }
});

test("SQL feedback identifies the missing ORDER BY field and table schema", () => {
  const task: SqlSandboxTask = {
    id: "filter-users",
    title: "Filter users",
    instruction: "Select active users in id order",
    hint: "For sorting use ORDER BY id ASC.",
    expectedColumns: ["id", "name", "status"],
    expectedRows: [[1, "Анна", "active"]],
  };
  const database = db();
  try {
    seedSandboxDatabase(database, config.tables);
    const missingOrderColumn = runSandboxTask(
      database,
      "SELECT id, name FROM users WHERE id = 1 ORDER BY DESC",
      task,
      config,
    );
    assert.match(missingOrderColumn.message, /после ORDER BY указано DESC/iu);
    assert.match(missingOrderColumn.message, /ORDER BY id ASC/iu);

    const unknownColumn = runSandboxTask(database, "SELECT phone FROM users", task, config);
    assert.match(unknownColumn.message, /Неизвестный столбец «phone» в таблице «users»/iu);
    assert.match(unknownColumn.message, /id, name, email/iu);

    const unknownTable = runSandboxTask(database, "SELECT * FROM customers", task, config);
    assert.match(unknownTable.message, /Таблица «customers» не найдена/iu);
    assert.match(unknownTable.message, /users/iu);
  } finally {
    database.close();
  }
});

test("result feedback explains column and row-count mismatches", () => {
  const task: SqlSandboxTask = {
    id: "users",
    title: "Users",
    instruction: "Return two users",
    expectedColumns: ["id", "name"],
    expectedRows: [
      [1, "Анна"],
      [2, "Илья"],
    ],
  };
  const database = db();
  try {
    seedSandboxDatabase(database, config.tables);
    assert.match(
      runSandboxTask(database, "SELECT id FROM users", task, config).message,
      /вернул столбцов: 1.*ожидалось: 2.*id, name/iu,
    );
    assert.match(
      runSandboxTask(database, "SELECT id, name FROM users WHERE id = 1", task, config).message,
      /вернул строк: 1.*ожидалось: 2.*WHERE/iu,
    );
  } finally {
    database.close();
  }
});

test("successful empty DELETE results show clear feedback instead of an empty table", () => {
  const task: SqlSandboxTask = {
    id: "delete-order",
    title: "Удалить тестовый заказ",
    instruction: "Удали заказ.",
    expectedColumns: ["id"],
    expectedRows: [],
  };
  const emptyResult = { columns: ["id"], rows: [], passed: true, message: "Верно" };
  assert.equal(
    getSqlSandboxSuccessMessage(task, "DELETE FROM orders WHERE id = 105", emptyResult),
    "Заказ удалён",
  );
  assert.equal(
    getSqlSandboxSuccessMessage(task, "SELECT id FROM users WHERE id = 999", emptyResult),
    "Запрос верный. Строк не найдено.",
  );
  assert.equal(
    getSqlSandboxSuccessMessage(
      { ...task, successMessage: "Удаление подтверждено!" },
      "DELETE FROM orders WHERE id = 105",
      emptyResult,
    ),
    "Удаление подтверждено!",
  );
});

test("INSERT/UPDATE/DELETE RETURNING results are checked and each run starts from seed data", () => {
  const writableConfig: SqlSandboxConfig = {
    ...config,
    readOnly: false,
    allowStatements: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  };
  const insertTask: SqlSandboxTask = {
    id: "insert-user",
    title: "Add user",
    instruction: "Add a user and return their id",
    expectedColumns: ["id"],
    expectedRows: [[3]],
  };
  const updateTask: SqlSandboxTask = {
    id: "update-user",
    title: "Update user",
    instruction: "Rename user 1 and return the new name",
    expectedColumns: ["name"],
    expectedRows: [["Анна обновлена"]],
  };
  const deleteTask: SqlSandboxTask = {
    id: "delete-user",
    title: "Delete user",
    instruction: "Delete user 2 and return their id",
    expectedColumns: ["id"],
    expectedRows: [[2]],
  };

  for (const [sql, task] of [
    ["INSERT INTO users VALUES (3, 'Вера', 'vera@example.com') RETURNING id", insertTask],
    ["UPDATE users SET name = 'Анна обновлена' WHERE id = 1 RETURNING name", updateTask],
    ["DELETE FROM users WHERE id = 2 RETURNING id", deleteTask],
  ] as const) {
    const first = runFreshSandboxTask(writableConfig, sql, task, db);
    const second = runFreshSandboxTask(writableConfig, sql, task, db);
    assert.equal(first.passed, true, first.message);
    assert.equal(second.passed, true, "mutation is repeatable because each run reseeds SQLite");
  }

  const legacyReadOnly: SqlSandboxConfig = {
    ...writableConfig,
    readOnly: true,
  };
  const denied = runFreshSandboxTask(
    legacyReadOnly,
    "DELETE FROM users WHERE id = 2 RETURNING id",
    deleteTask,
    db,
  );
  assert.equal(denied.passed, false);
  assert.match(denied.message, /только команды: SELECT/iu);
});

test("INSERT/UPDATE/DELETE without RETURNING use a safe verification SELECT", () => {
  const writableConfig: SqlSandboxConfig = {
    ...config,
    readOnly: false,
    allowStatements: ["SELECT", "INSERT", "UPDATE", "DELETE"],
  };
  const cases: Array<[string, SqlSandboxTask, boolean]> = [
    [
      "INSERT INTO users VALUES (3, 'Вера', 'vera@example.com')",
      {
        id: "insert-user",
        title: "Add user",
        instruction: "Add user 3",
        expectedColumns: ["id", "name"],
        expectedRows: [[3, "Вера"]],
        verificationQuery: "SELECT id, name FROM users WHERE id = 3",
      },
      true,
    ],
    [
      "UPDATE users SET name = 'Анна обновлена' WHERE id = 1",
      {
        id: "update-user",
        title: "Update user",
        instruction: "Rename user 1",
        expectedColumns: ["id", "name"],
        expectedRows: [[1, "Анна обновлена"]],
        verificationQuery: "SELECT id, name FROM users WHERE id = 1",
      },
      true,
    ],
    [
      "DELETE FROM users WHERE id = 2",
      {
        id: "delete-user",
        title: "Delete user",
        instruction: "Delete user 2",
        expectedColumns: ["id"],
        expectedRows: [],
        verificationQuery: "SELECT id FROM users WHERE id = 2",
      },
      true,
    ],
  ];

  for (const [sql, task, expected] of cases) {
    const result = runFreshSandboxTask(writableConfig, sql, task, db);
    assert.equal(result.passed, expected, result.message);
  }

  const incorrectInsert = runFreshSandboxTask(
    writableConfig,
    "INSERT INTO users VALUES (3, 'Неверно', 'wrong@example.com')",
    cases[0]![1],
    db,
  );
  assert.equal(incorrectInsert.passed, false);
  assert.match(incorrectInsert.message, /значения отличаются/iu);
  assert.equal(incorrectInsert.message.includes(cases[0]![1].verificationQuery!), false);

  const unsafeTask: SqlSandboxTask = {
    id: "unsafe-verifier",
    title: "Unsafe verifier",
    instruction: "Must not run a mutation as a verifier",
    expectedColumns: ["id"],
    expectedRows: [],
    verificationQuery: "DELETE FROM users WHERE id = 2",
  };
  const unsafe = runFreshSandboxTask(
    writableConfig,
    "DELETE FROM users WHERE id = 2",
    unsafeTask,
    db,
  );
  assert.equal(unsafe.passed, false);
  assert.match(unsafe.message, /Не удалось проверить результат изменения/iu);

  const missingVerifier = runFreshSandboxTask(
    writableConfig,
    "DELETE FROM users WHERE id = 2",
    { ...unsafeTask, verificationQuery: undefined },
    db,
  );
  assert.match(missingVerifier.message, /не настроен\. Сообщи наставнику/iu);
});

test("fresh runs rebuild seed data and saved attempts restore 0/N through N/N completion", () => {
  const task: SqlSandboxTask = {
    id: "all-users",
    title: "Users",
    instruction: "Return users",
    expectedColumns: ["id"],
    expectedRows: [[1], [2]],
  };
  const result = runFreshSandboxTask(config, "SELECT id FROM users", task, db);
  assert.equal(result.passed, true);
  const tasks = [
    task,
    { ...task, id: "t2" },
    { ...task, id: "t3" },
    { ...task, id: "t4" },
    { ...task, id: "t5" },
  ];
  assert.deepEqual(getSqlSandboxProgress(tasks, []), { completed: 0, total: 5, isComplete: false });
  const persisted = tasks.slice(0, 4).map((entry) => ({ task_id: entry.id, passed: true }));
  assert.deepEqual(getSqlSandboxProgress(tasks, persisted), {
    completed: 4,
    total: 5,
    isComplete: false,
  });
  assert.deepEqual(getSqlSandboxProgress(tasks, [...persisted, { task_id: "t5", passed: true }]), {
    completed: 5,
    total: 5,
    isComplete: true,
  });
  assert.deepEqual(getSqlSandboxProgress(tasks, [...persisted, { task_id: "t5", passed: false }]), {
    completed: 4,
    total: 5,
    isComplete: false,
  });
});

import assert from "node:assert/strict";
import test from "node:test";
import {
  createAiKitFiles,
  createZip,
  exportLessonPackage,
  importLessonPackage,
  parseLessonPackageJson,
  validateLessonPackage,
} from "../../src/lib/lesson-package.ts";
import type { LessonBlockDraft } from "../../src/lib/interactive-lesson.ts";
import { blockCompletionCondition } from "../../src/lib/interactive-lesson.ts";
import {
  createEmptySqlSandbox,
  createSqlSandboxTaskId,
  validateSqlSandboxEditor,
} from "../../src/lib/sql-sandbox-editor.ts";

type MutablePackage = {
  schemaVersion: string;
  lesson: { blocks: Record<string, unknown>[] };
};

const lesson = {
  day_number: 42,
  title: "Проверка формата",
  description: "Тестовый урок для обратимого импорта.",
  video_url: null,
  content_md: "",
  homework_md: "",
};

const allBlockTypes: LessonBlockDraft[] = [
  { block_type: "heading", content: { title: "Раздел", revision: 1 } },
  { block_type: "text", content: { markdown: "Текст" } },
  { block_type: "definition", content: { term: "Термин", text: "Определение" } },
  { block_type: "important", content: { title: "Важно", text: "Мысль" } },
  {
    block_type: "guide",
    content: { variant: "question", title: "Подсказка", text: "Смотри на правило." },
  },
  {
    block_type: "example",
    content: { title: "Пример", expected: "А", actual: "Б", conclusion: "В" },
  },
  { block_type: "diagram", content: { title: "Схема", steps: ["Первый", "Второй"] } },
  {
    block_type: "state_diagram",
    content: {
      title: "Статусы заказа",
      states: [
        { id: "created", label: "Создан" },
        { id: "paid", label: "Оплачен" },
        { id: "cancelled", label: "Отменён" },
      ],
      transitions: [
        { from: "created", to: "paid", label: "Оплата прошла" },
        { from: "created", to: "cancelled", label: "Заказ отменён" },
      ],
      initialState: "created",
      finalStates: ["cancelled"],
    },
  },
  {
    block_type: "table",
    content: {
      title: "Решения",
      columns: [
        { id: "condition", label: "Условие" },
        { id: "result", label: "Результат" },
      ],
      rows: [
        { condition: "Да", result: "Выполнить" },
        { condition: "Нет", result: "Не выполнять" },
      ],
    },
  },
  {
    block_type: "image",
    content: { url: "https://example.com/image.png", alt: "Пример", caption: "Подпись" },
  },
  {
    block_type: "video",
    content: { title: "Видео", description: "Заглушка до добавления ролика" },
  },
  {
    block_type: "question",
    content: {
      questionType: "single_choice",
      question: "Вопрос",
      options: ["Да", "Нет"],
      correctIndex: 0,
      explanation: "Разбор",
    },
  },
  {
    block_type: "question",
    content: {
      questionType: "multiple_choice",
      question: "Вопрос",
      options: ["А", "Б", "В"],
      correctAnswers: [0, 2],
      explanation: "Разбор",
    },
  },
  {
    block_type: "question",
    content: {
      questionType: "true_false",
      question: "Верно?",
      options: ["Верно", "Неверно"],
      correctIndex: 0,
      explanation: "Разбор",
    },
  },
  {
    block_type: "question",
    content: {
      questionType: "scenario",
      question: "Ситуация",
      options: ["А", "Б"],
      correctIndex: 1,
      explanation: "Разбор",
    },
  },
  {
    block_type: "reflection",
    content: { prompt: "О чём подумать?", hint: "Напиши идею.", feedback: "Хорошее начало." },
  },
  {
    block_type: "visual_choice",
    content: {
      title: "Форма",
      prompt: "Что проверить?",
      options: ["Поля", "Погоду"],
      correctAnswers: [0],
      explanation: "Разбор",
    },
  },
  { block_type: "code", content: { language: "http", code: "GET /api" } },
  {
    block_type: "summary",
    content: { title: "Итог", items: [["Термин", "Определение"]], points: ["Главная мысль"] },
  },
  {
    block_type: "homework",
    content: { title: "Практика", instruction: "Сделай задание.", submitHint: "Отправь ответ." },
  },
  {
    block_type: "homework",
    content: {
      title: "SQL-практика",
      instruction: "Выполни задания в учебной базе.",
      mode: "sql_sandbox",
      manualReview: false,
      required: true,
      blocksNext: true,
      homeworkRequiredForCompletion: true,
      completionCondition: "all_sql_tasks_passed",
      sqlSandboxCompletionMessage: "Все задания выполнены. Молодец!",
      sandbox: {
        engine: "sqlite",
        readOnly: false,
        allowStatements: ["SELECT", "INSERT", "UPDATE", "DELETE"],
        resetDatabaseBeforeEachRun: true,
        tables: {
          users: {
            columns: [
              { name: "id", type: "INTEGER" },
              { name: "name", type: "TEXT" },
            ],
            rows: [[1, "Анна"]],
          },
        },
        tasks: [
          {
            id: "one",
            title: "Все пользователи",
            instruction: "Покажи пользователей.",
            successMessage: "Запрос выполнен успешно.",
            starterSql: "SELECT id, name FROM users;",
            verificationQuery: "SELECT id, name FROM users WHERE id = 1",
            expectedColumns: ["id", "name"],
            expectedRows: [[1, "Анна"]],
          },
        ],
      },
    },
  },
];

test("export → validate → import keeps every supported block without database IDs", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const validation = validateLessonPackage(exported);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;
  const imported = importLessonPackage(validation.value);
  assert.equal(imported.blocks.length, allBlockTypes.length);
  assert.equal(imported.blocks[4].block_type, "guide");
  assert.equal(imported.blocks[4].content.variant, "question");
  assert.equal(
    JSON.stringify(exportLessonPackage({ ...lesson, ...imported.lesson }, imported.blocks)),
    JSON.stringify(exported),
  );
  assert.equal(JSON.stringify(exported).includes("lesson_id"), false);
  assert.equal(JSON.stringify(exported).includes('"block_id"'), false);
});

test("final quiz block round-trips only in Day 14 and rejects duplicates", () => {
  const dayFourteen = { ...lesson, day_number: 14 };
  const quizBlocks: LessonBlockDraft[] = [{ block_type: "final_quiz", content: {} }];
  const exported = exportLessonPackage(dayFourteen, quizBlocks);
  const valid = validateLessonPackage(exported);
  assert.equal(valid.valid, true);
  if (!valid.valid) return;
  assert.equal(importLessonPackage(valid.value).blocks[0]?.block_type, "final_quiz");

  const wrongDay = exportLessonPackage({ ...lesson, day_number: 13 }, quizBlocks);
  const wrongDayValidation = validateLessonPackage(wrongDay);
  assert.equal(wrongDayValidation.valid, false);
  if (!wrongDayValidation.valid)
    assert.ok(
      wrongDayValidation.errors.some((entry) => entry.message.includes("только в День 14")),
    );

  const duplicate = exportLessonPackage(dayFourteen, [...quizBlocks, ...quizBlocks]);
  const duplicateValidation = validateLessonPackage(duplicate);
  assert.equal(duplicateValidation.valid, false);
  if (!duplicateValidation.valid)
    assert.ok(
      duplicateValidation.errors.some((entry) => entry.message.includes("только один блок")),
    );
});

test("validator reports malformed JSON structures, unknown fields and suggestions", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const broken = structuredClone(exported) as unknown as MutablePackage;
  broken.lesson.blocks[0].type = "quiz_multi";
  broken.lesson.blocks[1].unknownSetting = true;
  const result = validateLessonPackage(broken);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((entry) => /неизвестный тип/.test(entry.message)));
    assert.ok(result.errors.some((entry) => /неизвестное поле/.test(entry.message)));
  }
});

test("validator rejects missing fields, unknown character and old versions", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const broken = structuredClone(exported) as unknown as MutablePackage;
  broken.schemaVersion = "0.9";
  broken.lesson.blocks[2].text = "";
  broken.lesson.blocks[4].character = "character_api";
  const result = validateLessonPackage(broken);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((entry) => entry.message.includes("schemaVersion")));
    assert.ok(result.errors.some((entry) => entry.message.includes("text")));
    assert.ok(result.errors.some((entry) => entry.message.includes("персонажа")));
  }
});

test("validator rejects invalid state diagram references and table cells", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const broken = structuredClone(exported) as unknown as MutablePackage;
  const stateDiagram = broken.lesson.blocks.find((block) => block.type === "state_diagram")!;
  const table = broken.lesson.blocks.find((block) => block.type === "table")!;
  stateDiagram.transitions = [{ from: "created", to: "missing" }];
  table.rows = [{ condition: "Да", unknown: "Нет" }];
  const result = validateLessonPackage(broken);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((entry) => entry.message.includes("несуществующее состояние")));
    assert.ok(result.errors.some((entry) => entry.message.includes("ячейки")));
  }
});

test("SQL sandbox package validates and keeps its complete config through export/import round trip", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const validation = validateLessonPackage(exported);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;
  const imported = importLessonPackage(validation.value);
  const homework = imported.blocks.find((block) => block.content.mode === "sql_sandbox");
  assert.ok(homework);
  assert.equal(homework?.content.manualReview, false);
  assert.equal(homework?.content.completionCondition, "all_sql_tasks_passed");
  assert.equal(homework?.content.sqlSandboxCompletionMessage, "Все задания выполнены. Молодец!");
  assert.deepEqual(
    homework?.content.sandbox,
    exported.lesson.blocks.find((block) => block.mode === "sql_sandbox")?.sandbox,
  );
  assert.equal(
    (homework?.content.sandbox as { tasks: Array<{ starterSql?: string }> }).tasks[0]?.starterSql,
    "SELECT id, name FROM users;",
  );
  assert.equal(
    (homework?.content.sandbox as { tasks: Array<{ verificationQuery?: string }> }).tasks[0]
      ?.verificationQuery,
    "SELECT id, name FROM users WHERE id = 1",
  );
  assert.equal(
    (homework?.content.sandbox as { tasks: Array<{ successMessage?: string }> }).tasks[0]
      ?.successMessage,
    "Запрос выполнен успешно.",
  );
  const aiKit = createAiKitFiles(validation.value, "guidelines");
  assert.match(aiKit["lesson-schema.json"], /sqlSandboxCompletionMessage/);
  const again = exportLessonPackage({ ...lesson, ...imported.lesson }, imported.blocks);
  assert.deepEqual(again, exported);
});

test("SQL sandbox accepts verificationQuery only as a safe single SELECT and documents it for AI", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const task = exported.lesson.blocks.find((block) => block.mode === "sql_sandbox")?.sandbox as {
    tasks: Array<Record<string, unknown>>;
  };
  task.tasks[0]!.verificationQuery = "SELECT id FROM users WHERE id = 1";
  const valid = validateLessonPackage(exported);
  assert.equal(valid.valid, true);
  if (valid.valid) {
    const aiKit = createAiKitFiles(valid.value, "guidelines");
    assert.match(aiKit["README.md"], /verificationQuery/);
    assert.match(aiKit["README.md"], /одиночный SELECT/);
    assert.match(aiKit["lesson-schema.json"], /verificationQuery/);
  }

  for (const query of ["DELETE FROM users", "SELECT 1; SELECT 2", "PRAGMA table_info(users)"]) {
    const broken = structuredClone(exported);
    const brokenTask = broken.lesson.blocks.find((block) => block.mode === "sql_sandbox")
      ?.sandbox as { tasks: Array<Record<string, unknown>> };
    brokenTask.tasks[0]!.verificationQuery = query;
    const result = validateLessonPackage(broken);
    assert.equal(result.valid, false, query);
    if (!result.valid)
      assert.ok(result.errors.some((entry) => entry.message.includes("verificationQuery")));
  }
});

test("SQL sandbox package rejects malformed expected result dimensions and duplicate task ids", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const broken = structuredClone(exported) as unknown as MutablePackage;
  const homework = broken.lesson.blocks.find(
    (block) => block.type === "homework" && block.mode === "sql_sandbox",
  )!;
  const sandbox = homework.sandbox as { tasks: Array<Record<string, unknown>> };
  sandbox.tasks.push({
    ...sandbox.tasks[0],
    title: "Другое",
    id: sandbox.tasks[0]?.id,
    expectedColumns: ["id", "name"],
    expectedRows: [[1]],
  });
  const result = validateLessonPackage(broken);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((entry) => entry.message.includes("уникальными")));
    assert.ok(result.errors.some((entry) => entry.message.includes("expectedRows")));
  }
});

test("SQL sandbox package has no fixed eight-task progress limit", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const many = structuredClone(exported) as unknown as MutablePackage;
  const homework = many.lesson.blocks.find(
    (block) => block.type === "homework" && block.mode === "sql_sandbox",
  )!;
  const sandbox = homework.sandbox as { tasks: Array<Record<string, unknown>> };
  const task = sandbox.tasks[0]!;
  sandbox.tasks = Array.from({ length: 25 }, (_, index) => ({
    ...task,
    id: `task-${index + 1}`,
  }));
  assert.equal(validateLessonPackage(many).valid, true);
});

test("SQL sandbox admin model supports arbitrary result dimensions and catches blocking editor issues", () => {
  const sandbox = createEmptySqlSandbox();
  sandbox.tasks = [
    {
      id: createSqlSandboxTaskId(),
      title: "JOIN результат",
      instruction: "Верни ровно пять строк и два столбца.",
      expectedColumns: ["user_name", "order_total"],
      expectedRows: [
        ["Анна", 10],
        ["Борис", 20],
        ["Вера", 30],
        ["Глеб", 40],
        ["Дина", 50],
      ],
      orderSensitive: false,
      starterSql:
        "SELECT users.name, orders.total FROM users JOIN orders ON orders.user_id = users.id;",
    },
  ];
  assert.deepEqual(validateSqlSandboxEditor(sandbox), []);

  sandbox.tasks = Array.from({ length: 25 }, (_, index) => ({
    id: createSqlSandboxTaskId(),
    title: `Задание ${index + 1}`,
    instruction: "Верни пять строк и два столбца.",
    expectedColumns: ["user_name", "order_total"],
    expectedRows: [
      ["Анна", 10],
      ["Борис", 20],
      ["Вера", 30],
      ["Глеб", 40],
      ["Дина", 50],
    ],
  }));
  assert.deepEqual(validateSqlSandboxEditor(sandbox), []);

  sandbox.tasks.push({ ...sandbox.tasks[0]!, title: "Другой запрос" });
  const errors = validateSqlSandboxEditor(sandbox);
  assert.ok(errors.some((message) => message.includes("ID заданий")));

  sandbox.tasks[1]!.id = createSqlSandboxTaskId();
  sandbox.tasks[1]!.expectedRows = [["лишняя ячейка"]];
  const malformed = validateSqlSandboxEditor(sandbox);
  assert.ok(malformed.some((message) => message.includes("expectedRows")));
});

test("SQL sandbox validator keeps reset safety and rejects unknown sandbox fields", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const broken = structuredClone(exported) as unknown as MutablePackage;
  const homework = broken.lesson.blocks.find((block) => block.mode === "sql_sandbox")!;
  (homework.sandbox as Record<string, unknown>).resetDatabaseBeforeEachRun = false;
  (homework.sandbox as Record<string, unknown>).connectionString = "production";
  const result = validateLessonPackage(broken);
  assert.equal(result.valid, false);
  if (!result.valid) {
    assert.ok(result.errors.some((entry) => entry.message.includes("resetDatabaseBeforeEachRun")));
    assert.ok(result.errors.some((entry) => entry.message.includes("connectionString")));
  }
});

test("SQL sandbox package accepts CRUD allowlists and preserves legacy SELECT-only configs", () => {
  const writable = exportLessonPackage(lesson, allBlockTypes);
  const writableValidation = validateLessonPackage(writable);
  assert.equal(writableValidation.valid, true);

  const legacy = structuredClone(writable) as unknown as MutablePackage;
  const homework = legacy.lesson.blocks.find((block) => block.mode === "sql_sandbox")!;
  const sandbox = homework.sandbox as Record<string, unknown>;
  sandbox.readOnly = true;
  sandbox.allowStatements = ["SELECT"];
  const legacyValidation = validateLessonPackage(legacy);
  assert.equal(legacyValidation.valid, true);

  const contradictory = structuredClone(writable) as unknown as MutablePackage;
  const contradictoryHomework = contradictory.lesson.blocks.find(
    (block) => block.mode === "sql_sandbox",
  )!;
  const contradictorySandbox = contradictoryHomework.sandbox as Record<string, unknown>;
  contradictorySandbox.readOnly = true;
  const contradictoryValidation = validateLessonPackage(contradictory);
  assert.equal(contradictoryValidation.valid, false);
  if (!contradictoryValidation.valid) {
    assert.ok(contradictoryValidation.errors.some((entry) => entry.message.includes("readOnly")));
  }
});

test("manual homework completion contract is unchanged while SQL homework has its own condition", () => {
  assert.equal(
    blockCompletionCondition({ block_type: "homework", content: { title: "Manual" } }),
    "homework_submitted",
  );
  assert.equal(
    blockCompletionCondition({
      block_type: "homework",
      content: { mode: "manual", completionCondition: "homework_submitted" },
    }),
    "homework_submitted",
  );
  assert.equal(
    blockCompletionCondition({
      block_type: "homework",
      content: { mode: "sql_sandbox", completionCondition: "all_sql_tasks_passed" },
    }),
    "all_sql_tasks_passed",
  );
});

test("validator accepts a large lesson and repeated imports stay independent", () => {
  const exported = exportLessonPackage(
    lesson,
    Array.from({ length: 180 }, (_, index) => ({
      block_type: "text",
      content: { markdown: `Абзац ${index}` },
    })),
  );
  const validation = validateLessonPackage(exported);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;
  const first = importLessonPackage(validation.value);
  const second = importLessonPackage(validation.value);
  first.blocks[0].content.markdown = "Изменено";
  assert.equal(second.blocks[0].content.markdown, "Абзац 0");
});

test("export migrates a legacy one-answer question without changing the source block", () => {
  const legacyQuestion: LessonBlockDraft[] = [
    {
      block_type: "question",
      content: {
        question: "Какой результат ожидается?",
        options: ["Первый", "Второй"],
        correctIndex: 0,
        explanation: "Разбор",
      },
    },
  ];
  const exported = exportLessonPackage(lesson, legacyQuestion);
  assert.equal(exported.lesson.blocks[0].questionType, "single_choice");
  assert.equal(legacyQuestion[0].content.questionType, undefined);
  assert.equal(validateLessonPackage(exported).valid, true);
});

test("import repairs legacy display-style day values from exported files", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const numeric = JSON.stringify(exported);
  const unquotedDay = numeric.replace('"day":42', '"day":42 из 14');
  const parsedUnquoted = parseLessonPackageJson(unquotedDay);
  assert.equal((parsedUnquoted as { lesson: { day: number } }).lesson.day, 42);
  assert.equal(validateLessonPackage(parsedUnquoted).valid, true);

  const quotedDay = JSON.stringify({
    ...exported,
    lesson: { ...exported.lesson, day: "42 из 14" },
  });
  const parsedQuoted = parseLessonPackageJson(quotedDay);
  assert.equal((parsedQuoted as { lesson: { day: number } }).lesson.day, 42);
  assert.equal(validateLessonPackage(parsedQuoted).valid, true);
});

test("import separates a legacy homework guide into its own guide block", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const packageWithLegacyHomework = structuredClone(exported) as unknown as MutablePackage;
  const homework = packageWithLegacyHomework.lesson.blocks.find(
    (block) => block.type === "homework",
  )!;
  homework.guideTitle = "Сначала попробуй сам";
  homework.guideText = "Примени материал на знакомом сервисе.";
  homework.guideVariant = "task";

  const parsed = parseLessonPackageJson(JSON.stringify(packageWithLegacyHomework));
  const validation = validateLessonPackage(parsed);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;

  const imported = importLessonPackage(validation.value);
  const homeworkIndex = imported.blocks.findIndex((block) => block.block_type === "homework");
  assert.equal(imported.blocks[homeworkIndex - 1].block_type, "guide");
  assert.equal(imported.blocks[homeworkIndex - 1].content.title, "Сначала попробуй сам");
  assert.equal(imported.blocks[homeworkIndex - 1].content.variant, "task");
  assert.equal(imported.blocks[homeworkIndex].content.guideTitle, undefined);
});

test("import ignores legacy homework submitHint and exports never recreate it", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const legacy = structuredClone(exported) as unknown as MutablePackage;
  const homework = legacy.lesson.blocks.find((block) => block.type === "homework")!;
  homework.submitHint = "Старое поле";

  const parsed = parseLessonPackageJson(JSON.stringify(legacy));
  const validation = validateLessonPackage(parsed);
  assert.equal(validation.valid, true);
  if (!validation.valid) return;

  const imported = importLessonPackage(validation.value);
  const importedHomework = imported.blocks.find((block) => block.block_type === "homework");
  assert.equal(importedHomework?.content.submitHint, undefined);

  const reExported = exportLessonPackage(lesson, imported.blocks);
  assert.equal(
    "submitHint" in reExported.lesson.blocks.find((block) => block.type === "homework")!,
    false,
  );
});

test("AI kit contains the specification, Day 1 example slots and a valid ZIP", () => {
  const exported = exportLessonPackage(lesson, allBlockTypes);
  const files = createAiKitFiles(exported, "# Правила");
  assert.match(files["README.md"]!, /sql_sandbox/);
  assert.match(files["README.md"]!, /SELECT, INSERT, UPDATE, DELETE/);
  assert.match(files["README.md"]!, /Ограничения импорта/);
  assert.match(files["README.md"]!, /от 1 до 10 колонок/);
  assert.match(files["README.md"]!, /не более 30 строк/);
  assert.match(files["README.md"]!, /минимум два варианта/);
  assert.match(files["lesson-schema.json"]!, /SqlSandboxConfig|tables/);
  assert.match(files["lesson-schema.json"]!, /"INSERT"/);
  assert.match(files["lesson-schema.json"]!, /"DELETE"/);
  assert.match(files["lesson-schema.json"]!, /"maxItems": 10/);
  assert.match(files["lesson-schema.json"]!, /"maxItems": 30/);
  assert.match(files["lesson-schema.json"]!, /"allOf"/);
  type SchemaNode = {
    type?: string;
    const?: string;
    maxItems?: number;
    minItems?: number;
    items?: SchemaNode;
    properties?: Record<string, SchemaNode>;
    allOf?: unknown[];
    oneOf?: SchemaNode[];
  };
  const schema = JSON.parse(files["lesson-schema.json"]!) as SchemaNode;
  const variants = schema.properties?.lesson?.properties?.blocks?.items?.oneOf ?? [];
  const tableSchema = variants.find((variant) => variant.properties?.type?.const === "table");
  const stateDiagramSchema = variants.find(
    (variant) => variant.properties?.type?.const === "state_diagram",
  );
  const questionSchema = variants.find((variant) => variant.properties?.type?.const === "question");
  const summarySchema = variants.find((variant) => variant.properties?.type?.const === "summary");
  assert.equal(tableSchema?.properties.columns?.maxItems, 10);
  assert.equal(tableSchema?.properties.rows?.maxItems, 30);
  assert.equal(stateDiagramSchema?.properties.states?.minItems, 2);
  assert.ok(questionSchema?.allOf && questionSchema.allOf.length >= 3);
  assert.equal(summarySchema?.properties.items?.items?.type, "object");
  assert.deepEqual(Object.keys(files).sort(), [
    "LESSON_GUIDELINES.md",
    "README.md",
    "block-catalog.json",
    "character-catalog.json",
    "example-lesson.json",
    "lesson-schema.json",
  ]);
  const zip = createZip(files);
  assert.equal(String.fromCharCode(...zip.slice(0, 4)), "PK\u0003\u0004");
});

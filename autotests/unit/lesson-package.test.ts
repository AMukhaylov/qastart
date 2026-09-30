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

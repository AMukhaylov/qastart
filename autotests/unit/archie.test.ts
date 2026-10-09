import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_ARCHIE_GREETING_MESSAGES,
  DEFAULT_ARCHIE_MOTIVATION_MESSAGES,
  getArchieLessonMode,
  buildSafeLessonContext,
  normalizeArchieGreetingMessages,
  normalizeArchieMotivationMessages,
  pickArchieLessonCompletionMessage,
  pickArchieMotivationMessage,
  parseArchieAnswer,
  parseArchieModelOptions,
} from "../../src/lib/archie.ts";
import {
  decryptProviderKey,
  encryptProviderKey,
  maskProviderKey,
} from "../../src/server/archie-crypto.server.ts";

test("Archie greeting bubbles normalize editable text and keep safe defaults", () => {
  assert.deepEqual(normalizeArchieGreetingMessages(undefined), [
    ...DEFAULT_ARCHIE_GREETING_MESSAGES,
  ]);
  assert.deepEqual(normalizeArchieGreetingMessages(["  Привет!  ", "", "  Давай разберёмся. "]), [
    "Привет!",
    "Давай разберёмся.",
  ]);
  assert.equal(normalizeArchieGreetingMessages(["А".repeat(300)])[0].length, 240);
  assert.equal(
    normalizeArchieGreetingMessages(Array.from({ length: 12 }, (_, i) => `Фраза ${i}`)).length,
    8,
  );
  assert.deepEqual(normalizeArchieGreetingMessages(["", "   "]), [
    ...DEFAULT_ARCHIE_GREETING_MESSAGES,
  ]);
});

test("Archie motivation text is editable, bounded, deterministic, and falls back per category", () => {
  assert.deepEqual(normalizeArchieMotivationMessages(null), DEFAULT_ARCHIE_MOTIVATION_MESSAGES);
  const normalized = normalizeArchieMotivationMessages({ homeworkDoing: ["  Поддержка!  ", ""] });
  assert.deepEqual(normalized.homeworkDoing, ["Поддержка!"]);
  assert.deepEqual(normalized.courseComplete, DEFAULT_ARCHIE_MOTIVATION_MESSAGES.courseComplete);
  assert.equal(
    pickArchieMotivationMessage(normalized, "homeworkDoing", "same-event"),
    "Поддержка!",
  );
  assert.equal(
    normalizeArchieMotivationMessages({ homeworkDoing: ["x".repeat(500)] }).homeworkDoing[0].length,
    400,
  );
  assert.equal(
    normalizeArchieMotivationMessages({
      homeworkDoing: Array.from({ length: 10 }, (_, i) => `M${i}`),
    }).homeworkDoing.length,
    8,
  );
});

test("lesson-completion messages rotate between adjacent lessons", () => {
  const messages = normalizeArchieMotivationMessages({
    lessonComplete: ["Первая фраза", "Вторая фраза", "Третья фраза"],
  });
  assert.equal(pickArchieLessonCompletionMessage(messages, 1), "Первая фраза");
  assert.equal(pickArchieLessonCompletionMessage(messages, 2), "Вторая фраза");
  assert.equal(pickArchieLessonCompletionMessage(messages, 3), "Третья фраза");
  assert.equal(pickArchieLessonCompletionMessage(messages, 4), "Первая фраза");
});

const archieModeInput = {
  courseCompleted: false,
  lessonCompleted: false,
  hasHumanHomework: false,
  homeworkStatus: null as "pending" | "approved" | "rejected" | "awaiting_mentor" | null,
  blocks: [] as Array<{
    id: string;
    block_type: string;
    position: number;
    content: Record<string, unknown>;
  }>,
  completedBlockIds: new Set<string>(),
  passedSqlTaskIds: new Set<string>(),
};

test("Archie mode follows persisted homework and course states", () => {
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, lessonCompleted: true, hasHumanHomework: true }),
    "homework",
  );
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, homeworkStatus: "pending" }),
    "homework-pending",
  );
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, homeworkStatus: "awaiting_mentor" }),
    "homework-pending",
  );
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, homeworkStatus: "rejected" }),
    "homework-returned",
  );
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, homeworkStatus: "approved" }),
    "homework-approved",
  );
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, courseCompleted: true }),
    "course-complete",
  );
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, lessonCompleted: true }),
    "lesson-complete",
  );
});

test("Archie stays available during intermediate self-check questions", () => {
  const blocks = [
    { id: "read", block_type: "text", position: 1, content: {} },
    {
      id: "question",
      block_type: "question",
      position: 2,
      content: { completionCondition: "question_correct" },
    },
    {
      id: "later",
      block_type: "question",
      position: 3,
      content: { completionCondition: "question_correct" },
    },
  ];
  assert.equal(
    getArchieLessonMode({ ...archieModeInput, blocks, completedBlockIds: new Set(["read"]) }),
    "chat",
  );
  assert.equal(
    getArchieLessonMode({
      ...archieModeInput,
      blocks,
      completedBlockIds: new Set(["read", "question"]),
    }),
    "chat",
  );
  assert.equal(
    getArchieLessonMode({
      ...archieModeInput,
      blocks,
      completedBlockIds: new Set(["read", "question", "later"]),
    }),
    "chat",
  );
  assert.equal(
    getArchieLessonMode({
      ...archieModeInput,
      blocks: [blocks[0], { ...blocks[1], content: { completionCondition: "viewed" } }],
    }),
    "chat",
  );
});

test("Archie remains blocked during the final quiz", () => {
  assert.equal(
    getArchieLessonMode({
      ...archieModeInput,
      blocks: [{ id: "final", block_type: "final_quiz", position: 1, content: {} }],
    }),
    "checked-exercise",
  );
});

test("Archie blocks a human homework only after that homework becomes available", () => {
  const blocks = [
    { id: "reading", block_type: "text", position: 1, content: {} },
    {
      id: "homework",
      block_type: "homework",
      position: 2,
      content: { instruction: "Write a test" },
    },
  ];
  assert.equal(getArchieLessonMode({ ...archieModeInput, hasHumanHomework: true, blocks }), "chat");
  assert.equal(
    getArchieLessonMode({
      ...archieModeInput,
      hasHumanHomework: true,
      blocks,
      completedBlockIds: new Set(["reading"]),
    }),
    "homework",
  );
});

test("Archie context keeps public lesson content and strips answers/settings/hidden blocks", () => {
  const context = buildSafeLessonContext({
    title: "Основы проверки",
    description: "Изучим ожидаемый результат",
    content_md: "Основной материал курса",
    blocks: [
      { block_type: "heading", content: { title: "Проверка формы", id: "internal" } },
      {
        block_type: "definition",
        content: { term: "Дефект", text: "Несоответствие ожиданию", correctIndex: 3 },
      },
      {
        block_type: "question",
        content: {
          question: "Что верно?",
          options: ["A", "B"],
          correctIndex: 1,
          explanation: "Скрытый ответ",
        },
      },
      {
        block_type: "homework",
        content: { instruction: "Активное ДЗ: секрет", sandbox: { answer: "DROP" } },
      },
      { block_type: "text", content: { markdown: "Скрытая часть", visible: false } },
      { block_type: "image", content: { data: "data:image/png;base64,SECRETBASE64" } },
      {
        block_type: "table",
        content: {
          title: "Статусы",
          columns: [{ id: "name", label: "Название" }],
          rows: [{ name: "Новый" }],
          metadata: "internal",
        },
      },
    ],
  });

  assert.match(context, /Урок: Основы проверки/);
  assert.match(context, /Несоответствие ожиданию/);
  assert.match(context, /Название/);
  assert.match(context, /Новый/);
  for (const forbidden of [
    "correctIndex",
    "Скрытый ответ",
    "Активное ДЗ",
    "DROP",
    "Скрытая часть",
    "SECRETBASE64",
    "internal",
  ]) {
    assert.equal(context.includes(forbidden), false, `Context should not contain ${forbidden}`);
  }
});

test("Archie context ignores unknown block types and limits total length", () => {
  const context = buildSafeLessonContext({
    title: "Урок",
    blocks: [
      { block_type: "internal_settings", content: { prompt: "must not appear" } },
      { block_type: "text", content: { markdown: "А".repeat(9000) } },
    ],
  });
  assert.equal(context.includes("must not appear"), false);
  assert.ok(context.length <= 18000);
});

test("Archie structured answers are parsed and invalid shapes fall back safely", () => {
  assert.deepEqual(
    parseArchieAnswer('{"type":"hint","answer":"Попробуй проверить пустое поле."}'),
    {
      type: "hint",
      answer: "Попробуй проверить пустое поле.",
    },
  );
  assert.deepEqual(
    parseArchieAnswer('```json\n{"type":"off_topic","answer":"Короткий ответ"}\n```'),
    {
      type: "off_topic",
      answer: "Короткий ответ",
    },
  );
  assert.deepEqual(parseArchieAnswer("Обычный ответ без JSON"), {
    type: "lesson",
    answer: "Обычный ответ без JSON",
  });
  assert.deepEqual(parseArchieAnswer('{"type":"secret","answer":"x"}'), {
    type: "lesson",
    answer: '{"type":"secret","answer":"x"}',
  });
});

test("OpenRouter model catalog is parsed and free models appear first", () => {
  const options = parseArchieModelOptions("openrouter", {
    data: [
      { id: "paid/model", name: "Paid Model", pricing: { prompt: "0.1", completion: "0.2" } },
      { id: "free/model", name: "Free Model", pricing: { prompt: "0", completion: "0" } },
      { name: "Missing ID" },
    ],
  });

  assert.deepEqual(options, [
    { id: "free/model", name: "Free Model", free: true, pricing: "Бесплатно" },
    {
      id: "paid/model",
      name: "Paid Model",
      free: false,
      pricing: "Вход $0.1/токен · выход $0.2/токен",
    },
  ]);
});

test("provider API keys are AES-GCM encrypted, masked, and decrypt only with the server secret", () => {
  const originalKey = process.env.ARCHIE_ENCRYPTION_KEY;
  process.env.ARCHIE_ENCRYPTION_KEY = "archie-test-encryption-key-that-is-long-enough";
  try {
    const apiKey = "sk-secret-provider-key-123456";
    const encrypted = encryptProviderKey(apiKey);
    assert.notEqual(encrypted, apiKey);
    assert.equal(encrypted.includes(apiKey), false);
    assert.equal(decryptProviderKey(encrypted), apiKey);
    assert.equal(maskProviderKey(apiKey), "••••••••456");
    process.env.ARCHIE_ENCRYPTION_KEY = "a-different-test-encryption-key-that-is-long-enough";
    assert.throws(() => decryptProviderKey(encrypted));
  } finally {
    if (originalKey === undefined) delete process.env.ARCHIE_ENCRYPTION_KEY;
    else process.env.ARCHIE_ENCRYPTION_KEY = originalKey;
  }
});

import assert from "node:assert/strict";
import test from "node:test";
import { buildSafeLessonContext, parseArchieAnswer } from "../../src/lib/archie.ts";
import {
  decryptProviderKey,
  encryptProviderKey,
  maskProviderKey,
} from "../../src/server/archie-crypto.server.ts";

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

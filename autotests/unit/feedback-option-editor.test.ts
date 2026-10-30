import assert from "node:assert/strict";
import test from "node:test";
import { parseFeedbackOptionLabels } from "../../src/lib/feedback-option-editor.ts";

test("label-only editor keeps internal values for existing feedback options", () => {
  assert.deepEqual(
    parseFeedbackOptionLabels("Слишком сложно\nСлишком легко\nНормально", [
      { label: "Слишком легко", value: "too_easy" },
      { label: "Нормально", value: "normal" },
      { label: "Сложно", value: "hard" },
      { label: "Слишком сложно", value: "too_hard" },
    ]),
    [
      { label: "Слишком сложно", value: "too_hard" },
      { label: "Слишком легко", value: "too_easy" },
      { label: "Нормально", value: "normal" },
    ],
  );
});

test("new options use their visible Russian label instead of a required English value", () => {
  assert.deepEqual(parseFeedbackOptionLabels("Да\nНе уверен(а)\nНет"), [
    { label: "Да", value: "Да" },
    { label: "Не уверен(а)", value: "Не уверен(а)" },
    { label: "Нет", value: "Нет" },
  ]);
});

test("label-only editor trims blanks and limits the option count", () => {
  assert.deepEqual(parseFeedbackOptionLabels("  Первый  \n\n Второй \nТретий", []), [
    { label: "Первый", value: "Первый" },
    { label: "Второй", value: "Второй" },
    { label: "Третий", value: "Третий" },
  ]);
  assert.equal(
    parseFeedbackOptionLabels(Array.from({ length: 25 }, (_, i) => `Вариант ${i + 1}`).join("\n"))
      .length,
    20,
  );
});

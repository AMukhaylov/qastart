export type LessonQuestionAnswerSnapshot = {
  questionText: string;
  options: string[];
  selectedIndexes: number[];
  correctIndexes: number[];
  isCorrect: boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function buildLessonQuestionAnswer(
  rawContent: unknown,
  rawSelectedIndexes: number[],
): LessonQuestionAnswerSnapshot {
  const content = asRecord(rawContent);
  const questionText = typeof content.question === "string" ? content.question.trim() : "";
  const rawOptions = Array.isArray(content.options) ? content.options : [];
  const options = rawOptions.filter((option): option is string => typeof option === "string");
  const rawCorrectIndexes = Array.isArray(content.correctAnswers)
    ? content.correctAnswers
    : typeof content.correctIndex === "number"
      ? [content.correctIndex]
      : [];
  const correctIndexes = rawCorrectIndexes.filter(
    (index): index is number => typeof index === "number" && Number.isInteger(index),
  );
  const selectedIndexes = [...rawSelectedIndexes].sort((left, right) => left - right);
  const normalizedCorrectIndexes = [...correctIndexes].sort((left, right) => left - right);
  const isMultipleChoice = content.questionType === "multiple_choice";

  if (
    !questionText ||
    options.length < 2 ||
    options.length !== rawOptions.length ||
    correctIndexes.length === 0 ||
    correctIndexes.length !== rawCorrectIndexes.length ||
    normalizedCorrectIndexes.length !== new Set(normalizedCorrectIndexes).size ||
    normalizedCorrectIndexes.some((index) => index < 0 || index >= options.length) ||
    selectedIndexes.length === 0 ||
    selectedIndexes.length !== new Set(selectedIndexes).size ||
    selectedIndexes.some((index) => index < 0 || index >= options.length) ||
    (!isMultipleChoice && selectedIndexes.length !== 1)
  ) {
    throw new Error("Некорректный ответ на вопрос");
  }

  return {
    questionText,
    options,
    selectedIndexes,
    correctIndexes: normalizedCorrectIndexes,
    isCorrect:
      selectedIndexes.length === normalizedCorrectIndexes.length &&
      selectedIndexes.every((index, position) => index === normalizedCorrectIndexes[position]),
  };
}

export function sameIndexes(left: number[], right: number[]) {
  return left.length === right.length && left.every((index, position) => index === right[position]);
}

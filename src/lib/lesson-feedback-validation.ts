export type FeedbackValidationQuestion = {
  id: string;
  type: "rating" | "textarea" | "radio";
  label: string;
  required: boolean;
  options?: { label: string; value: string }[];
};

export function getFeedbackCohortPolicy(enabled: boolean, isInOptionalGroup: boolean) {
  return { enabled, required: enabled && !isInOptionalGroup };
}

export function validateFeedbackAnswers(
  questions: FeedbackValidationQuestion[],
  answers: Record<string, string | number>,
):
  | { valid: true; rating: number; difficulty: string; comment: string | null }
  | { valid: false; error: string } {
  const ids = new Set<string>();
  for (const question of questions) {
    if (!question.id || ids.has(question.id))
      return { valid: false, error: "ID вопросов должны быть уникальными" };
    ids.add(question.id);
    if (!Object.prototype.hasOwnProperty.call(answers, question.id)) {
      if (question.required)
        return { valid: false, error: `Заполни обязательный вопрос: ${question.label}` };
      continue;
    }
    const value = answers[question.id];
    const empty = value === undefined || String(value).trim().length === 0;
    if (question.required && empty)
      return { valid: false, error: `Заполни обязательный вопрос: ${question.label}` };
    if (empty) continue;
    if (
      question.type === "rating" &&
      (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 10)
    ) {
      return { valid: false, error: "Оценка должна быть от 1 до 10" };
    }
    if (question.type === "textarea" && typeof value !== "string") {
      return { valid: false, error: `Ответ «${question.label}» должен быть текстом` };
    }
    if (question.type === "textarea" && question.required && String(value).trim().length < 3) {
      return {
        valid: false,
        error: `Ответ «${question.label}» должен содержать хотя бы 3 символа`,
      };
    }
    if (question.type === "radio" && !question.options?.some((option) => option.value === value)) {
      return { valid: false, error: `Выбери допустимый ответ: ${question.label}` };
    }
  }
  if (Object.keys(answers).some((id) => !ids.has(id))) {
    return { valid: false, error: "В ответе есть неизвестные поля" };
  }
  const ratingQuestion = questions.find((question) => question.type === "rating");
  const difficultyQuestion =
    questions.find(
      (question) => question.type === "radio" && question.id.toLowerCase().includes("difficult"),
    ) ??
    questions.find(
      (question) =>
        question.type === "radio" &&
        question.options?.some((option) =>
          ["too_easy", "normal", "hard", "too_hard"].includes(option.value),
        ),
    );
  const rating = Number(ratingQuestion ? answers[ratingQuestion.id] : NaN);
  const difficulty = String(difficultyQuestion ? answers[difficultyQuestion.id] : "");
  if (!Number.isInteger(rating) || rating < 1 || rating > 10)
    return { valid: false, error: "В обязательном опросе должна быть шкала оценки 1–10" };
  if (!["too_easy", "normal", "hard", "too_hard"].includes(difficulty))
    return { valid: false, error: "В опросе должен быть стандартный вопрос о сложности" };
  const comment = String(answers.comment ?? "").trim() || null;
  return { valid: true, rating, difficulty, comment };
}

export function canSubmitLessonFeedback(input: {
  enabled: boolean;
  requiredBlocksComplete: boolean;
  homeworkExists: boolean;
  homeworkAccepted: boolean;
  alreadySubmitted: boolean;
}) {
  return (
    input.enabled &&
    input.requiredBlocksComplete &&
    (!input.homeworkExists || input.homeworkAccepted) &&
    !input.alreadySubmitted
  );
}

export function canSkipLessonFeedback(input: {
  enabled: boolean;
  required: boolean;
  groupAllowsSkip: boolean;
  requiredBlocksComplete: boolean;
  homeworkExists: boolean;
  homeworkAccepted: boolean;
  alreadySubmitted: boolean;
  alreadySkipped: boolean;
}) {
  return (
    input.enabled &&
    input.groupAllowsSkip &&
    input.requiredBlocksComplete &&
    (!input.homeworkExists || input.homeworkAccepted) &&
    !input.alreadySubmitted &&
    !input.alreadySkipped
  );
}

import { z } from "zod";
import type { FinalQuizQuestion } from "./final-quiz.questions.ts";

const questionSchema = z.object({
  id: z.string().trim().min(1).max(100),
  topic: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(1200),
  options: z
    .array(
      z.object({ id: z.string().trim().min(1).max(50), text: z.string().trim().min(1).max(500) }),
    )
    .min(2)
    .max(8),
  correctOptionId: z.string().trim().min(1).max(50),
  explanation: z.string().trim().min(1).max(1500),
});

export function validateFinalQuizBank(value: unknown): FinalQuizQuestion[] {
  const parsed = z.array(questionSchema).length(90).safeParse(value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      issue
        ? `Банк должен содержать 90 корректно оформленных вопросов. ${issue.path.join(".")}: ${issue.message}`
        : "Банк должен содержать ровно 90 вопросов",
    );
  }

  const questionIds = new Set<string>();
  const normalizedPrompts = new Set<string>();
  for (const [index, question] of parsed.data.entries()) {
    if (questionIds.has(question.id)) throw new Error(`Повторяется ID вопроса: ${question.id}`);
    questionIds.add(question.id);

    const normalizedPrompt = question.text
      .toLocaleLowerCase("ru")
      .replace(/[\s\p{P}\p{S}]+/gu, " ")
      .trim();
    if (normalizedPrompts.has(normalizedPrompt))
      throw new Error(`Повторяется формулировка вопроса: ${question.text}`);
    normalizedPrompts.add(normalizedPrompt);

    const optionIds = new Set(question.options.map((option) => option.id));
    if (optionIds.size !== question.options.length) {
      throw new Error(`В вопросе ${index + 1} повторяется ID варианта ответа`);
    }
    if (!optionIds.has(question.correctOptionId)) {
      throw new Error(`В вопросе ${index + 1} правильный ответ отсутствует среди вариантов`);
    }
  }

  return parsed.data;
}

import { randomInt } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdForAccessToken } from "./admin-auth.server";
import { FINAL_QUIZ_QUESTIONS } from "./final-quiz.questions";

const QUIZ_DURATION_MS = 30 * 60 * 1000;
const PASSING_PERCENT = 70;
const MAX_ATTEMPTS = 2;

const accessTokenInput = z.object({
  accessToken: z.string().min(20),
  startNew: z.boolean().optional().default(false),
});
const attemptInput = accessTokenInput.extend({ attemptId: z.string().uuid() });
const answersInput = attemptInput.extend({
  answers: z.record(z.string().min(1), z.string().min(1)).default({}),
});

type QuizAttempt = {
  id: string;
  user_id: string;
  lesson_id: string;
  question_order: unknown;
  answers: unknown;
  score: number | null;
  percentage: number | null;
  passed: boolean | null;
  started_at: string;
  finished_at: string | null;
  timed_out: boolean;
};

type QuestionOrder = {
  questionIds: string[];
  optionIdsByQuestion: Record<string, string[]>;
};

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = randomInt(index + 1);
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function makeQuestionOrder(): QuestionOrder {
  const questionIds = shuffle(FINAL_QUIZ_QUESTIONS.map((question) => question.id));
  return {
    questionIds,
    optionIdsByQuestion: Object.fromEntries(
      FINAL_QUIZ_QUESTIONS.map((question) => [
        question.id,
        shuffle(question.options.map((option) => option.id)),
      ]),
    ),
  };
}

function parseQuestionOrder(value: unknown): QuestionOrder {
  const fallback = makeQuestionOrder();
  if (!value || typeof value !== "object" || Array.isArray(value)) return fallback;
  const parsed = value as Partial<QuestionOrder>;
  if (!Array.isArray(parsed.questionIds) || !parsed.optionIdsByQuestion) return fallback;
  if (parsed.questionIds.length !== FINAL_QUIZ_QUESTIONS.length) return fallback;
  return {
    questionIds: parsed.questionIds.filter((id): id is string => typeof id === "string"),
    optionIdsByQuestion: Object.fromEntries(
      Object.entries(parsed.optionIdsByQuestion).map(([questionId, optionIds]) => [
        questionId,
        Array.isArray(optionIds)
          ? optionIds.filter((id): id is string => typeof id === "string")
          : [],
      ]),
    ),
  };
}

function parseAnswers(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return {} as Record<string, string>;
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string",
    ),
  );
}

function visibleQuestions(order: QuestionOrder) {
  const byId = new Map(FINAL_QUIZ_QUESTIONS.map((question) => [question.id, question]));
  return order.questionIds.flatMap((questionId) => {
    const question = byId.get(questionId);
    if (!question) return [];
    const optionIds = order.optionIdsByQuestion[questionId] ?? [];
    const optionsById = new Map(question.options.map((option) => [option.id, option]));
    return [
      {
        id: question.id,
        topic: question.topic,
        text: question.text,
        options: optionIds.flatMap((optionId) => {
          const option = optionsById.get(optionId);
          return option ? [{ id: option.id, text: option.text }] : [];
        }),
      },
    ];
  });
}

function expiresAt(attempt: QuizAttempt) {
  return new Date(new Date(attempt.started_at).getTime() + QUIZ_DURATION_MS).toISOString();
}

function isExpired(attempt: QuizAttempt) {
  return Date.now() >= new Date(expiresAt(attempt)).getTime();
}

async function finalizeAttempt(attempt: QuizAttempt, timedOut: boolean) {
  if (attempt.finished_at) return attempt;

  const answers = parseAnswers(attempt.answers);
  const score = FINAL_QUIZ_QUESTIONS.reduce(
    (total, question) => total + Number(answers[question.id] === question.correctOptionId),
    0,
  );
  const percentage = Math.round((score / FINAL_QUIZ_QUESTIONS.length) * 100);
  const passed = percentage >= PASSING_PERCENT;
  const { data, error } = await supabaseAdmin
    .from("quiz_attempts")
    .update({
      score,
      percentage,
      passed,
      timed_out: timedOut || isExpired(attempt),
      finished_at: new Date().toISOString(),
    })
    .eq("id", attempt.id)
    .is("finished_at", null)
    .select("*")
    .single();
  if (error) throw error;

  const finished = data as QuizAttempt;
  if (finished.passed) {
    const { error: progressError } = await supabaseAdmin.from("lesson_progress").upsert(
      {
        user_id: finished.user_id,
        lesson_id: finished.lesson_id,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (progressError) throw progressError;
  }
  return finished;
}

async function closeExpiredAttempts(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", userId)
    .is("finished_at", null);
  if (error) throw error;
  for (const row of (data ?? []) as QuizAttempt[]) {
    if (isExpired(row)) await finalizeAttempt(row, true);
  }
}

async function getAttemptForUser(userId: string, attemptId: string) {
  const { data, error } = await supabaseAdmin
    .from("quiz_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .single();
  if (error) throw new Error("Попытка теста не найдена");
  return data as QuizAttempt;
}

async function quizResult(attempt: QuizAttempt, attemptsUsed: number) {
  const answers = parseAnswers(attempt.answers);
  const order = parseQuestionOrder(attempt.question_order);
  const byId = new Map(FINAL_QUIZ_QUESTIONS.map((question) => [question.id, question]));
  return {
    attemptId: attempt.id,
    score: attempt.score ?? 0,
    total: FINAL_QUIZ_QUESTIONS.length,
    percentage: attempt.percentage ?? 0,
    passed: Boolean(attempt.passed),
    timedOut: attempt.timed_out,
    attemptsUsed,
    attemptsLeft: Math.max(0, MAX_ATTEMPTS - attemptsUsed),
    review: order.questionIds.flatMap((questionId) => {
      const question = byId.get(questionId);
      if (!question) return [];
      const selectedOptionId = answers[question.id] ?? null;
      const selected = question.options.find((option) => option.id === selectedOptionId);
      const correct = question.options.find((option) => option.id === question.correctOptionId)!;
      return [
        {
          id: question.id,
          topic: question.topic,
          text: question.text,
          selectedOptionId,
          selectedOptionText: selected?.text ?? "Нет ответа",
          correctOptionId: correct.id,
          correctOptionText: correct.text,
          correct: selectedOptionId === correct.id,
          explanation: question.explanation,
        },
      ];
    }),
  };
}

export const startFinalQuiz = createServerFn({ method: "POST" })
  .inputValidator((data) => accessTokenInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    await closeExpiredAttempts(userId);

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id")
      .eq("day_number", 14)
      .single();
    if (lessonError || !lesson) throw new Error("Итоговый урок не найден");

    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("quiz_attempts")
      .select("*")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id)
      .order("started_at", { ascending: false });
    if (attemptsError) throw attemptsError;
    const allAttempts = (attempts ?? []) as QuizAttempt[];
    const active = allAttempts.find((attempt) => !attempt.finished_at);
    if (active) {
      return {
        status: "active" as const,
        attemptId: active.id,
        expiresAt: expiresAt(active),
        answers: parseAnswers(active.answers),
        questions: visibleQuestions(parseQuestionOrder(active.question_order)),
        attemptsUsed: allAttempts.filter((attempt) => attempt.finished_at).length,
        maxAttempts: MAX_ATTEMPTS,
      };
    }

    const completedAttempts = allAttempts.filter((attempt) => attempt.finished_at);
    if (
      completedAttempts.length >= MAX_ATTEMPTS ||
      (completedAttempts.length > 0 && !data.startNew)
    ) {
      return {
        status: "result" as const,
        result: await quizResult(completedAttempts[0], completedAttempts.length),
      };
    }

    if (!data.startNew) {
      return {
        status: "ready" as const,
        attemptsUsed: completedAttempts.length,
        maxAttempts: MAX_ATTEMPTS,
      };
    }

    const questionOrder = makeQuestionOrder();
    const { data: created, error: createError } = await supabaseAdmin
      .from("quiz_attempts")
      .insert({ user_id: userId, lesson_id: lesson.id, question_order: questionOrder, answers: {} })
      .select("*")
      .single();
    if (createError) throw createError;
    const attempt = created as QuizAttempt;
    return {
      status: "active" as const,
      attemptId: attempt.id,
      expiresAt: expiresAt(attempt),
      answers: {},
      questions: visibleQuestions(questionOrder),
      attemptsUsed: completedAttempts.length,
      maxAttempts: MAX_ATTEMPTS,
    };
  });

export const saveFinalQuizAnswers = createServerFn({ method: "POST" })
  .inputValidator((data) => answersInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const attempt = await getAttemptForUser(userId, data.attemptId);
    if (attempt.finished_at) throw new Error("Эта попытка уже завершена");
    if (isExpired(attempt)) {
      await finalizeAttempt(attempt, true);
      throw new Error("Время теста истекло");
    }

    const allowedQuestionIds = new Set(FINAL_QUIZ_QUESTIONS.map((question) => question.id));
    const allowedAnswers = Object.fromEntries(
      Object.entries(data.answers).filter(([questionId, optionId]) => {
        const question = FINAL_QUIZ_QUESTIONS.find((item) => item.id === questionId);
        return (
          allowedQuestionIds.has(questionId) &&
          question?.options.some((option) => option.id === optionId)
        );
      }),
    );
    const { error } = await supabaseAdmin
      .from("quiz_attempts")
      .update({ answers: allowedAnswers })
      .eq("id", attempt.id)
      .eq("user_id", userId)
      .is("finished_at", null);
    if (error) throw error;
    return { ok: true };
  });

export const finishFinalQuiz = createServerFn({ method: "POST" })
  .inputValidator((data) => attemptInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    let attempt = await getAttemptForUser(userId, data.attemptId);
    if (!attempt.finished_at) attempt = await finalizeAttempt(attempt, isExpired(attempt));

    const { count, error } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("lesson_id", attempt.lesson_id)
      .not("finished_at", "is", null);
    if (error) throw error;
    return quizResult(attempt, count ?? 1);
  });

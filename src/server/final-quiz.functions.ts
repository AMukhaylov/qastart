import { randomInt } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";
import { FINAL_QUIZ_QUESTIONS } from "./final-quiz.questions";

const QUIZ_DURATION_MS = 30 * 60 * 1000;
const PASSING_PERCENT = 70;
const BASE_MAX_ATTEMPTS = 3;
const QUESTIONS_PER_ATTEMPT = 30;

const accessTokenInput = z.object({
  accessToken: z.string().min(20),
  startNew: z.boolean().optional().default(false),
});
const attemptInput = accessTokenInput.extend({ attemptId: z.string().uuid() });
const finishInput = attemptInput.extend({ disqualified: z.boolean().optional().default(false) });
const answersInput = attemptInput.extend({
  answers: z.record(z.string().min(1), z.string().min(1)).default({}),
});
const grantAttemptInput = z.object({ accessToken: z.string().min(20), userId: z.string().uuid() });

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
  disqualified: boolean;
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
  const selectedQuestions = shuffle(FINAL_QUIZ_QUESTIONS).slice(0, QUESTIONS_PER_ATTEMPT);
  const questionIds = selectedQuestions.map((question) => question.id);
  return {
    questionIds,
    optionIdsByQuestion: Object.fromEntries(
      selectedQuestions.map((question) => [
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
  if (parsed.questionIds.length !== QUESTIONS_PER_ATTEMPT) return fallback;
  if (new Set(parsed.questionIds).size !== QUESTIONS_PER_ATTEMPT) return fallback;
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

async function finalizeAttempt(attempt: QuizAttempt, timedOut: boolean, disqualified = false) {
  if (attempt.finished_at) return attempt;

  const answers = parseAnswers(attempt.answers);
  const order = parseQuestionOrder(attempt.question_order);
  const questionsById = new Map(FINAL_QUIZ_QUESTIONS.map((question) => [question.id, question]));
  const score = order.questionIds.reduce((total, questionId) => {
    const question = questionsById.get(questionId);
    return total + Number(Boolean(question && answers[questionId] === question.correctOptionId));
  }, 0);
  const percentage = Math.round((score / order.questionIds.length) * 100);
  const passed = !disqualified && percentage >= PASSING_PERCENT;
  const { data, error } = await supabaseAdmin
    .from("quiz_attempts")
    .update({
      score,
      percentage,
      passed,
      timed_out: timedOut || isExpired(attempt),
      disqualified,
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

async function quizResult(attempt: QuizAttempt, attemptsUsed: number, maxAttempts: number) {
  const answers = parseAnswers(attempt.answers);
  const order = parseQuestionOrder(attempt.question_order);
  const byId = new Map(FINAL_QUIZ_QUESTIONS.map((question) => [question.id, question]));
  return {
    attemptId: attempt.id,
    score: attempt.score ?? 0,
    total: order.questionIds.length,
    percentage: attempt.percentage ?? 0,
    passed: Boolean(attempt.passed),
    timedOut: attempt.timed_out,
    disqualified: attempt.disqualified,
    attemptsUsed,
    attemptsLeft: Math.max(0, maxAttempts - attemptsUsed),
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
    const maxAttempts = BASE_MAX_ATTEMPTS;

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
        maxAttempts,
      };
    }

    const completedAttempts = allAttempts.filter((attempt) => attempt.finished_at);
    if (
      completedAttempts.length >= maxAttempts ||
      (completedAttempts.length > 0 && !data.startNew)
    ) {
      return {
        status: "result" as const,
        result: await quizResult(completedAttempts[0], completedAttempts.length, maxAttempts),
      };
    }

    if (!data.startNew) {
      return {
        status: "ready" as const,
        attemptsUsed: completedAttempts.length,
        maxAttempts,
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
      maxAttempts,
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

    const allowedQuestionIds = new Set(parseQuestionOrder(attempt.question_order).questionIds);
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
  .inputValidator((data) => finishInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    let attempt = await getAttemptForUser(userId, data.attemptId);
    if (!attempt.finished_at) {
      attempt = await finalizeAttempt(attempt, isExpired(attempt), data.disqualified);
    }

    const { count, error } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("lesson_id", attempt.lesson_id)
      .not("finished_at", "is", null);
    if (error) throw error;
    return quizResult(attempt, count ?? 1, BASE_MAX_ATTEMPTS);
  });

export const grantAdditionalFinalQuizAttempt = createServerFn({ method: "POST" })
  .inputValidator((data) => grantAttemptInput.parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id")
      .eq("day_number", 14)
      .single();
    if (lessonError || !lesson) throw new Error("Итоговый урок не найден");
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, finished_at, passed")
      .eq("user_id", data.userId)
      .eq("lesson_id", lesson.id);
    if (attemptsError) throw attemptsError;
    const completed = (attempts ?? []).filter((attempt) => attempt.finished_at);
    if (completed.length < BASE_MAX_ATTEMPTS || completed.some((attempt) => attempt.passed)) {
      throw new Error("Дополнительную попытку можно выдать после трёх неуспешных попыток");
    }
    const oldestFailed = completed
      .filter((attempt) => !attempt.passed)
      .sort((left, right) => String(left.finished_at).localeCompare(String(right.finished_at)))[0];
    if (!oldestFailed) throw new Error("Не удалось подготовить дополнительную попытку");
    const { error } = await supabaseAdmin
      .from("quiz_attempts")
      .update({
        question_order: makeQuestionOrder(),
        answers: {},
        score: null,
        percentage: null,
        passed: null,
        started_at: new Date().toISOString(),
        finished_at: null,
        timed_out: false,
        disqualified: false,
      })
      .eq("id", oldestFailed.id)
      .eq("user_id", data.userId);
    if (error) throw error;
    return { maxAttempts: BASE_MAX_ATTEMPTS };
  });

export const listAdminFinalQuizEligibility = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(20) }).parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id")
      .eq("day_number", 14)
      .single();
    if (lessonError || !lesson) throw new Error("Итоговый урок не найден");
    const { data: attempts, error } = await supabaseAdmin
      .from("quiz_attempts")
      .select("user_id, finished_at, passed")
      .eq("lesson_id", lesson.id);
    if (error) throw error;
    const byUser = new Map<string, { failed: number; passed: boolean }>();
    for (const attempt of attempts ?? []) {
      if (!attempt.finished_at) continue;
      const current = byUser.get(attempt.user_id) ?? { failed: 0, passed: false };
      current.passed ||= Boolean(attempt.passed);
      if (!attempt.passed) current.failed += 1;
      byUser.set(attempt.user_id, current);
    }
    return Object.fromEntries(
      [...byUser].map(([userId, result]) => [
        userId,
        result.failed >= BASE_MAX_ATTEMPTS && !result.passed,
      ]),
    );
  });

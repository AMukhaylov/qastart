import { randomInt } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { assertLessonScheduleAccess } from "./course-schedule.server";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";
import {
  FINAL_QUIZ_QUESTIONS,
  LEGACY_FINAL_QUIZ_QUESTIONS,
  type FinalQuizQuestion,
} from "./final-quiz.questions";
import { validateFinalQuizBank } from "./final-quiz.bank";

const DEFAULT_QUIZ_SETTINGS = {
  questionsPerAttempt: 30,
  durationMinutes: 30,
  maxAttempts: 3,
  passingPercent: 70,
};
const QUESTIONS_PER_ATTEMPT = DEFAULT_QUIZ_SETTINGS.questionsPerAttempt;
const RESERVED_ATTEMPT_KEY = "__reserved_final_quiz_attempt";
const FINAL_QUIZ_SETTINGS_TABLE = "final_quiz_settings" as const;

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
  questionsById?: Record<string, FinalQuizQuestion>;
  durationMinutes?: number;
  passingPercent?: number;
};

type FinalQuizSettings = typeof DEFAULT_QUIZ_SETTINGS & {
  questions: FinalQuizQuestion[];
};

async function getQuizSettings(): Promise<FinalQuizSettings> {
  const { data, error } = await supabaseAdmin
    .from(FINAL_QUIZ_SETTINGS_TABLE)
    .select(
      "questions_per_attempt, duration_minutes, max_attempts, passing_percent, bank_questions",
    )
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  const row = data as {
    questions_per_attempt: number;
    duration_minutes: number;
    max_attempts: number;
    passing_percent: number;
    bank_questions: unknown;
  } | null;
  return {
    questionsPerAttempt: row?.questions_per_attempt ?? DEFAULT_QUIZ_SETTINGS.questionsPerAttempt,
    durationMinutes: row?.duration_minutes ?? DEFAULT_QUIZ_SETTINGS.durationMinutes,
    maxAttempts: row?.max_attempts ?? DEFAULT_QUIZ_SETTINGS.maxAttempts,
    passingPercent: row?.passing_percent ?? DEFAULT_QUIZ_SETTINGS.passingPercent,
    questions: row?.bank_questions
      ? validateFinalQuizBank(row.bank_questions)
      : FINAL_QUIZ_QUESTIONS,
  };
}

function questionMap(order?: QuestionOrder) {
  return new Map(
    [
      ...FINAL_QUIZ_QUESTIONS,
      ...LEGACY_FINAL_QUIZ_QUESTIONS,
      ...Object.values(order?.questionsById ?? {}),
    ].map((question) => [question.id, question]),
  );
}

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const otherIndex = randomInt(index + 1);
    [result[index], result[otherIndex]] = [result[otherIndex], result[index]];
  }
  return result;
}

function makeQuestionOrder(settings?: FinalQuizSettings): QuestionOrder {
  const selectedQuestions = shuffle(settings?.questions ?? FINAL_QUIZ_QUESTIONS).slice(
    0,
    settings?.questionsPerAttempt ?? QUESTIONS_PER_ATTEMPT,
  );
  const questionIds = selectedQuestions.map((question) => question.id);
  return {
    questionIds,
    questionsById: Object.fromEntries(selectedQuestions.map((question) => [question.id, question])),
    durationMinutes: settings?.durationMinutes ?? DEFAULT_QUIZ_SETTINGS.durationMinutes,
    passingPercent: settings?.passingPercent ?? DEFAULT_QUIZ_SETTINGS.passingPercent,
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
  if (parsed.questionIds.length < 1 || parsed.questionIds.length > 90) return fallback;
  if (new Set(parsed.questionIds).size !== parsed.questionIds.length) return fallback;
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
    questionsById:
      parsed.questionsById && typeof parsed.questionsById === "object"
        ? (parsed.questionsById as Record<string, FinalQuizQuestion>)
        : undefined,
    durationMinutes:
      typeof parsed.durationMinutes === "number" ? parsed.durationMinutes : undefined,
    passingPercent: typeof parsed.passingPercent === "number" ? parsed.passingPercent : undefined,
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

function isReservedAttempt(attempt: QuizAttempt) {
  return !attempt.finished_at && parseAnswers(attempt.answers)[RESERVED_ATTEMPT_KEY] === "true";
}

function visibleQuestions(order: QuestionOrder) {
  const byId = questionMap(order);
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
  const durationMinutes =
    parseQuestionOrder(attempt.question_order).durationMinutes ??
    DEFAULT_QUIZ_SETTINGS.durationMinutes;
  return new Date(
    new Date(attempt.started_at).getTime() + durationMinutes * 60 * 1000,
  ).toISOString();
}

function isExpired(attempt: QuizAttempt) {
  return Date.now() >= new Date(expiresAt(attempt)).getTime();
}

async function finalizeAttempt(attempt: QuizAttempt, timedOut: boolean, disqualified = false) {
  if (attempt.finished_at) return attempt;

  const answers = parseAnswers(attempt.answers);
  const order = parseQuestionOrder(attempt.question_order);
  const questionsById = questionMap(order);
  const score = order.questionIds.reduce((total, questionId) => {
    const question = questionsById.get(questionId);
    return total + Number(Boolean(question && answers[questionId] === question.correctOptionId));
  }, 0);
  const percentage = Math.round((score / order.questionIds.length) * 100);
  const passed =
    !disqualified && percentage >= (order.passingPercent ?? DEFAULT_QUIZ_SETTINGS.passingPercent);
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
    if (!isReservedAttempt(row) && isExpired(row)) await finalizeAttempt(row, true);
  }
}

async function assertFinalQuizUnlocked(userId: string) {
  await assertLessonScheduleAccess(userId, 14);
}

async function getAttemptForUser(userId: string, attemptId: string) {
  await assertFinalQuizUnlocked(userId);
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
  const byId = questionMap(order);
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
    const settings = await getQuizSettings();
    await assertFinalQuizUnlocked(userId);
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
    const maxAttempts = Math.max(settings.maxAttempts, allAttempts.length);
    const active = allAttempts.find(
      (attempt) => !attempt.finished_at && !isReservedAttempt(attempt),
    );
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
        questionsPerAttempt: settings.questionsPerAttempt,
        durationMinutes: settings.durationMinutes,
        passingPercent: settings.passingPercent,
      };
    }

    const questionOrder = makeQuestionOrder(settings);
    const reserved = allAttempts.find(isReservedAttempt);
    const attemptPayload = {
      question_order: questionOrder,
      answers: {},
      score: null,
      percentage: null,
      passed: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      timed_out: false,
      disqualified: false,
    };
    const request = reserved
      ? supabaseAdmin
          .from("quiz_attempts")
          .update(attemptPayload)
          .eq("id", reserved.id)
          .eq("user_id", userId)
          .select("*")
          .single()
      : supabaseAdmin
          .from("quiz_attempts")
          .insert({ user_id: userId, lesson_id: lesson.id, ...attemptPayload })
          .select("*")
          .single();
    const { data: created, error: createError } = await request;
    if (createError || !created) throw createError ?? new Error("Не удалось начать тест");
    const attempt = created as QuizAttempt;
    return {
      status: "active" as const,
      attemptId: attempt.id,
      expiresAt: expiresAt(attempt),
      answers: {},
      questions: visibleQuestions(questionOrder),
      attemptsUsed: completedAttempts.length,
      maxAttempts,
      questionsPerAttempt: settings.questionsPerAttempt,
      durationMinutes: settings.durationMinutes,
      passingPercent: settings.passingPercent,
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

    const order = parseQuestionOrder(attempt.question_order);
    const allowedQuestionIds = new Set(order.questionIds);
    const questionsById = questionMap(order);
    const allowedAnswers = Object.fromEntries(
      Object.entries(data.answers).filter(([questionId, optionId]) => {
        const question = questionsById.get(questionId);
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
    const settings = await getQuizSettings();
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
    const attemptsUsed = count ?? 1;
    return quizResult(attempt, attemptsUsed, Math.max(settings.maxAttempts, attemptsUsed));
  });

export const grantAdditionalFinalQuizAttempt = createServerFn({ method: "POST" })
  .inputValidator((data) => grantAttemptInput.parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    const settings = await getQuizSettings();
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id")
      .eq("day_number", 14)
      .single();
    if (lessonError || !lesson) throw new Error("Итоговый урок не найден");
    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("quiz_attempts")
      .select("id, finished_at, passed, answers")
      .eq("user_id", data.userId)
      .eq("lesson_id", lesson.id);
    if (attemptsError) throw attemptsError;
    const completed = (attempts ?? []).filter((attempt) => attempt.finished_at);
    const hasAvailableAttempt = (attempts ?? []).some((attempt) => !attempt.finished_at);
    if (
      completed.length < settings.maxAttempts ||
      completed.some((attempt) => attempt.passed) ||
      hasAvailableAttempt
    ) {
      throw new Error(
        `Дополнительную попытку можно выдать после ${settings.maxAttempts} неуспешных попыток`,
      );
    }
    const { error } = await supabaseAdmin.from("quiz_attempts").insert({
      user_id: data.userId,
      lesson_id: lesson.id,
      question_order: makeQuestionOrder(settings),
      answers: { [RESERVED_ATTEMPT_KEY]: "true" },
      score: null,
      percentage: null,
      passed: null,
      started_at: new Date().toISOString(),
      finished_at: null,
      timed_out: false,
      disqualified: false,
    });
    if (error) throw error;
    return { availableAttempts: 1, maxAttempts: completed.length + 1 };
  });

export const getAdminFinalQuizSettings = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(20) }).parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    const settings = await getQuizSettings();
    return {
      questionsPerAttempt: settings.questionsPerAttempt,
      durationMinutes: settings.durationMinutes,
      maxAttempts: settings.maxAttempts,
      passingPercent: settings.passingPercent,
      bankQuestionCount: settings.questions.length,
      questions: settings.questions,
    };
  });

export const saveAdminFinalQuizSettings = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        accessToken: z.string().min(20),
        questionsPerAttempt: z.number().int().min(1).max(90),
        durationMinutes: z.number().int().min(1).max(240),
        maxAttempts: z.number().int().min(1).max(20),
        passingPercent: z.number().int().min(1).max(100),
        questions: z.unknown().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    const questions =
      data.questions === undefined ? undefined : validateFinalQuizBank(data.questions);
    const { error } = await supabaseAdmin
      .from(FINAL_QUIZ_SETTINGS_TABLE)
      .update({
        questions_per_attempt: data.questionsPerAttempt,
        duration_minutes: data.durationMinutes,
        max_attempts: data.maxAttempts,
        passing_percent: data.passingPercent,
        ...(questions ? { bank_questions: questions } : {}),
      })
      .eq("id", true);
    if (error) throw error;
    return { bankQuestionCount: questions?.length ?? (await getQuizSettings()).questions.length };
  });

export const listAdminFinalQuizEligibility = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: z.string().min(20) }).parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    const settings = await getQuizSettings();
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
    const byUser = new Map<string, { failed: number; passed: boolean; active: boolean }>();
    for (const attempt of attempts ?? []) {
      const current = byUser.get(attempt.user_id) ?? { failed: 0, passed: false, active: false };
      if (!attempt.finished_at) {
        current.active = true;
        byUser.set(attempt.user_id, current);
        continue;
      }
      current.passed ||= Boolean(attempt.passed);
      if (!attempt.passed) current.failed += 1;
      byUser.set(attempt.user_id, current);
    }
    return Object.fromEntries(
      [...byUser].map(([userId, result]) => [
        userId,
        result.failed >= settings.maxAttempts && !result.passed && !result.active,
      ]),
    );
  });

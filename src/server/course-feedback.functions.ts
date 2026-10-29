import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { validateQuestionAnswers } from "@/lib/lesson-feedback-validation";
import { getLessonScheduleAccess } from "./course-schedule.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";
import { getStudentFeedbackPolicy } from "./lesson-feedback-policy.server";

const questionSchema = z.object({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  type: z.enum(["rating", "textarea", "radio"]),
  label: z.string().trim().min(1).max(240),
  required: z.boolean(),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(80),
      }),
    )
    .max(20)
    .optional(),
});
export type CourseFeedbackQuestion = z.infer<typeof questionSchema>;

const answerSchema = z.record(z.string(), z.union([z.string(), z.number()]));
const accessTokenSchema = z.string().min(20);

async function getCourseFeedbackQuestions() {
  const { data, error } = await supabaseAdmin
    .from("course_feedback_templates")
    .select("questions")
    .eq("id", true)
    .single();
  if (error) throw error;
  return Array.isArray(data.questions) ? (data.questions as CourseFeedbackQuestion[]) : [];
}

async function hasPassedFinalQuiz(userId: string) {
  const { data: finalLesson, error: lessonError } = await supabaseAdmin
    .from("lessons")
    .select("id")
    .eq("day_number", 14)
    .single();
  if (lessonError) throw lessonError;
  const { data: attempt, error } = await supabaseAdmin
    .from("quiz_attempts")
    .select("id")
    .eq("user_id", userId)
    .eq("lesson_id", finalLesson.id)
    .eq("passed", true)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return Boolean(attempt);
}

export const getStudentCourseFeedback = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ accessToken: accessTokenSchema }).parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const [schedule, passed, questions, policy, { data: existing, error }] = await Promise.all([
      getLessonScheduleAccess(userId, 14),
      hasPassedFinalQuiz(userId),
      getCourseFeedbackQuestions(),
      getStudentFeedbackPolicy(userId),
      supabaseAdmin
        .from("course_feedback")
        .select("id,created_at")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);
    if (error) throw error;
    const available = schedule.allowed && !schedule.isAdmin && passed && !existing;
    return {
      enabled: schedule.allowed && !schedule.isAdmin && passed,
      required: policy.courseRequired,
      available,
      submitted: Boolean(existing),
      submittedAt: existing?.created_at ?? null,
      questions,
    };
  });

export const submitStudentCourseFeedback = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ accessToken: accessTokenSchema, answers: answerSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const schedule = await getLessonScheduleAccess(userId, 14);
    if (!schedule.allowed || schedule.isAdmin || !(await hasPassedFinalQuiz(userId)))
      throw new Error("Итоговый опрос откроется после успешной сдачи теста");
    const questions = await getCourseFeedbackQuestions();
    for (const question of questions)
      if (!questionSchema.safeParse(question).success)
        throw new Error("В настройках итогового опроса есть некорректный вопрос");
    const validation = validateQuestionAnswers(questions, data.answers);
    if (!validation.valid) throw new Error(validation.error);
    const { error } = await supabaseAdmin.from("course_feedback").insert({
      user_id: userId,
      answers: data.answers,
      status: "completed",
    });
    if (error && error.code !== "23505") throw error;
    return { submitted: true, alreadySubmitted: error?.code === "23505" };
  });

export const saveAdminCourseFeedbackQuestions = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ accessToken: accessTokenSchema, questions: z.array(questionSchema).min(1).max(30) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    if (new Set(data.questions.map((question) => question.id)).size !== data.questions.length)
      throw new Error("ID вопросов должны быть уникальными");
    for (const question of data.questions)
      if (question.type === "radio") {
        if (!question.options || question.options.length < 2)
          throw new Error("Для выбора добавь минимум два варианта");
        if (
          new Set(question.options.map((option) => option.value)).size !== question.options.length
        )
          throw new Error("Значения вариантов ответа должны быть уникальными");
      }
    if (!data.questions.some((question) => question.type === "rating" && question.required))
      throw new Error("Добавь обязательную оценку курса по шкале 1–10");
    const { error } = await supabaseAdmin
      .from("course_feedback_templates")
      .upsert({ id: true, questions: data.questions }, { onConflict: "id" });
    if (error) throw error;
    return { saved: true };
  });

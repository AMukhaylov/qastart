import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  blockCompletionCondition,
  isBlockRequired,
  type LessonBlock,
} from "@/lib/interactive-lesson";
import { buildLessonQuestionAnswer } from "@/lib/lesson-question-answer";
import { getLessonScheduleAccess } from "./course-schedule.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";
import { hasPassedEverySqlTask } from "./sql-sandbox-assessment.server";
import { canSubmitLessonFeedback, validateFeedbackAnswers } from "@/lib/lesson-feedback-validation";

const access = z.string().min(20);
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
export type FeedbackQuestion = z.infer<typeof questionSchema>;

const answerSchema = z.record(z.string(), z.union([z.string(), z.number()]));
const adminInput = z.object({ accessToken: access });

async function requireAdmin(token: string) {
  const roles = await getRolesForAccessToken(token);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
}

async function getFeedbackConfig(lessonId: string) {
  const [
    { data: global, error: globalError },
    { data: local, error: localError },
    { data: template, error: templateError },
  ] = await Promise.all([
    supabaseAdmin
      .from("lesson_feedback_course_settings")
      .select("required_by_default")
      .eq("id", true)
      .single(),
    supabaseAdmin
      .from("lesson_feedback_settings")
      .select("required_override,use_common_template,questions")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
    supabaseAdmin.from("lesson_feedback_templates").select("questions").eq("id", true).single(),
  ]);
  if (globalError) throw globalError;
  if (localError) throw localError;
  if (templateError) throw templateError;
  return {
    required: local?.required_override ?? global?.required_by_default ?? false,
    questions: local?.use_common_template
      ? ((template?.questions as FeedbackQuestion[] | undefined) ?? [])
      : Array.isArray(local?.questions)
        ? (local.questions as FeedbackQuestion[])
        : [],
  };
}

async function validateLessonRequirements(userId: string, lessonId: string, blocks: LessonBlock[]) {
  const [
    { data: progress, error: progressError },
    { data: answers, error: answersError },
    { data: quizzes, error: quizzesError },
    { data: attempts, error: attemptsError },
  ] = await Promise.all([
    supabaseAdmin
      .from("lesson_block_progress")
      .select("block_id")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId),
    supabaseAdmin
      .from("lesson_question_answers")
      .select("block_id,selected_indexes")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .eq("is_correct", true),
    supabaseAdmin
      .from("quiz_attempts")
      .select("id")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId)
      .eq("passed", true)
      .limit(1),
    supabaseAdmin
      .from("sql_sandbox_attempts")
      .select("block_id,task_id,query_text,passed,passed_at")
      .eq("user_id", userId)
      .eq("lesson_id", lessonId),
  ]);
  for (const error of [progressError, answersError, quizzesError, attemptsError])
    if (error) throw error;
  const completedIds = new Set((progress ?? []).map((row) => row.block_id));
  const correctIds = new Set(
    (answers ?? [])
      .filter((answer) => {
        const block = blocks.find((candidate) => candidate.id === answer.block_id);
        return Boolean(
          block && buildLessonQuestionAnswer(block.content, answer.selected_indexes).isCorrect,
        );
      })
      .map((answer) => answer.block_id),
  );
  const passedQuiz = (quizzes?.length ?? 0) > 0;
  for (const block of blocks.filter(isBlockRequired)) {
    if (!completedIds.has(block.id)) return false;
    const condition = blockCompletionCondition(block);
    if (condition === "question_correct" && !correctIds.has(block.id)) return false;
    if (block.block_type === "final_quiz" && !passedQuiz) return false;
    if (
      condition === "all_sql_tasks_passed" &&
      !(await hasPassedEverySqlTask(block, attempts ?? []))
    )
      return false;
  }
  return true;
}

async function isMentorHomeworkAccepted(
  userId: string,
  lessonId: string,
  hasHomework: boolean,
  blocks: LessonBlock[],
) {
  if (!hasHomework) return true;
  const hasSqlHomework = blocks.some(
    (block) => block.block_type === "homework" && block.content.mode === "sql_sandbox",
  );
  const humanHomework =
    blocks.some(
      (block) => block.block_type === "homework" && block.content.mode !== "sql_sandbox",
    ) ||
    (hasHomework && !hasSqlHomework);
  if (!humanHomework) return true; // SQL sandbox homework is accepted by its server-graded required tasks.
  const { data, error } = await supabaseAdmin
    .from("homework_submissions")
    .select("id,status")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.status === "approved";
}

export const getStudentLessonFeedback = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ accessToken: access, lessonId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const [{ data: lesson, error: lessonError }, config, { data: existing, error: existingError }] =
      await Promise.all([
        supabaseAdmin
          .from("lessons")
          .select("id,day_number,homework_md")
          .eq("id", data.lessonId)
          .maybeSingle(),
        getFeedbackConfig(data.lessonId),
        supabaseAdmin
          .from("lesson_feedback")
          .select("id,status,created_at")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId)
          .maybeSingle(),
      ]);
    if (lessonError) throw lessonError;
    if (existingError) throw existingError;
    if (!lesson) throw new Error("Урок не найден");
    const schedule = await getLessonScheduleAccess(userId, lesson.day_number);
    if (!schedule.allowed)
      return { required: false, available: false, submitted: false, questions: [] };
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from("lesson_blocks")
      .select("id,block_type,content")
      .eq("lesson_id", lesson.id)
      .order("position");
    if (blocksError) throw blocksError;
    const lessonBlocks = (blocks ?? []) as LessonBlock[];
    const hasHomework =
      lessonBlocks.some((block) => block.block_type === "homework") ||
      Boolean(lesson.homework_md?.trim());
    const homeworkAccepted = await isMentorHomeworkAccepted(
      userId,
      lesson.id,
      hasHomework,
      lessonBlocks,
    );
    const requirementsComplete = await validateLessonRequirements(userId, lesson.id, lessonBlocks);
    return {
      ...config,
      available: canSubmitLessonFeedback({
        required: config.required,
        requiredBlocksComplete: requirementsComplete,
        homeworkExists: hasHomework,
        homeworkAccepted,
        alreadySubmitted: Boolean(existing),
      }),
      submitted: Boolean(existing),
      submittedAt: existing?.created_at ?? null,
    };
  });

export const submitLessonFeedback = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({ accessToken: access, lessonId: z.string().uuid(), answers: answerSchema })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id,day_number,homework_md")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson || lesson.day_number < 1 || lesson.day_number > 14)
      throw new Error("Урок недоступен");
    const schedule = await getLessonScheduleAccess(userId, lesson.day_number);
    if (!schedule.allowed || schedule.isAdmin)
      throw new Error("Урок недоступен для отправки отзыва");
    const config = await getFeedbackConfig(lesson.id);
    if (!config.required) throw new Error("Опрос для этого урока отключён");
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from("lesson_blocks")
      .select("id,block_type,content")
      .eq("lesson_id", lesson.id)
      .order("position");
    if (blocksError) throw blocksError;
    const lessonBlocks = (blocks ?? []) as LessonBlock[];
    if (!(await validateLessonRequirements(userId, lesson.id, lessonBlocks)))
      throw new Error("Сначала пройди обязательные шаги урока");
    const hasHomework =
      lessonBlocks.some((block) => block.block_type === "homework") ||
      Boolean(lesson.homework_md?.trim());
    if (!(await isMentorHomeworkAccepted(userId, lesson.id, hasHomework, lessonBlocks)))
      throw new Error("Опрос откроется после принятия домашнего задания наставником");
    for (const question of config.questions)
      if (!questionSchema.safeParse(question).success)
        throw new Error("В настройках опроса есть некорректный вопрос");
    const validation = validateFeedbackAnswers(config.questions, data.answers);
    if (!validation.valid) throw new Error(validation.error);
    const { error } = await supabaseAdmin.from("lesson_feedback").insert({
      user_id: userId,
      lesson_id: lesson.id,
      answers: data.answers,
      rating: validation.rating,
      difficulty: validation.difficulty,
      comment: validation.comment,
      status: "completed",
    });
    if (error && error.code !== "23505") throw error;
    const { error: progressError } = await supabaseAdmin
      .from("lesson_progress")
      .upsert(
        { user_id: userId, lesson_id: lesson.id, completed: true },
        { onConflict: "user_id,lesson_id" },
      );
    if (progressError) throw progressError;
    return { submitted: true, alreadySubmitted: Boolean(error?.code === "23505") };
  });

export const getAdminFeedbackData = createServerFn({ method: "POST" })
  .inputValidator((data) => adminInput.parse(data))
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
    const [lessons, courseSettings, settings, template, feedback, profiles, studentRoles] =
      await Promise.all([
        supabaseAdmin.from("lessons").select("id,day_number,title").order("day_number"),
        supabaseAdmin
          .from("lesson_feedback_course_settings")
          .select("required_by_default")
          .eq("id", true)
          .single(),
        supabaseAdmin
          .from("lesson_feedback_settings")
          .select("lesson_id,required_override,use_common_template,questions"),
        supabaseAdmin.from("lesson_feedback_templates").select("questions").eq("id", true).single(),
        supabaseAdmin
          .from("lesson_feedback")
          .select(
            "id,user_id,lesson_id,answers,rating,difficulty,comment,status,created_at,updated_at",
          )
          .order("created_at", { ascending: false })
          .limit(5000),
        supabaseAdmin.from("profiles").select("id,full_name,login"),
        supabaseAdmin.from("user_roles").select("user_id").eq("role", "student"),
      ]);
    for (const response of [
      lessons,
      courseSettings,
      settings,
      template,
      feedback,
      profiles,
      studentRoles,
    ])
      if (response.error) throw response.error;
    return {
      lessons: lessons.data ?? [],
      courseSettings: courseSettings.data,
      settings: settings.data ?? [],
      commonTemplate: template.data?.questions ?? [],
      feedback: feedback.data ?? [],
      profiles: profiles.data ?? [],
      studentCount: new Set((studentRoles.data ?? []).map((row) => row.user_id)).size,
    };
  });

export const saveAdminFeedbackSettings = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        accessToken: access,
        globalRequired: z.boolean(),
        lessonId: z.string().uuid(),
        requiredOverride: z.boolean().nullable(),
        useCommonTemplate: z.boolean(),
        questions: z.array(questionSchema).min(1).max(30),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    await requireAdmin(data.accessToken);
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
    const ratingQuestions = data.questions.filter((question) => question.type === "rating");
    if (ratingQuestions.length !== 1 || !ratingQuestions[0]?.required)
      throw new Error("Оставь один обязательный вопрос со шкалой 1–10 для общей аналитики");
    const difficultyQuestion = data.questions.find(
      (question) =>
        question.type === "radio" &&
        ["too_easy", "normal", "hard", "too_hard"].every((value) =>
          question.options?.some((option) => option.value === value),
        ),
    );
    if (!difficultyQuestion?.required)
      throw new Error("Оставь обязательный вопрос сложности со стандартными вариантами ответа");
    const [{ error: globalError }, { error: lessonError }, { error: templateError }] =
      await Promise.all([
        supabaseAdmin
          .from("lesson_feedback_course_settings")
          .upsert({ id: true, required_by_default: data.globalRequired }, { onConflict: "id" }),
        supabaseAdmin.from("lesson_feedback_settings").upsert(
          {
            lesson_id: data.lessonId,
            required_override: data.requiredOverride,
            use_common_template: data.useCommonTemplate,
            questions: data.questions,
          },
          { onConflict: "lesson_id" },
        ),
        data.useCommonTemplate
          ? supabaseAdmin
              .from("lesson_feedback_templates")
              .upsert({ id: true, questions: data.questions }, { onConflict: "id" })
          : Promise.resolve({ error: null }),
      ]);
    if (globalError) throw globalError;
    if (lessonError) throw lessonError;
    if (templateError) throw templateError;
    return { saved: true };
  });

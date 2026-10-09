import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { blockCompletionCondition, type LessonBlock } from "@/lib/interactive-lesson";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";
import { getLessonScheduleAccess } from "./course-schedule.server";
import { hasPassedEverySqlTask } from "./sql-sandbox-assessment.server";
import { buildLessonQuestionAnswer } from "@/lib/lesson-question-answer";

const input = z.object({
  accessToken: z.string().min(20),
  blockIds: z.array(z.string().uuid()).min(1).max(100),
});

type ProgressBlock = Pick<LessonBlock, "id" | "block_type" | "content"> & {
  lesson_id: string;
};

export const markLessonBlocksCompleted = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const blockIds = [...new Set(data.blockIds)];
    const [userId, roles] = await Promise.all([
      getUserIdForAccessToken(data.accessToken),
      getRolesForAccessToken(data.accessToken, 2),
    ]);
    const isAdmin = roles.includes("admin");
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from("lesson_blocks")
      .select("id,lesson_id,block_type,content")
      .in("id", blockIds);
    if (blocksError) throw blocksError;
    if (!blocks || blocks.length !== blockIds.length) return { saved: false };

    const lessonIds = [...new Set(blocks.map((block) => block.lesson_id))];
    if (lessonIds.length !== 1) return { saved: false };
    const lessonId = lessonIds[0]!;
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id,day_number")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) return { saved: false };
    const access = await getLessonScheduleAccess(userId, lesson.day_number);
    if (!access.allowed) return { saved: false };

    const [
      { data: existingProgress, error: progressError },
      { data: correctAnswers, error: answersError },
      { data: passedQuizzes, error: quizError },
      { data: attempts, error: attemptsError },
      { data: submissions, error: submissionsError },
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
      supabaseAdmin
        .from("homework_submissions")
        .select("id")
        .eq("user_id", userId)
        .eq("lesson_id", lessonId)
        .limit(1),
    ]);
    for (const error of [progressError, answersError, quizError, attemptsError, submissionsError]) {
      if (error) throw error;
    }

    const done = new Set((existingProgress ?? []).map((row) => row.block_id));
    const contentByBlockId = new Map(blocks.map((block) => [block.id, block.content]));
    const correct = new Set(
      (correctAnswers ?? [])
        .filter((row) => {
          const content = contentByBlockId.get(row.block_id);
          return Boolean(
            content && buildLessonQuestionAnswer(content, row.selected_indexes).isCorrect,
          );
        })
        .map((row) => row.block_id),
    );
    const passedQuiz = (passedQuizzes?.length ?? 0) > 0;
    const savedSubmissions = (submissions?.length ?? 0) > 0;
    const storedAttempts = attempts ?? [];
    const progressRows: { user_id: string; lesson_id: string; block_id: string }[] = [];

    for (const rawBlock of blocks) {
      const block = rawBlock as ProgressBlock;
      if (!isAdmin && block.content.visible === false) return { saved: false };
      const condition = blockCompletionCondition(block);
      let valid = true;
      if (!isAdmin && condition === "question_correct") valid = correct.has(block.id);
      if (!isAdmin && condition === "all_sql_tasks_passed") {
        valid = await hasPassedEverySqlTask(block, storedAttempts);
      }
      if (!isAdmin && condition === "homework_submitted") valid = savedSubmissions;
      if (!isAdmin && block.block_type === "final_quiz") valid = passedQuiz;
      if (!valid) {
        // Heal stale rows written before the lockdown; historical progress could
        // have been forged while authenticated clients still had table writes.
        if (done.has(block.id)) {
          const { error: deleteError } = await supabaseAdmin
            .from("lesson_block_progress")
            .delete()
            .eq("user_id", userId)
            .eq("block_id", block.id);
          if (deleteError) throw deleteError;
        }
        return { saved: false };
      }
      if (done.has(block.id)) continue;
      // Video confirmations and ordinary viewed material are learner actions,
      // not assessments; all assessed block types are verified above.
      progressRows.push({ user_id: userId, lesson_id: lessonId, block_id: block.id });
    }

    if (progressRows.length === 0) return { saved: true };
    const { error: saveError } = await supabaseAdmin
      .from("lesson_block_progress")
      .upsert(progressRows, { onConflict: "user_id,block_id" });
    if (saveError) throw saveError;
    return { saved: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdForAccessToken } from "./admin-auth.server";
import { getLessonScheduleAccess } from "./course-schedule.server";
import {
  blockCompletionCondition,
  isBlockRequired,
  type LessonBlock,
} from "@/lib/interactive-lesson";
import { hasPassedEverySqlTask } from "./sql-sandbox-assessment.server";
import { isValidLessonQuestionSelection } from "@/lib/lesson-question-answer";

const accessInput = z.object({
  accessToken: z.string().min(20),
  lessonId: z.string().uuid(),
});

export const completeLessonForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id,day_number")
      .eq("id", data.lessonId)
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson || lesson.day_number < 1 || lesson.day_number >= 14) {
      return {
        completed: false,
        scheduleLocked: false,
        requirementsIncomplete: true,
      };
    }

    const access = await getLessonScheduleAccess(userId, lesson.day_number);
    if (!access.allowed)
      return { completed: false, scheduleLocked: true, requirementsIncomplete: false };
    if (!access.isAdmin) {
      const [
        { data: courseFeedback, error: courseFeedbackError },
        { data: lessonFeedback, error: lessonFeedbackError },
        { data: submittedFeedback, error: submittedFeedbackError },
        { data: skippedFeedback, error: skippedFeedbackError },
      ] = await Promise.all([
        supabaseAdmin
          .from("lesson_feedback_course_settings")
          .select("required_by_default")
          .eq("id", true)
          .single(),
        supabaseAdmin
          .from("lesson_feedback_settings")
          .select("required_override")
          .eq("lesson_id", data.lessonId)
          .maybeSingle(),
        supabaseAdmin
          .from("lesson_feedback")
          .select("id")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId)
          .maybeSingle(),
        supabaseAdmin
          .from("lesson_feedback_skips")
          .select("user_id")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId)
          .maybeSingle(),
      ]);
      for (const error of [
        courseFeedbackError,
        lessonFeedbackError,
        submittedFeedbackError,
        skippedFeedbackError,
      ])
        if (error) throw error;
      const feedbackRequired =
        lessonFeedback?.required_override ?? courseFeedback?.required_by_default ?? false;
      if (feedbackRequired && !submittedFeedback && !skippedFeedback) {
        return {
          completed: false,
          scheduleLocked: false,
          requirementsIncomplete: false,
          feedbackRequired: true,
        };
      }
    }
    if (!access.isAdmin) {
      const [
        { data: blocks, error: blocksError },
        { data: blockProgress, error: blockProgressError },
        { data: questionAnswers, error: answersError },
        { data: passedQuizzes, error: quizzesError },
        { data: sqlAttempts, error: sqlAttemptsError },
      ] = await Promise.all([
        supabaseAdmin
          .from("lesson_blocks")
          .select("id,block_type,content")
          .eq("lesson_id", data.lessonId),
        supabaseAdmin
          .from("lesson_block_progress")
          .select("block_id")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId),
        supabaseAdmin
          .from("lesson_question_answers")
          .select("block_id,selected_indexes")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId),
        supabaseAdmin
          .from("quiz_attempts")
          .select("id")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId)
          .eq("passed", true)
          .limit(1),
        supabaseAdmin
          .from("sql_sandbox_attempts")
          .select("block_id,task_id,query_text,passed,passed_at")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId),
      ]);
      if (blocksError) throw blocksError;
      if (blockProgressError) throw blockProgressError;
      if (answersError) throw answersError;
      if (quizzesError) throw quizzesError;
      if (sqlAttemptsError) throw sqlAttemptsError;
      const completedBlockIds = new Set((blockProgress ?? []).map((row) => row.block_id));
      const blockContentById = new Map((blocks ?? []).map((block) => [block.id, block.content]));
      const answeredBlockIds = new Set(
        (questionAnswers ?? [])
          .filter((row) => {
            const content = blockContentById.get(row.block_id);
            return Boolean(
              content && isValidLessonQuestionSelection(content, row.selected_indexes),
            );
          })
          .map((row) => row.block_id),
      );
      const passedQuiz = (passedQuizzes?.length ?? 0) > 0;
      const requiredBlocks = (blocks ?? []).filter((block) =>
        isBlockRequired({
          block_type: block.block_type as LessonBlock["block_type"],
          content:
            typeof block.content === "object" &&
            block.content !== null &&
            !Array.isArray(block.content)
              ? (block.content as Record<string, unknown>)
              : {},
        }),
      );
      let requirementsComplete = requiredBlocks.every((block) => {
        if (!completedBlockIds.has(block.id)) return false;
        const safeBlock = {
          block_type: block.block_type as LessonBlock["block_type"],
          content:
            typeof block.content === "object" &&
            block.content !== null &&
            !Array.isArray(block.content)
              ? (block.content as Record<string, unknown>)
              : {},
        };
        const condition = blockCompletionCondition(safeBlock);
        if (condition === "question_answered") return answeredBlockIds.has(block.id);
        if (block.block_type === "final_quiz") return passedQuiz;
        return true;
      });
      if (requirementsComplete) {
        for (const block of requiredBlocks) {
          const safeBlock = {
            id: block.id,
            block_type: block.block_type as LessonBlock["block_type"],
            content:
              typeof block.content === "object" &&
              block.content !== null &&
              !Array.isArray(block.content)
                ? (block.content as Record<string, unknown>)
                : {},
          };
          if (
            blockCompletionCondition(safeBlock) === "all_sql_tasks_passed" &&
            !(await hasPassedEverySqlTask(safeBlock, sqlAttempts ?? []))
          ) {
            requirementsComplete = false;
            break;
          }
        }
      }
      if (!requirementsComplete) {
        return {
          completed: false,
          scheduleLocked: false,
          requirementsIncomplete: true,
        };
      }
    }

    const { data: savedProgress, error } = await supabaseAdmin
      .from("lesson_progress")
      .upsert(
        {
          user_id: userId,
          lesson_id: data.lessonId,
          completed: true,
        },
        { onConflict: "user_id,lesson_id" },
      )
      .select("completed_at")
      .single();
    if (error) throw error;

    return {
      completed: true,
      scheduleLocked: false,
      requirementsIncomplete: false,
      completedAt: savedProgress.completed_at,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdForAccessToken } from "./admin-auth.server";
import { getLessonScheduleAccess } from "./course-schedule.server";
import { blockCompletionCondition, type LessonBlock } from "@/lib/interactive-lesson";
import { buildLessonQuestionAnswer } from "@/lib/lesson-question-answer";
import {
  hasPassedEverySqlTask,
  hideSqlAnswerKeyFromStudent,
  regradeStoredSqlAttempts,
} from "./sql-sandbox-assessment.server";

const input = z.object({
  accessToken: z.string().min(20),
  dayNumber: z.number().int().positive(),
});

export const getStudentLessonData = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const dayNumbers = [data.dayNumber];
    // Start the public lesson lookup alongside token validation so the first
    // database round trip does not have to wait for Supabase Auth.
    const [userId, { data: lessons, error: lessonsError }] = await Promise.all([
      getUserIdForAccessToken(data.accessToken),
      supabaseAdmin
        .from("lessons")
        .select("id,day_number,title,description,video_url,content_md,homework_md")
        .in("day_number", dayNumbers),
    ]);
    if (lessonsError) throw lessonsError;
    const lesson = (lessons ?? []).find((item) => item.day_number === data.dayNumber) ?? null;
    if (!lesson) {
      return {
        lesson: null,
        lock: null,
        progress: null,
        submission: null,
        blocks: [],
        blockProgress: [],
        sqlSandboxAttempts: [],
        finalQuizPassed: false,
        courseStartAt: null,
        currentDay: 0,
      };
    }
    // Schedule validation remains authoritative on the backend, while the
    // lesson's dependent rows are fetched in the same network window.
    const [access, lessonRows] = await Promise.all([
      getLessonScheduleAccess(userId, lesson.day_number),
      Promise.all([
        supabaseAdmin
          .from("lesson_progress")
          .select("completed,completed_at")
          .eq("user_id", userId)
          .eq("lesson_id", lesson.id)
          .maybeSingle(),
        supabaseAdmin
          .from("homework_submissions")
          .select("id,user_id,content,status,feedback,created_at,reviewed_at,reviewed_by")
          .eq("user_id", userId)
          .eq("lesson_id", lesson.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from("lesson_blocks")
          .select("id,lesson_id,block_type,position,content")
          .eq("lesson_id", lesson.id)
          .order("position"),
        supabaseAdmin
          .from("lesson_block_progress")
          .select("block_id")
          .eq("user_id", userId)
          .eq("lesson_id", lesson.id),
        supabaseAdmin
          .from("sql_sandbox_attempts")
          .select(
            "block_id,task_id,query_text,passed,passed_at,result_columns,result_rows,feedback",
          )
          .eq("user_id", userId)
          .eq("lesson_id", lesson.id),
        data.dayNumber === 14
          ? supabaseAdmin
              .from("quiz_attempts")
              .select("id")
              .eq("user_id", userId)
              .eq("lesson_id", lesson.id)
              .eq("passed", true)
              .limit(1)
          : Promise.resolve({ data: [], error: null }),
      ]),
    ]);
    if (!access.allowed) {
      return {
        lesson: null,
        lock: { courseStartAt: access.courseStartAt, opensAt: access.opensAt },
        progress: null,
        submission: null,
        blocks: [],
        blockProgress: [],
        sqlSandboxAttempts: [],
        finalQuizPassed: false,
        courseStartAt: access.courseStartAt,
        currentDay: access.currentDay,
      };
    }

    const [
      { data: progress, error: progressError },
      { data: submission, error: submissionError },
      { data: blocks, error: blocksError },
      { data: blockProgress, error: blockProgressError },
      { data: sqlSandboxAttempts, error: sqlSandboxAttemptsError },
      { data: passedFinalQuiz, error: passedFinalQuizError },
    ] = lessonRows;
    for (const error of [
      progressError,
      submissionError,
      blocksError,
      blockProgressError,
      passedFinalQuizError,
    ]) {
      if (error) throw error;
    }
    if (
      sqlSandboxAttemptsError &&
      (sqlSandboxAttemptsError as { code?: string }).code !== "42P01"
    ) {
      throw sqlSandboxAttemptsError;
    }
    const verifiedSqlResults = await regradeStoredSqlAttempts(
      (blocks ?? []) as LessonBlock[],
      sqlSandboxAttempts ?? [],
    );
    const verifiedSqlAttempts = (sqlSandboxAttempts ?? []).map((attempt) => {
      const verified = verifiedSqlResults.get(`${attempt.block_id}:${attempt.task_id}`);
      if (!verified) return { ...attempt, passed: false, passed_at: null };
      return {
        ...attempt,
        passed: verified.passed,
        passed_at: verified.passed ? attempt.passed_at : null,
        result_columns: verified.columns,
        result_rows: verified.rows,
        feedback: verified.message,
      };
    });
    const { data: savedQuestionAnswers, error: savedQuestionAnswersError } = await supabaseAdmin
      .from("lesson_question_answers")
      .select("block_id,selected_indexes")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id);
    if (savedQuestionAnswersError) throw savedQuestionAnswersError;
    const lessonBlocksById = new Map((blocks ?? []).map((block) => [block.id, block]));
    const correctQuestionIds = new Set(
      (savedQuestionAnswers ?? [])
        .filter((answer) => {
          const block = lessonBlocksById.get(answer.block_id);
          return Boolean(
            block && buildLessonQuestionAnswer(block.content, answer.selected_indexes).isCorrect,
          );
        })
        .map((answer) => answer.block_id),
    );
    const finalQuizPassed = (passedFinalQuiz?.length ?? 0) > 0;
    const completedBlockRows = blockProgress ?? [];
    const validProgressRows = [];
    for (const progressRow of completedBlockRows) {
      const block = (blocks ?? []).find((item) => item.id === progressRow.block_id);
      if (!block) continue;
      const lessonBlock = block as LessonBlock;
      const condition = blockCompletionCondition(lessonBlock);
      let valid = true;
      if (condition === "question_correct") valid = correctQuestionIds.has(block.id);
      if (condition === "all_sql_tasks_passed") {
        valid = await hasPassedEverySqlTask(lessonBlock, sqlSandboxAttempts ?? []);
      }
      if (block.block_type === "final_quiz") valid = finalQuizPassed;
      if (valid) validProgressRows.push(progressRow);
      else {
        const { error: cleanupError } = await supabaseAdmin
          .from("lesson_block_progress")
          .delete()
          .eq("user_id", userId)
          .eq("block_id", block.id);
        if (cleanupError) throw cleanupError;
      }
    }
    return {
      lesson,
      lock: null,
      progress,
      submission,
      blocks: (blocks ?? []).map((block) => hideSqlAnswerKeyFromStudent(block)),
      blockProgress: validProgressRows,
      sqlSandboxAttempts: sqlSandboxAttemptsError ? [] : verifiedSqlAttempts,
      finalQuizPassed: (passedFinalQuiz?.length ?? 0) > 0,
      courseStartAt: access.courseStartAt,
      currentDay: access.currentDay,
    };
  });

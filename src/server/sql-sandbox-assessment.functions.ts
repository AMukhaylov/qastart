import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LessonBlock, SqlSandboxTask } from "@/lib/interactive-lesson";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdForAccessToken } from "./admin-auth.server";
import { assertLessonScheduleAccess } from "./course-schedule.server";
import {
  evaluateSqlTask,
  hasPassedEverySqlTask,
  sqlConfigForBlock,
} from "./sql-sandbox-assessment.server";

const input = z.object({
  accessToken: z.string().min(20),
  blockId: z.string().uuid(),
  taskId: z.string().min(1).max(80),
  query: z.string().max(4000),
});

export const submitSqlSandboxAttempt = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const { data: rawBlock, error: blockError } = await supabaseAdmin
      .from("lesson_blocks")
      .select("id,lesson_id,block_type,content")
      .eq("id", data.blockId)
      .maybeSingle();
    if (blockError) throw blockError;
    if (!rawBlock) throw new Error("SQL-задание не найдено.");

    const block = rawBlock as LessonBlock;
    if (block.content.visible === false) throw new Error("SQL-задание не найдено.");
    const config = sqlConfigForBlock(block);
    const task = config?.tasks.find((item) => item.id === data.taskId) as
      | SqlSandboxTask
      | undefined;
    if (!config || !task) throw new Error("SQL-задание не найдено в опубликованном уроке.");

    const { data: lesson, error: lessonError } = await supabaseAdmin
      .from("lessons")
      .select("id,day_number")
      .eq("id", rawBlock.lesson_id)
      .maybeSingle();
    if (lessonError) throw lessonError;
    if (!lesson) throw new Error("Урок не найден.");
    await assertLessonScheduleAccess(userId, lesson.day_number);

    // The database config and expected result come from the server-side lesson
    // record. Neither the result nor the answer key is accepted from the client.
    const result = await evaluateSqlTask(config, task, data.query);
    const { data: savedAttempt, error: saveError } = await supabaseAdmin
      .from("sql_sandbox_attempts")
      .upsert(
        {
          user_id: userId,
          lesson_id: lesson.id,
          block_id: block.id,
          task_id: task.id,
          query_text: data.query,
          passed: result.passed,
          result_columns: result.columns,
          result_rows: result.rows,
          feedback: result.message,
        },
        { onConflict: "user_id,block_id,task_id" },
      )
      .select("passed_at")
      .single();
    if (saveError) throw saveError;

    const { data: attempts, error: attemptsError } = await supabaseAdmin
      .from("sql_sandbox_attempts")
      .select("block_id,task_id,query_text,passed,passed_at")
      .eq("user_id", userId)
      .eq("lesson_id", lesson.id);
    if (attemptsError) throw attemptsError;
    const blockCompleted = await hasPassedEverySqlTask(block, attempts ?? []);
    if (blockCompleted) {
      const { error: progressError } = await supabaseAdmin
        .from("lesson_block_progress")
        .upsert(
          { user_id: userId, lesson_id: lesson.id, block_id: block.id },
          { onConflict: "user_id,block_id" },
        );
      if (progressError) throw progressError;
    } else {
      // A later failed query replaces that task's previous passing attempt.
      // Remove its stale completion marker immediately as well.
      const { error: progressError } = await supabaseAdmin
        .from("lesson_block_progress")
        .delete()
        .eq("user_id", userId)
        .eq("lesson_id", lesson.id)
        .eq("block_id", block.id);
      if (progressError) throw progressError;
    }

    return { result, passedAt: savedAttempt.passed_at, blockCompleted };
  });

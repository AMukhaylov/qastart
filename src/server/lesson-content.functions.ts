import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdForAccessToken } from "./admin-auth.server";

const input = z.object({
  accessToken: z.string().min(20),
  dayNumber: z.number().int().positive(),
});

export const getStudentLessonData = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const dayNumbers = data.dayNumber > 1 ? [data.dayNumber - 1, data.dayNumber] : [data.dayNumber];
    const { data: lessons, error: lessonsError } = await supabaseAdmin
      .from("lessons")
      .select("id,day_number,title,description,video_url,content_md,homework_md")
      .in("day_number", dayNumbers);
    if (lessonsError) throw lessonsError;
    const lesson = (lessons ?? []).find((item) => item.day_number === data.dayNumber) ?? null;
    const previousLesson = (lessons ?? []).find((item) => item.day_number === data.dayNumber - 1);
    if (!lesson) {
      return {
        lesson: null,
        previousCompleted: false,
        progress: null,
        submission: null,
        blocks: [],
        blockProgress: [],
        sqlSandboxAttempts: [],
      };
    }

    const [
      { data: progress, error: progressError },
      { data: submission, error: submissionError },
      { data: blocks, error: blocksError },
      { data: blockProgress, error: blockProgressError },
      { data: sqlSandboxAttempts, error: sqlSandboxAttemptsError },
      { data: previousProgress, error: previousProgressError },
    ] = await Promise.all([
      supabaseAdmin
        .from("lesson_progress")
        .select("completed")
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
      supabaseAdmin.from("lesson_blocks").select("*").eq("lesson_id", lesson.id).order("position"),
      supabaseAdmin
        .from("lesson_block_progress")
        .select("block_id")
        .eq("user_id", userId)
        .eq("lesson_id", lesson.id),
      supabaseAdmin
        .from("sql_sandbox_attempts")
        .select("block_id,task_id,query_text,passed,result_columns,result_rows,feedback")
        .eq("user_id", userId)
        .eq("lesson_id", lesson.id),
      previousLesson
        ? supabaseAdmin
            .from("lesson_progress")
            .select("completed")
            .eq("user_id", userId)
            .eq("lesson_id", previousLesson.id)
            .eq("completed", true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);
    for (const error of [
      progressError,
      submissionError,
      blocksError,
      blockProgressError,
      previousProgressError,
    ]) {
      if (error) throw error;
    }
    if (
      sqlSandboxAttemptsError &&
      (sqlSandboxAttemptsError as { code?: string }).code !== "42P01"
    ) {
      throw sqlSandboxAttemptsError;
    }
    return {
      lesson,
      previousCompleted: data.dayNumber === 1 || Boolean(previousProgress?.completed),
      progress,
      submission,
      blocks: blocks ?? [],
      blockProgress: blockProgress ?? [],
      sqlSandboxAttempts: sqlSandboxAttemptsError ? [] : (sqlSandboxAttempts ?? []),
    };
  });

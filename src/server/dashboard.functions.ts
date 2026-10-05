import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdForAccessToken } from "./admin-auth.server";

const accessInput = z.object({ accessToken: z.string().min(20) });

export const getStudentDashboardData = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const [
      { data: lessons, error: lessonsError },
      { data: progress, error: progressError },
      { data: homework, error: homeworkError },
      { data: homeworkBlocks, error: homeworkBlocksError },
      { data: sqlSandboxAttempts, error: sqlSandboxAttemptsError },
      { data: certificate, error: certificateError },
      { data: profile, error: profileError },
      { data: passedFinalQuizAttempts, error: passedFinalQuizError },
    ] = await Promise.all([
      supabaseAdmin
        .from("lessons")
        .select("id,day_number,title,description,homework_md")
        .order("day_number"),
      supabaseAdmin
        .from("lesson_progress")
        .select("lesson_id,completed")
        .eq("user_id", userId)
        .eq("completed", true),
      supabaseAdmin
        .from("homework_submissions")
        .select("lesson_id,status,created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("lesson_blocks")
        .select("id,lesson_id,content")
        .eq("block_type", "homework"),
      supabaseAdmin
        .from("sql_sandbox_attempts")
        .select("lesson_id,block_id,task_id,passed")
        .eq("user_id", userId),
      supabaseAdmin
        .from("certificates")
        .select(
          "certificate_number,verification_code,course_title,issued_at,mentor_name,revoked_at",
        )
        .eq("user_id", userId)
        .order("issued_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin.from("profiles").select("full_name,avatar_url").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("quiz_attempts")
        .select("lesson_id")
        .eq("user_id", userId)
        .eq("passed", true),
    ]);
    for (const error of [
      lessonsError,
      progressError,
      homeworkError,
      homeworkBlocksError,
      sqlSandboxAttemptsError,
      certificateError,
      profileError,
      passedFinalQuizError,
    ]) {
      if (error) throw error;
    }
    return {
      lessons: lessons ?? [],
      progress: progress ?? [],
      finalQuizPassed: Boolean(
        lessons?.some(
          (lesson) =>
            lesson.day_number === 14 &&
            passedFinalQuizAttempts?.some((attempt) => attempt.lesson_id === lesson.id),
        ),
      ),
      homework: homework ?? [],
      homeworkBlocks: homeworkBlocks ?? [],
      sqlSandboxAttempts: sqlSandboxAttempts ?? [],
      certificate: certificate ?? null,
      profile: profile ?? null,
    };
  });

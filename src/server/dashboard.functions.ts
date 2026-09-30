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
      { data: certificate, error: certificateError },
      { data: profile, error: profileError },
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
      supabaseAdmin.from("lesson_blocks").select("lesson_id").eq("block_type", "homework"),
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
    ]);
    for (const error of [
      lessonsError,
      progressError,
      homeworkError,
      homeworkBlocksError,
      certificateError,
      profileError,
    ]) {
      if (error) throw error;
    }
    return {
      lessons: lessons ?? [],
      progress: progress ?? [],
      homework: homework ?? [],
      homeworkBlocks: homeworkBlocks ?? [],
      certificate: certificate ?? null,
      profile: profile ?? null,
    };
  });

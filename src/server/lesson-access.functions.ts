import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";

export const MAX_NEW_LESSONS_PER_DAY = 3;
const COURSE_TIME_ZONE_OFFSET = "+05:00";

const accessInput = z.object({
  accessToken: z.string().min(20),
  lessonId: z.string().uuid(),
});

function courseDayRange(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Yekaterinburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((parts, part) => ({ ...parts, [part.type]: part.value }), {});
  const dayStart = new Date(
    `${date.year}-${date.month}-${date.day}T00:00:00${COURSE_TIME_ZONE_OFFSET}`,
  );
  return {
    start: dayStart.toISOString(),
    end: new Date(dayStart.getTime() + 86_400_000).toISOString(),
  };
}

async function completedToday(userId: string) {
  const { start, end } = courseDayRange();
  const { count, error } = await supabaseAdmin
    .from("lesson_progress")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("completed", true)
    .gte("completed_at", start)
    .lt("completed_at", end);
  if (error) throw error;
  return count ?? 0;
}

async function lessonDailyAccess(accessToken: string, lessonId: string) {
  const userId = await getUserIdForAccessToken(accessToken);
  const roles = await getRolesForAccessToken(accessToken, 2);
  if (roles.includes("admin")) return { allowed: true, completedToday: 0, alreadyCompleted: false };

  const { data: currentProgress, error } = await supabaseAdmin
    .from("lesson_progress")
    .select("completed")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (error) throw error;

  const alreadyCompleted = currentProgress?.completed === true;
  const count = await completedToday(userId);
  return {
    allowed: alreadyCompleted || count < MAX_NEW_LESSONS_PER_DAY,
    completedToday: count,
    alreadyCompleted,
  };
}

export const getLessonDailyAccessForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(({ data }) => lessonDailyAccess(data.accessToken, data.lessonId));

export const completeLessonForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    const access = await lessonDailyAccess(data.accessToken, data.lessonId);
    if (!access.allowed)
      return { completed: false, limitReached: true, completedToday: access.completedToday };

    const userId = await getUserIdForAccessToken(data.accessToken);
    const { error } = await supabaseAdmin.from("lesson_progress").upsert(
      {
        user_id: userId,
        lesson_id: data.lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
    if (error) throw error;

    return { completed: true, limitReached: false, completedToday: access.completedToday + 1 };
  });

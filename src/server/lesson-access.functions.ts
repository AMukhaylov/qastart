import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";
import { isBlockRequired, type LessonBlock } from "@/lib/interactive-lesson";

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
    const userId = await getUserIdForAccessToken(data.accessToken);
    const roles = await getRolesForAccessToken(data.accessToken, 2);
    const isAdmin = roles.includes("admin");
    const [{ data: lesson, error: lessonError }, { data: existingProgress, error: progressError }] =
      await Promise.all([
        supabaseAdmin.from("lessons").select("id,day_number").eq("id", data.lessonId).maybeSingle(),
        supabaseAdmin
          .from("lesson_progress")
          .select("completed")
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId)
          .maybeSingle(),
      ]);
    if (lessonError) throw lessonError;
    if (progressError) throw progressError;
    if (!lesson || lesson.day_number < 1 || lesson.day_number >= 14) {
      return {
        completed: false,
        limitReached: false,
        requirementsIncomplete: true,
        completedToday: 0,
      };
    }

    if (!isAdmin) {
      if (lesson.day_number > 1) {
        const { data: previousLesson, error: previousLessonError } = await supabaseAdmin
          .from("lessons")
          .select("id")
          .eq("day_number", lesson.day_number - 1)
          .maybeSingle();
        if (previousLessonError) throw previousLessonError;
        if (!previousLesson) {
          return {
            completed: false,
            limitReached: false,
            requirementsIncomplete: true,
            completedToday: 0,
          };
        }
        const { data: previousProgress, error: previousProgressError } = await supabaseAdmin
          .from("lesson_progress")
          .select("completed")
          .eq("user_id", userId)
          .eq("lesson_id", previousLesson.id)
          .maybeSingle();
        if (previousProgressError) throw previousProgressError;
        if (!previousProgress?.completed) {
          return {
            completed: false,
            limitReached: false,
            requirementsIncomplete: true,
            completedToday: 0,
          };
        }
      }

      const [
        { data: blocks, error: blocksError },
        { data: blockProgress, error: blockProgressError },
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
      ]);
      if (blocksError) throw blocksError;
      if (blockProgressError) throw blockProgressError;
      const completedBlockIds = new Set((blockProgress ?? []).map((row) => row.block_id));
      const requiredBlockIds = (blocks ?? [])
        .filter((block) =>
          isBlockRequired({
            block_type: block.block_type as LessonBlock["block_type"],
            content:
              typeof block.content === "object" &&
              block.content !== null &&
              !Array.isArray(block.content)
                ? (block.content as Record<string, unknown>)
                : {},
          }),
        )
        .map((block) => block.id);
      if (
        requiredBlockIds.length > 0 &&
        !requiredBlockIds.every((id) => completedBlockIds.has(id))
      ) {
        return {
          completed: false,
          limitReached: false,
          requirementsIncomplete: true,
          completedToday: 0,
        };
      }
    }

    const access = await lessonDailyAccess(data.accessToken, data.lessonId);
    if (!access.allowed)
      return {
        completed: false,
        limitReached: true,
        requirementsIncomplete: false,
        completedToday: access.completedToday,
      };

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

    return {
      completed: true,
      limitReached: false,
      requirementsIncomplete: false,
      completedToday: access.completedToday + 1,
    };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getUserIdForAccessToken } from "./admin-auth.server";
import { getLessonScheduleAccess } from "./course-schedule.server";
import { isBlockRequired, type LessonBlock } from "@/lib/interactive-lesson";

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

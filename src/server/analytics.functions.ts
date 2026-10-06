import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buildCourseAnalytics } from "@/lib/course-analytics";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken } from "./admin-auth.server";

const input = z.object({ accessToken: z.string().min(20) });
const ANALYTICS_PAGE_SIZE = 1000;

async function fetchAllPages<T>(
  fetchPage: (
    from: number,
    to: number,
  ) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += ANALYTICS_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + ANALYTICS_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < ANALYTICS_PAGE_SIZE) return rows;
  }
}

export const getAdminCourseAnalytics = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав");

    const [roleRows, profiles, { data: lessons, error: lessonError }] = await Promise.all([
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("user_roles")
          .select("user_id")
          .eq("role", "student")
          .order("user_id")
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("profiles")
          .select("id,full_name,login,created_at,course_start_at")
          .order("id")
          .range(from, to),
      ),
      supabaseAdmin.from("lessons").select("id,day_number,title,homework_md").order("day_number"),
    ]);
    if (lessonError) throw lessonError;

    const studentIds = [...new Set((roleRows ?? []).map((row) => row.user_id))];
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const students = studentIds.map((id) => {
      const profile = profileById.get(id);
      return {
        id,
        full_name: profile?.full_name ?? null,
        login: profile?.login ?? "",
        created_at: profile?.created_at ?? null,
        course_start_at: profile?.course_start_at ?? null,
      };
    });
    if (studentIds.length === 0) {
      return buildCourseAnalytics({
        students,
        lessons: lessons ?? [],
        progress: [],
        blockProgress: [],
        submissions: [],
        homeworkMessages: [],
        homeworkBlocks: [],
        sqlAttempts: [],
        quizAttempts: [],
        lessonQuestionAnswers: [],
      });
    }

    const [
      progress,
      blockProgress,
      submissions,
      { data: homeworkBlocks, error: homeworkBlockError },
      sqlAttempts,
      quizAttempts,
      lessonQuestionAnswers,
    ] = await Promise.all([
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("lesson_progress")
          .select("user_id,lesson_id,completed,completed_at,created_at")
          .in("user_id", studentIds)
          .order("user_id")
          .order("lesson_id")
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("lesson_block_progress")
          .select("user_id,lesson_id,completed_at,block_id")
          .in("user_id", studentIds)
          .order("user_id")
          .order("block_id")
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("homework_submissions")
          .select("id,user_id,lesson_id,status,created_at,reviewed_at")
          .in("user_id", studentIds)
          .order("user_id")
          .order("lesson_id")
          .order("created_at")
          .order("id")
          .range(from, to),
      ),
      supabaseAdmin
        .from("lesson_blocks")
        .select("id,lesson_id,content")
        .eq("block_type", "homework"),
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("sql_sandbox_attempts")
          .select("user_id,block_id,lesson_id,task_id,passed,passed_at,created_at")
          .in("user_id", studentIds)
          .order("user_id")
          .order("block_id")
          .order("task_id")
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("quiz_attempts")
          .select(
            "user_id,question_order,answers,percentage,passed,timed_out,disqualified,started_at,finished_at",
          )
          .in("user_id", studentIds)
          .order("user_id")
          .order("started_at")
          .order("id")
          .range(from, to),
      ),
      fetchAllPages((from, to) =>
        supabaseAdmin
          .from("lesson_question_answers")
          .select(
            "user_id,lesson_id,block_id,answered_at,question_text,options,selected_indexes,correct_indexes,is_correct",
          )
          .in("user_id", studentIds)
          .order("lesson_id")
          .order("block_id")
          .order("user_id")
          .range(from, to),
      ),
    ]);
    if (homeworkBlockError) throw homeworkBlockError;

    const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
    const submissionIds = [...submissionById.keys()];
    const homeworkMessages = [];
    for (let offset = 0; offset < submissionIds.length; offset += 200) {
      const ids = submissionIds.slice(offset, offset + 200);
      const rows = await fetchAllPages((from, to) =>
        supabaseAdmin
          .from("homework_messages")
          .select("submission_id,author_role,created_at")
          .in("submission_id", ids)
          .order("submission_id")
          .order("created_at")
          .range(from, to),
      );
      for (const row of rows) {
        const submission = submissionById.get(row.submission_id);
        if (!submission) continue;
        homeworkMessages.push({
          submission_id: row.submission_id,
          user_id: submission.user_id,
          author_role: row.author_role,
          created_at: row.created_at,
        });
      }
    }

    return buildCourseAnalytics({
      students,
      lessons: lessons ?? [],
      progress,
      blockProgress: blockProgress.map(({ user_id, lesson_id, completed_at }) => ({
        user_id,
        lesson_id,
        completed_at,
      })),
      submissions,
      homeworkMessages,
      homeworkBlocks: (homeworkBlocks ?? []).map((block) => ({
        id: block.id,
        lesson_id: block.lesson_id,
        content:
          typeof block.content === "object" &&
          block.content !== null &&
          !Array.isArray(block.content)
            ? (block.content as Record<string, unknown>)
            : {},
      })),
      sqlAttempts,
      quizAttempts,
      lessonQuestionAnswers,
    });
  });

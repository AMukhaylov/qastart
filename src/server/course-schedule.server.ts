import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { courseDay, lessonOpensAt } from "@/lib/course-schedule";

export async function getCourseScheduleForUser(userId: string, now = new Date()) {
  const [{ data: profile, error: profileError }, { data: adminRole, error: roleError }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("course_start_at").eq("id", userId).maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("user_id")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);
  if (profileError) throw profileError;
  if (roleError) throw roleError;
  if (!profile) throw new Error("Профиль ученика не найден");
  return {
    courseStartAt: profile.course_start_at,
    currentDay: courseDay(profile.course_start_at, now),
    isAdmin: Boolean(adminRole),
  };
}

export async function getLessonScheduleAccess(userId: string, dayNumber: number) {
  const schedule = await getCourseScheduleForUser(userId);
  const opensAt = schedule.courseStartAt ? lessonOpensAt(schedule.courseStartAt, dayNumber) : null;
  return {
    ...schedule,
    opensAt,
    allowed: schedule.isAdmin || (schedule.currentDay >= dayNumber && dayNumber >= 1),
  };
}

export async function assertLessonScheduleAccess(userId: string, dayNumber: number) {
  const access = await getLessonScheduleAccess(userId, dayNumber);
  if (!access.allowed) throw new Error("Урок пока недоступен по расписанию обучения");
  return access;
}

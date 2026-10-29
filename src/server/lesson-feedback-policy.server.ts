import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function isStudentInOptionalFeedbackCohort(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("group_students")
    .select("group_id")
    .eq("student_id", userId)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

export async function isFeedbackRequiredForStudent(userId: string, lessonId: string) {
  const [
    { data: global, error: globalError },
    { data: local, error: localError },
    isOptionalCohort,
  ] = await Promise.all([
    supabaseAdmin
      .from("lesson_feedback_course_settings")
      .select("required_by_default")
      .eq("id", true)
      .single(),
    supabaseAdmin
      .from("lesson_feedback_settings")
      .select("required_override")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
    isStudentInOptionalFeedbackCohort(userId),
  ]);
  if (globalError) throw globalError;
  if (localError) throw localError;
  return !isOptionalCohort && (local?.required_override ?? global?.required_by_default ?? false);
}

export async function getStudentSequenceLock(userId: string, dayNumber: number) {
  if (dayNumber <= 1 || (await isStudentInOptionalFeedbackCohort(userId))) return null;
  const { data: previousLessons, error: lessonError } = await supabaseAdmin
    .from("lessons")
    .select("id,day_number")
    .lt("day_number", dayNumber)
    .order("day_number");
  if (lessonError) throw lessonError;
  if (!previousLessons?.length) return null;
  const lessonIds = previousLessons.map((lesson) => lesson.id);
  const [
    { data: progressRows, error: progressError },
    { data: global, error: globalError },
    { data: overrides, error: overridesError },
  ] = await Promise.all([
    supabaseAdmin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("completed", true)
      .in("lesson_id", lessonIds),
    supabaseAdmin
      .from("lesson_feedback_course_settings")
      .select("required_by_default")
      .eq("id", true)
      .single(),
    supabaseAdmin
      .from("lesson_feedback_settings")
      .select("lesson_id,required_override")
      .in("lesson_id", lessonIds),
  ]);
  if (progressError) throw progressError;
  if (globalError) throw globalError;
  if (overridesError) throw overridesError;
  const completed = new Set((progressRows ?? []).map((row) => row.lesson_id));
  const overridesByLesson = new Map(
    (overrides ?? []).map((row) => [row.lesson_id, row.required_override]),
  );
  const blockingLesson = previousLessons.find((lesson) => {
    const required = overridesByLesson.get(lesson.id) ?? global.required_by_default;
    return required && !completed.has(lesson.id);
  });
  return blockingLesson ? { previousLessonDay: blockingLesson.day_number } : null;
}

export async function getStudentFeedbackProgressionDay(
  userId: string,
  scheduleDay: number,
  lessons: Array<{ id: string; day_number: number }>,
  completedLessonIds: Set<string>,
) {
  if ((await isStudentInOptionalFeedbackCohort(userId)) || scheduleDay <= 0) return scheduleDay;
  const availableLessons = [...lessons]
    .filter((lesson) => lesson.day_number <= scheduleDay)
    .sort((a, b) => a.day_number - b.day_number);
  if (!availableLessons.length) return scheduleDay;
  const { data: global, error: globalError } = await supabaseAdmin
    .from("lesson_feedback_course_settings")
    .select("required_by_default")
    .eq("id", true)
    .single();
  if (globalError) throw globalError;
  const { data: overrides, error: overridesError } = await supabaseAdmin
    .from("lesson_feedback_settings")
    .select("lesson_id,required_override")
    .in(
      "lesson_id",
      availableLessons.map((lesson) => lesson.id),
    );
  if (overridesError) throw overridesError;
  const overridesByLesson = new Map(
    (overrides ?? []).map((row) => [row.lesson_id, row.required_override]),
  );
  const firstIncompleteRequired = availableLessons.find(
    (lesson) =>
      !completedLessonIds.has(lesson.id) &&
      (overridesByLesson.get(lesson.id) ?? global.required_by_default),
  );
  return firstIncompleteRequired?.day_number ?? scheduleDay;
}

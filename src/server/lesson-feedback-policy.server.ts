import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { resolveLessonFeedbackRequirement } from "@/lib/lesson-feedback-validation";

export type StudentFeedbackPolicy = {
  isInGroup: boolean;
  lessonRequired: boolean;
  courseRequired: boolean;
  allowLessonSkip: boolean;
  lessonFormsEnabled: boolean;
};

/**
 * Resolve explicit cohort settings. Membership only selects a cohort policy;
 * it never implies that feedback is optional or mandatory by itself.
 * When a student belongs to multiple groups, the strictest policy wins.
 */
export async function getStudentFeedbackPolicy(userId: string): Promise<StudentFeedbackPolicy> {
  const [{ data: memberships, error: membershipError }, { data: defaults, error: defaultsError }] =
    await Promise.all([
      supabaseAdmin.from("group_students").select("group_id").eq("student_id", userId),
      supabaseAdmin
        .from("lesson_feedback_course_settings")
        .select("required_by_default,enabled_by_default,course_feedback_required_by_default")
        .eq("id", true)
        .single(),
    ]);
  if (membershipError) throw membershipError;
  if (defaultsError) throw defaultsError;

  const groupIds = [...new Set((memberships ?? []).map((row) => row.group_id))];
  if (!groupIds.length) {
    return {
      isInGroup: false,
      lessonRequired: defaults.required_by_default,
      courseRequired: defaults.course_feedback_required_by_default,
      allowLessonSkip: false,
      lessonFormsEnabled: defaults.enabled_by_default || defaults.required_by_default,
    };
  }

  const { data: groups, error: groupsError } = await supabaseAdmin
    .from("student_groups")
    .select("lesson_feedback_required,course_feedback_required,allow_feedback_skip")
    .in("id", groupIds);
  if (groupsError) throw groupsError;
  const groupRows = groups ?? [];
  const lessonRequired = groupRows.some((group) => group.lesson_feedback_required);
  return {
    isInGroup: true,
    lessonRequired,
    courseRequired: groupRows.some((group) => group.course_feedback_required),
    allowLessonSkip: groupRows.some((group) => group.allow_feedback_skip),
    lessonFormsEnabled: defaults.enabled_by_default || lessonRequired,
  };
}

export async function isFeedbackRequiredForStudent(userId: string, lessonId: string) {
  const [{ data: local, error: localError }, policy] = await Promise.all([
    supabaseAdmin
      .from("lesson_feedback_settings")
      .select("required_override")
      .eq("lesson_id", lessonId)
      .maybeSingle(),
    getStudentFeedbackPolicy(userId),
  ]);
  if (localError) throw localError;
  return resolveLessonFeedbackRequirement({
    isInGroup: policy.isInGroup,
    cohortRequired: policy.lessonRequired,
    lessonOverride: local?.required_override,
  });
}

export async function isCourseFeedbackRequiredForStudent(userId: string) {
  return (await getStudentFeedbackPolicy(userId)).courseRequired;
}

export async function getStudentSequenceLock(userId: string, dayNumber: number) {
  if (dayNumber <= 1) return null;
  const { data: previousLessons, error: lessonError } = await supabaseAdmin
    .from("lessons")
    .select("id,day_number")
    .lt("day_number", dayNumber)
    .lt("day_number", 14)
    .order("day_number");
  if (lessonError) throw lessonError;
  if (!previousLessons?.length) return null;
  const lessonIds = previousLessons.map((lesson) => lesson.id);
  const [
    { data: progressRows, error: progressError },
    { data: overrides, error: overridesError },
    policy,
  ] = await Promise.all([
    supabaseAdmin
      .from("lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("completed", true)
      .in("lesson_id", lessonIds),
    supabaseAdmin
      .from("lesson_feedback_settings")
      .select("lesson_id,required_override")
      .in("lesson_id", lessonIds),
    getStudentFeedbackPolicy(userId),
  ]);
  if (progressError) throw progressError;
  if (overridesError) throw overridesError;
  const completed = new Set((progressRows ?? []).map((row) => row.lesson_id));
  const overridesByLesson = new Map(
    (overrides ?? []).map((row) => [row.lesson_id, row.required_override]),
  );
  const blockingLesson = previousLessons.find((lesson) => {
    const required = resolveLessonFeedbackRequirement({
      isInGroup: policy.isInGroup,
      cohortRequired: policy.lessonRequired,
      lessonOverride: overridesByLesson.get(lesson.id),
    });
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
  if (scheduleDay <= 0) return scheduleDay;
  const availableLessons = [...lessons]
    .filter((lesson) => lesson.day_number <= scheduleDay && lesson.day_number < 14)
    .sort((a, b) => a.day_number - b.day_number);
  if (!availableLessons.length) return scheduleDay;
  const policy = await getStudentFeedbackPolicy(userId);
  const { data: overrides, error } = await supabaseAdmin
    .from("lesson_feedback_settings")
    .select("lesson_id,required_override")
    .in(
      "lesson_id",
      availableLessons.map((lesson) => lesson.id),
    );
  if (error) throw error;
  const overridesByLesson = new Map(
    (overrides ?? []).map((row) => [row.lesson_id, row.required_override]),
  );
  const firstIncompleteRequired = availableLessons.find(
    (lesson) =>
      !completedLessonIds.has(lesson.id) &&
      resolveLessonFeedbackRequirement({
        isInGroup: policy.isInGroup,
        cohortRequired: policy.lessonRequired,
        lessonOverride: overridesByLesson.get(lesson.id),
      }),
  );
  return firstIncompleteRequired?.day_number ?? scheduleDay;
}

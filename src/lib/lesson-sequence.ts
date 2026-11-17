export type CourseLessonDay = { id: string; day_number: number };

/** Ordinary lessons open by schedule; only the practice (13) and final test (14)
 * wait for completion of all earlier course days. */
export function getAvailableCourseDay(
  scheduleDay: number,
  lessons: CourseLessonDay[],
  completedLessonIds: Set<string>,
) {
  if (scheduleDay < 13) return scheduleDay;
  const orderedLessons = [...lessons].sort((a, b) => a.day_number - b.day_number);
  const firstIncompleteBeforePractice = orderedLessons.find(
    (lesson) =>
      lesson.day_number >= 1 && lesson.day_number <= 12 && !completedLessonIds.has(lesson.id),
  );
  if (firstIncompleteBeforePractice) return Math.min(scheduleDay, 12);
  if (scheduleDay < 14) return scheduleDay;
  const practice = orderedLessons.find((lesson) => lesson.day_number === 13);
  return practice && !completedLessonIds.has(practice.id) ? 13 : scheduleDay;
}

export function getFirstIncompletePrerequisiteDay(
  lessonDay: number,
  lessons: CourseLessonDay[],
  completedLessonIds: Set<string>,
) {
  if (lessonDay < 13) return null;
  return (
    [...lessons]
      .filter(
        (lesson) =>
          lesson.day_number >= 1 && lesson.day_number < lessonDay && lesson.day_number <= 13,
      )
      .sort((a, b) => a.day_number - b.day_number)
      .find((lesson) => !completedLessonIds.has(lesson.id))?.day_number ?? null
  );
}

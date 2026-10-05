export function applyFinalQuizCompletion(
  progressLessonIds: Iterable<string>,
  finalLessonId: string | undefined,
  finalQuizPassed: boolean,
) {
  const completedIds = new Set(progressLessonIds);
  if (finalLessonId) {
    if (finalQuizPassed) completedIds.add(finalLessonId);
    else completedIds.delete(finalLessonId);
  }
  return completedIds;
}

export type LessonGuideVariant =
  | "intro"
  | "explain"
  | "important"
  | "question"
  | "task"
  | "pending"
  | "success";

export const lessonGuideArtworkPosition: Record<LessonGuideVariant, string> = {
  intro: "0% 0%",
  explain: "50% 0%",
  important: "100% 0%",
  question: "0% 100%",
  task: "50% 100%",
  pending: "center",
  success: "100% 100%",
};

export const lessonGuideVariantLabels: Record<LessonGuideVariant, string> = {
  intro: "Знакомство",
  explain: "Объяснение",
  important: "Важный акцент",
  question: "Вопрос",
  task: "Задание",
  pending: "Почти завершено",
  success: "Завершение",
};

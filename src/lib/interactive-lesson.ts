export const lessonBlockTypes = [
  "heading",
  "text",
  "definition",
  "important",
  "example",
  "diagram",
  "image",
  "video",
  "question",
  "code",
  "summary",
  "homework",
] as const;

export type LessonBlockType = (typeof lessonBlockTypes)[number];

export type LessonBlock = {
  id: string;
  lesson_id: string;
  block_type: LessonBlockType;
  position: number;
  content: Record<string, unknown>;
};

export type LessonBlockDraft = Pick<LessonBlock, "block_type" | "content"> & { id?: string };

export type CompletionCondition =
  | "viewed"
  | "question_correct"
  | "video_watched"
  | "task_completed"
  | "homework_submitted";

export const lessonBlockLabels: Record<LessonBlockType, string> = {
  heading: "Заголовок",
  text: "Текст",
  definition: "Определение",
  important: "Важная мысль",
  example: "Пример",
  diagram: "Схема",
  image: "Изображение",
  video: "Видео",
  question: "Вопрос",
  code: "Код",
  summary: "Главное из урока",
  homework: "Домашнее задание",
};

export function stringValue(content: Record<string, unknown>, key: string, fallback = "") {
  const value = content[key];
  return typeof value === "string" ? value : fallback;
}

export function stringList(content: Record<string, unknown>, key: string) {
  const value = content[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function isBlockRequired(block: Pick<LessonBlock, "block_type" | "content">) {
  if (block.content.required === false) return false;
  if (block.block_type === "homework") return block.content.homeworkRequiredForCompletion === true;
  return true;
}

export function blocksNext(block: Pick<LessonBlock, "content">) {
  return block.content.blocksNext !== false;
}

export function blockCompletionCondition(
  block: Pick<LessonBlock, "block_type" | "content">,
): CompletionCondition {
  const explicit = block.content.completionCondition;
  if (
    explicit === "viewed" ||
    explicit === "question_correct" ||
    explicit === "video_watched" ||
    explicit === "task_completed" ||
    explicit === "homework_submitted"
  ) {
    return explicit;
  }
  if (block.block_type === "question") return "question_correct";
  if (block.block_type === "video") return "video_watched";
  if (block.block_type === "homework") return "homework_submitted";
  return "viewed";
}

export function createLessonBlock(type: LessonBlockType): LessonBlockDraft {
  const defaults: Record<LessonBlockType, Record<string, unknown>> = {
    heading: { title: "Новый раздел" },
    text: { markdown: "Новый текст" },
    definition: { term: "Термин", text: "Короткое и понятное определение." },
    important: { title: "Важная мысль", text: "Главная мысль этого раздела." },
    example: {
      title: "Пример",
      expected: "Ожидание",
      actual: "Фактический результат",
      conclusion: "Вывод",
    },
    diagram: { title: "Схема", steps: ["Первый шаг", "Следующий шаг"] },
    image: { url: "", alt: "", caption: "" },
    video: { url: "", title: "Дополнительное видео", required: false },
    question: {
      question: "Вопрос для закрепления",
      options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
      correctIndex: 0,
      explanation: "Объясните правильный ответ.",
    },
    code: { language: "text", code: "" },
    summary: { title: "Главное из урока", items: [], points: [] },
    homework: {
      title: "Домашнее задание",
      instruction: "Опишите задание для ученика.",
      submitHint: "",
      homeworkRequiredForCompletion: false,
    },
  };
  return { block_type: type, content: defaults[type] };
}

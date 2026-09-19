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
    video: { url: "", title: "Дополнительное видео" },
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
    },
  };
  return { block_type: type, content: defaults[type] };
}

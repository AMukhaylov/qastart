export const lessonBlockTypes = [
  "heading",
  "text",
  "definition",
  "important",
  "guide",
  "example",
  "diagram",
  "state_diagram",
  "table",
  "image",
  "video",
  "question",
  "reflection",
  "visual_choice",
  "code",
  "summary",
  "final_quiz",
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
  | "homework_submitted"
  | "all_sql_tasks_passed";

export type SqlSandboxTable = {
  columns: Array<{ name: string; type?: "INTEGER" | "REAL" | "TEXT" | "NUMERIC" | "BLOB" }>;
  rows: Array<Array<string | number | null>>;
};

export type SqlSandboxStatement = "SELECT" | "INSERT" | "UPDATE" | "DELETE";

export type SqlSandboxTask = {
  id: string;
  title: string;
  instruction: string;
  hint?: string;
  successMessage?: string;
  expectedColumns: string[];
  expectedRows: Array<Array<string | number | null>>;
  orderSensitive?: boolean;
  starterSql?: string;
  /** Read-only SELECT executed after a mutation that does not use RETURNING. */
  verificationQuery?: string;
};

export type SqlSandboxConfig = {
  engine?: "sqlite";
  /** Legacy true keeps older SELECT-only lesson packages read-only. */
  readOnly?: boolean;
  allowStatements?: SqlSandboxStatement[];
  resetDatabaseBeforeEachRun?: true;
  showSchema?: boolean;
  showResultTable?: boolean;
  showRunButton?: boolean;
  runButtonLabel?: string;
  progressLabel?: string;
  tables: Record<string, SqlSandboxTable>;
  tasks: SqlSandboxTask[];
};

export const lessonBlockLabels: Record<LessonBlockType, string> = {
  heading: "Заголовок",
  text: "Текст",
  definition: "Определение",
  important: "Важная мысль",
  guide: "Подсказка проводника",
  example: "Пример",
  diagram: "Схема",
  state_diagram: "Диаграмма состояний",
  table: "Таблица",
  image: "Изображение",
  video: "Видео",
  question: "Вопрос",
  reflection: "Открытый вопрос",
  visual_choice: "Визуальная активность",
  code: "Код",
  summary: "Главное из урока",
  final_quiz: "Итоговый тест",
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

export type StateDiagramPosition = { x: number; y: number };
export type StateDiagramViewport = { x: number; y: number; zoom: number };
export type StateDiagramState = { id: string; label: string; position?: StateDiagramPosition };
export type StateDiagramTransition = {
  id?: string;
  from: string;
  to: string;
  label?: string;
  edgeType?: "auto" | "straight" | "bezier" | "smoothstep";
  sourceHandle?: string;
  targetHandle?: string;
};
export type LessonTableColumn = { id: string; label: string };
export type LessonTableCell = string | number | null;
export type LessonTableRow = Record<string, LessonTableCell>;

export function stateDiagramStates(content: Record<string, unknown>): StateDiagramState[] {
  return Array.isArray(content.states)
    ? content.states.filter(
        (state): state is StateDiagramState =>
          typeof state === "object" &&
          state !== null &&
          typeof (state as Record<string, unknown>).id === "string" &&
          typeof (state as Record<string, unknown>).label === "string",
      )
    : [];
}

export function stateDiagramTransitions(
  content: Record<string, unknown>,
): StateDiagramTransition[] {
  return Array.isArray(content.transitions)
    ? content.transitions.filter(
        (transition): transition is StateDiagramTransition =>
          typeof transition === "object" &&
          transition !== null &&
          typeof (transition as Record<string, unknown>).from === "string" &&
          typeof (transition as Record<string, unknown>).to === "string" &&
          ((transition as Record<string, unknown>).label === undefined ||
            typeof (transition as Record<string, unknown>).label === "string"),
      )
    : [];
}

export function lessonTableColumns(content: Record<string, unknown>): LessonTableColumn[] {
  return Array.isArray(content.columns)
    ? content.columns.filter(
        (column): column is LessonTableColumn =>
          typeof column === "object" &&
          column !== null &&
          typeof (column as Record<string, unknown>).id === "string" &&
          typeof (column as Record<string, unknown>).label === "string",
      )
    : [];
}

export function lessonTableRows(content: Record<string, unknown>): LessonTableRow[] {
  return Array.isArray(content.rows)
    ? content.rows.filter(
        (row): row is LessonTableRow =>
          typeof row === "object" &&
          row !== null &&
          !Array.isArray(row) &&
          Object.values(row).every(
            (cell) =>
              cell === null ||
              typeof cell === "string" ||
              (typeof cell === "number" && Number.isFinite(cell)),
          ),
      )
    : [];
}

export function isBlockRequired(block: Pick<LessonBlock, "block_type" | "content">) {
  if (block.content.visible === false) return false;
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
    explicit === "homework_submitted" ||
    explicit === "all_sql_tasks_passed"
  ) {
    return explicit;
  }
  if (block.block_type === "question") return "question_correct";
  if (block.block_type === "video") return "video_watched";
  if (block.block_type === "homework")
    return block.content.mode === "sql_sandbox" ? "all_sql_tasks_passed" : "homework_submitted";
  return "viewed";
}

export function createLessonBlock(type: LessonBlockType): LessonBlockDraft {
  const defaults: Record<LessonBlockType, Record<string, unknown>> = {
    heading: { title: "Новый раздел" },
    text: { markdown: "Новый текст" },
    definition: { term: "Термин", text: "Короткое и понятное определение." },
    important: { title: "Важная мысль", text: "Главная мысль этого раздела." },
    guide: {
      variant: "explain",
      title: "Подсказка",
      text: "Коротко поясните, на что обратить внимание в этом месте урока.",
      visible: true,
      required: false,
    },
    example: {
      title: "Пример",
      expected: "Ожидание",
      actual: "Фактический результат",
      conclusion: "Вывод",
    },
    diagram: { title: "Схема", steps: ["Первый шаг", "Следующий шаг"] },
    state_diagram: {
      title: "Диаграмма состояний",
      states: [
        { id: "state-1", label: "Создан", position: { x: 70, y: 70 } },
        { id: "state-2", label: "Завершён", position: { x: 330, y: 70 } },
      ],
      transitions: [
        { id: "transition-1", from: "state-1", to: "state-2", label: "Действие выполнено" },
      ],
      initialState: "state-1",
      finalStates: ["state-2"],
    },
    table: {
      title: "Таблица",
      columns: [
        { id: "column-1", label: "Колонка 1" },
        { id: "column-2", label: "Колонка 2" },
      ],
      rows: [{ "column-1": "Значение 1", "column-2": "Значение 2" }],
    },
    image: { url: "", alt: "", caption: "" },
    video: { url: "", title: "Дополнительное видео", required: false },
    question: {
      questionType: "single_choice",
      question: "Вопрос для закрепления",
      options: ["Вариант 1", "Вариант 2", "Вариант 3", "Вариант 4"],
      correctIndex: 0,
      explanation: "Объясните правильный ответ.",
    },
    reflection: {
      prompt: "О чём ты бы подумал?",
      hint: "Напиши 1–3 идеи.",
      feedback: "Здесь нет единственного правильного ответа.",
      required: false,
    },
    visual_choice: {
      title: "Посмотри на форму",
      prompt: "Что стоит проверить?",
      options: ["Пустые поля", "Неверный пароль", "Кнопка входа"],
      correctAnswers: [0, 1],
      explanation: "Проверки начинаются с разных условий.",
      required: false,
    },
    code: { language: "text", code: "" },
    summary: { title: "Главное из урока", items: [], points: [] },
    final_quiz: {},
    homework: {
      title: "Домашнее задание",
      instruction: "Опишите задание для ученика.",
      completionVariant: "success",
      completionTitle: "День пройден",
      completionText:
        "Домашнее задание отправлено на проверку. Следующий урок уже доступен, а результат проверки появится здесь, как только наставник его проверит.",
      completionVisible: true,
      homeworkRequiredForCompletion: false,
    },
  };
  return { block_type: type, content: defaults[type] };
}

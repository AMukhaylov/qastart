import { type LessonGuideVariant } from "./lesson-guide.ts";
import {
  lessonBlockTypes,
  type LessonBlockDraft,
  type LessonBlockType,
} from "./interactive-lesson.ts";

export const lessonPackageSchemaVersion = "1.0";

export const characterCatalog = [
  { key: "character_intro", variant: "intro", description: "Персонаж знакомит с темой." },
  { key: "character_explain", variant: "explain", description: "Персонаж объясняет новую мысль." },
  {
    key: "character_important",
    variant: "important",
    description: "Персонаж выделяет важный акцент.",
  },
  {
    key: "character_question",
    variant: "question",
    description: "Персонаж задаёт вопрос ученику.",
  },
  {
    key: "character_task",
    variant: "task",
    description: "Персонаж сопровождает практическое задание.",
  },
  {
    key: "character_success",
    variant: "success",
    description: "Персонаж завершает этап или урок.",
  },
] as const satisfies readonly { key: string; variant: LessonGuideVariant; description: string }[];

export type CharacterKey = (typeof characterCatalog)[number]["key"];

export type PortableLesson = {
  day: number;
  title: string;
  description: string;
  videoUrl?: string;
  contentMarkdown?: string;
  homeworkMarkdown?: string;
  blocks: PortableLessonBlock[];
};

export type PortableLessonBlock = Record<string, unknown> & { type: LessonBlockType };

export type LessonPackage = {
  schemaVersion: typeof lessonPackageSchemaVersion;
  lesson: PortableLesson;
};

export type LessonPackageIssue = {
  path: string;
  message: string;
};

export type LessonPackageValidation =
  | { valid: true; value: LessonPackage; warnings: LessonPackageIssue[] }
  | { valid: false; errors: LessonPackageIssue[]; warnings: LessonPackageIssue[] };

/**
 * Reads lesson JSON and migrates the display-style day value produced by an
 * older exporter (for example, `2 из 14`) to the stable numeric format.
 *
 * The unquoted form was not valid JSON, but it was shipped by an earlier
 * admin build. Keeping this small compatibility shim makes already exported
 * lessons recoverable while all new exports remain strict JSON.
 */
export function parseLessonPackageJson(text: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const repaired = text.replace(/("day"\s*:\s*)(\d+)\s+из\s+\d+/giu, "$1$2");
    if (repaired === text) throw error;
    parsed = JSON.parse(repaired);
  }
  if (isRecord(parsed) && isRecord(parsed.lesson)) {
    const day = parsed.lesson.day;
    const match = typeof day === "string" ? day.match(/^\s*(\d+)\s+из\s+\d+\s*$/iu) : null;
    if (match) {
      parsed = { ...parsed, lesson: { ...parsed.lesson, day: Number(match[1]) } };
    }
  }
  return normalizeLegacyHomeworkGuides(parsed);
}

/**
 * Older lesson packages kept the guide immediately before homework inside the
 * homework block itself. Keep those packages importable, but turn the guide
 * into a normal, independently sortable block before validation.
 */
function normalizeLegacyHomeworkGuides(parsed: unknown): unknown {
  if (!isRecord(parsed) || !isRecord(parsed.lesson) || !Array.isArray(parsed.lesson.blocks)) {
    return parsed;
  }

  let migrated = false;
  const blocks = parsed.lesson.blocks.flatMap((rawBlock) => {
    if (!isRecord(rawBlock) || rawBlock.type !== "homework") return [rawBlock];
    const hasLegacyGuide = ["guideTitle", "guideText", "guideVariant"].some(
      (key) => key in rawBlock,
    );
    const hasLegacySubmitHint = "submitHint" in rawBlock;
    if (!hasLegacyGuide && !hasLegacySubmitHint) return [rawBlock];

    const {
      guideTitle,
      guideText,
      guideVariant,
      submitHint: _ignoredSubmitHint,
      ...homework
    } = rawBlock;
    migrated = true;
    if (!hasLegacyGuide) return [homework];
    return [
      {
        type: "guide",
        character: characterKeyForVariant(guideVariant),
        title:
          typeof guideTitle === "string" && guideTitle.trim()
            ? guideTitle
            : "Самостоятельная практика",
        text:
          typeof guideText === "string" && guideText.trim()
            ? guideText
            : "Здесь можно применить знания на своей задаче.",
        visible: homework.visible !== false,
        required: false,
        blocksNext: false,
      },
      homework,
    ];
  });

  return migrated ? { ...parsed, lesson: { ...parsed.lesson, blocks } } : parsed;
}

type BlockField = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

type BlockCatalogEntry = {
  type: LessonBlockType;
  title: string;
  description: string;
  fields: BlockField[];
  example: PortableLessonBlock;
};

const commonFields: BlockField[] = [
  { name: "visible", type: "boolean", description: "Показывать блок ученику. По умолчанию true." },
  {
    name: "required",
    type: "boolean",
    description: "Учитывать блок в прогрессе. По умолчанию true.",
  },
  {
    name: "blocksNext",
    type: "boolean",
    description: "Открывает следующий этап после выполнения. По умолчанию true.",
  },
  {
    name: "completionCondition",
    type: "viewed | question_correct | video_watched | task_completed | homework_submitted",
    description: "Когда блок считается выполненным.",
  },
];

export const lessonBlockCatalog: BlockCatalogEntry[] = [
  {
    type: "heading",
    title: "Заголовок",
    description: "Начинает смысловой раздел урока.",
    fields: [
      { name: "title", type: "string", required: true, description: "Текст заголовка." },
      { name: "eyebrow", type: "string", description: "Надзаголовок." },
      { name: "startsStep", type: "boolean", description: "Начать новый этап урока." },
      {
        name: "revision",
        type: "number",
        description: "Служебная редакция блока из ранних уроков. Обычно не требуется.",
      },
      ...commonFields,
    ],
    example: { type: "heading", title: "Что такое тестирование" },
  },
  {
    type: "text",
    title: "Текст",
    description: "Основное объяснение. Поддерживает ограниченный Markdown.",
    fields: [
      { name: "markdown", type: "string", required: true, description: "Текст в Markdown." },
      ...commonFields,
    ],
    example: { type: "text", markdown: "Сначала разберёмся, зачем команде проверки." },
  },
  {
    type: "definition",
    title: "Определение",
    description: "Короткое понятное определение термина.",
    fields: [
      { name: "term", type: "string", required: true, description: "Термин." },
      { name: "text", type: "string", required: true, description: "Определение." },
      ...commonFields,
    ],
    example: {
      type: "definition",
      term: "Тестирование ПО",
      text: "Исследование продукта, которое помогает узнать о его качестве.",
    },
  },
  {
    type: "important",
    title: "Важная мысль",
    description: "Выделяет ключевую мысль в отдельной карточке.",
    fields: [
      { name: "title", type: "string", required: true, description: "Заголовок." },
      { name: "text", type: "string", required: true, description: "Текст мысли." },
      ...commonFields,
    ],
    example: {
      type: "important",
      title: "Важно",
      text: "Тестирование не может доказать отсутствие всех ошибок.",
    },
  },
  {
    type: "guide",
    title: "Подсказка проводника",
    description:
      "Самостоятельная плашка с персонажем QA Start. Её можно поставить в любую часть урока, в том числе перед или после ДЗ.",
    fields: [
      {
        name: "character",
        type: "character key",
        required: true,
        description: "Ключ изображения персонажа из character-catalog.json.",
      },
      { name: "title", type: "string", required: true, description: "Заголовок подсказки." },
      { name: "text", type: "string", required: true, description: "Короткая подсказка ученику." },
      ...commonFields,
    ],
    example: {
      type: "guide",
      character: "character_explain",
      title: "На что смотреть",
      text: "Сначала сформулируй ожидание, затем сравни его с результатом.",
    },
  },
  {
    type: "example",
    title: "Пример",
    description: "Сравнивает ожидание, фактический результат и вывод.",
    fields: [
      { name: "title", type: "string", required: true, description: "Название примера." },
      {
        name: "expectedTitle",
        type: "string",
        description: "Свободный заголовок первой секции. По умолчанию «Ожидание».",
      },
      { name: "expected", type: "string", required: true, description: "Ожидание." },
      {
        name: "actualTitle",
        type: "string",
        description: "Свободный заголовок второй секции. По умолчанию «Фактический результат».",
      },
      { name: "actual", type: "string", required: true, description: "Фактический результат." },
      {
        name: "conclusionTitle",
        type: "string",
        description: "Свободный заголовок третьей секции. По умолчанию «Вывод».",
      },
      { name: "conclusion", type: "string", required: true, description: "Вывод." },
      ...commonFields,
    ],
    example: {
      type: "example",
      title: "Вход в аккаунт",
      expected: "Открывается кабинет.",
      actual: "Появляется ошибка.",
      conclusion: "Результаты не совпали.",
    },
  },
  {
    type: "diagram",
    title: "Схема",
    description: "Последовательность шагов.",
    fields: [
      { name: "title", type: "string", required: true, description: "Название схемы." },
      { name: "steps", type: "string[]", required: true, description: "Шаги по порядку." },
      ...commonFields,
    ],
    example: { type: "diagram", title: "Проверка", steps: ["Ожидание", "Действие", "Результат"] },
  },
  {
    type: "state_diagram",
    title: "Диаграмма состояний",
    description: "Состояния объекта и разрешённые переходы между ними, включая ветвления.",
    fields: [
      { name: "title", type: "string", required: true, description: "Название диаграммы." },
      {
        name: "states",
        type: "{ id, label, position? }[]",
        required: true,
        description: "Состояния с уникальными идентификаторами.",
      },
      {
        name: "transitions",
        type: "{ id?, from, to, label?, edgeType?, sourceHandle?, targetHandle? }[]",
        required: true,
        description: "Переходы между состояниями; label — событие или условие.",
      },
      { name: "initialState", type: "string", description: "Необязательное начальное состояние." },
      { name: "finalStates", type: "string[]", description: "Необязательные финальные состояния." },
      {
        name: "viewport",
        type: "{ x, y, zoom }",
        description: "Необязательный сохранённый viewport редактора.",
      },
      ...commonFields,
    ],
    example: {
      type: "state_diagram",
      title: "Жизненный цикл заказа",
      states: [
        { id: "created", label: "Создан", position: { x: 80, y: 120 } },
        { id: "paid", label: "Оплачен", position: { x: 360, y: 120 } },
      ],
      transitions: [
        {
          id: "created-paid",
          from: "created",
          to: "paid",
          label: "Оплата прошла",
          edgeType: "smoothstep",
        },
      ],
      initialState: "created",
      finalStates: ["paid"],
    },
  },
  {
    type: "table",
    title: "Таблица",
    description: "Универсальная таблица с произвольными колонками и строками.",
    fields: [
      { name: "title", type: "string", required: true, description: "Заголовок таблицы." },
      {
        name: "columns",
        type: "{ id, label }[]",
        required: true,
        description: "Колонки с уникальными идентификаторами и заголовками.",
      },
      {
        name: "rows",
        type: "{ [columnId]: string }[]",
        required: true,
        description: "Строки: ключ каждой ячейки совпадает с id колонки.",
      },
      ...commonFields,
    ],
    example: {
      type: "table",
      title: "Таблица принятия решений",
      columns: [
        { id: "condition", label: "Условие" },
        { id: "result", label: "Результат" },
      ],
      rows: [{ condition: "Да", result: "Выполнить действие" }],
    },
  },
  {
    type: "image",
    title: "Изображение",
    description: "Внешнее изображение с альтернативным описанием и подписью.",
    fields: [
      { name: "url", type: "string", required: true, description: "URL изображения." },
      { name: "alt", type: "string", required: true, description: "Описание для доступности." },
      { name: "caption", type: "string", description: "Подпись под изображением." },
      ...commonFields,
    ],
    example: {
      type: "image",
      url: "https://example.com/screen.png",
      alt: "Форма входа",
      caption: "Пример формы.",
    },
  },
  {
    type: "video",
    title: "Видео",
    description: "Встроенное дополнительное видео.",
    fields: [
      { name: "title", type: "string", required: true, description: "Название видео." },
      { name: "url", type: "string", description: "Embed URL, если видео уже загружено." },
      {
        name: "description",
        type: "string",
        description: "Краткое описание или текст для видеозаглушки.",
      },
      ...commonFields,
    ],
    example: { type: "video", title: "Разбор примера", url: "https://example.com/embed/video" },
  },
  {
    type: "question",
    title: "Вопрос",
    description: "Один ответ, несколько ответов, верно/неверно или ситуационная задача.",
    fields: [
      {
        name: "questionType",
        type: "single_choice | multiple_choice | true_false | scenario",
        required: true,
        description: "Вид вопроса.",
      },
      { name: "question", type: "string", required: true, description: "Вопрос." },
      { name: "options", type: "string[]", required: true, description: "Варианты ответа." },
      {
        name: "correctIndex",
        type: "number",
        description: "Индекс правильного ответа для одного ответа, с нуля.",
      },
      {
        name: "correctAnswers",
        type: "number[]",
        description: "Индексы правильных ответов для multiple_choice, с нуля.",
      },
      { name: "explanation", type: "string", required: true, description: "Разбор ответа." },
      ...commonFields,
    ],
    example: {
      type: "question",
      questionType: "single_choice",
      question: "Что сравнивает тестировщик?",
      options: ["Ожидание и результат", "Цвета кнопок"],
      correctIndex: 0,
      explanation: "Тестирование сравнивает ожидаемое и фактическое поведение.",
    },
  },
  {
    type: "reflection",
    title: "Открытый вопрос",
    description: "Неоцениваемая рефлексия с подсказкой после ответа.",
    fields: [
      { name: "prompt", type: "string", required: true, description: "Вопрос ученику." },
      { name: "hint", type: "string", required: true, description: "Подсказка до ответа." },
      { name: "feedback", type: "string", required: true, description: "Текст после ответа." },
      ...commonFields,
    ],
    example: {
      type: "reflection",
      prompt: "Что бы ты проверил?",
      hint: "Напиши 1–3 идеи.",
      feedback: "Можно проверить пустые поля и неверный пароль.",
    },
  },
  {
    type: "visual_choice",
    title: "Визуальная активность",
    description: "Выбор идей проверки по визуальному примеру формы входа.",
    fields: [
      { name: "title", type: "string", required: true, description: "Название активности." },
      { name: "prompt", type: "string", required: true, description: "Инструкция." },
      { name: "options", type: "string[]", required: true, description: "Варианты проверки." },
      {
        name: "correctAnswers",
        type: "number[]",
        required: true,
        description: "Индексы верных вариантов, с нуля.",
      },
      { name: "explanation", type: "string", required: true, description: "Разбор." },
      ...commonFields,
    ],
    example: {
      type: "visual_choice",
      title: "Форма входа",
      prompt: "Что стоит проверить?",
      options: ["Пустые поля", "Погоду"],
      correctAnswers: [0],
      explanation: "Пустые поля относятся к форме.",
    },
  },
  {
    type: "code",
    title: "Код",
    description: "Фрагмент кода или команды.",
    fields: [
      { name: "language", type: "string", required: true, description: "Язык или формат." },
      { name: "code", type: "string", required: true, description: "Код." },
      ...commonFields,
    ],
    example: { type: "code", language: "http", code: "GET /api/users" },
  },
  {
    type: "summary",
    title: "Главное из урока",
    description: "Итоговый словарь и ключевые мысли.",
    fields: [
      { name: "title", type: "string", required: true, description: "Заголовок блока." },
      {
        name: "items",
        type: "{ term, definition }[]",
        required: true,
        description: "Термины и определения.",
      },
      { name: "points", type: "string[]", required: true, description: "Главные мысли." },
      ...commonFields,
    ],
    example: {
      type: "summary",
      title: "Главное из урока",
      items: [{ term: "Тестирование", definition: "Исследование продукта." }],
      points: ["Сначала узнаём ожидание."],
    },
  },
  {
    type: "homework",
    title: "Домашнее задание",
    description:
      "Практическое задание с необязательной проверкой завершения. Вводную плашку создавай отдельным блоком guide и располагай рядом только при необходимости.",
    fields: [
      { name: "title", type: "string", required: true, description: "Название задания." },
      { name: "instruction", type: "string", required: true, description: "Что сделать." },
      {
        name: "completionTitle",
        type: "string",
        description: "Заголовок карточки после отправки ДЗ.",
      },
      {
        name: "completionText",
        type: "string",
        description: "Текст карточки после отправки ДЗ.",
      },
      {
        name: "completionVariant",
        type: "intro | explain | important | question | task | pending | success",
        description: "Изображение персонажа в карточке после отправки ДЗ.",
      },
      {
        name: "completionVisible",
        type: "boolean",
        description: "Показывать ли карточку после отправки ДЗ. По умолчанию true.",
      },
      {
        name: "homeworkRequiredForCompletion",
        type: "boolean",
        description: "Нужно ли отправить ДЗ для завершения урока.",
      },
      ...commonFields,
    ],
    example: {
      type: "homework",
      title: "Практика",
      instruction: "Опиши один сценарий проверки.",
      completionTitle: "День пройден",
      completionText:
        "Домашнее задание отправлено на проверку. Следующий урок уже доступен, а результат проверки появится здесь, как только наставник его проверит.",
      completionVariant: "success",
    },
  },
];

const blockCatalogByType = new Map(lessonBlockCatalog.map((block) => [block.type, block]));
const commonKeys = new Set(["type", "visible", "required", "blocksNext", "completionCondition"]);
const completionConditions = new Set([
  "viewed",
  "question_correct",
  "video_watched",
  "task_completed",
  "homework_submitted",
]);
const questionTypes = new Set(["single_choice", "multiple_choice", "true_false", "scenario"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isIndexArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item) && item >= 0);
}

function isNamedIdList(value: unknown): value is { id: string; label: string }[] {
  return (
    Array.isArray(value) &&
    value.every((item) => isRecord(item) && nonEmptyString(item.id) && nonEmptyString(item.label))
  );
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function nearest(value: string, candidates: readonly string[]) {
  const distance = (left: string, right: string) => {
    const rows = Array.from({ length: left.length + 1 }, (_, index) => [index]);
    for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
    for (let row = 1; row <= left.length; row += 1) {
      for (let column = 1; column <= right.length; column += 1) {
        rows[row][column] =
          left[row - 1] === right[column - 1]
            ? rows[row - 1][column - 1]
            : Math.min(rows[row - 1][column], rows[row][column - 1], rows[row - 1][column - 1]) + 1;
      }
    }
    return rows[left.length][right.length];
  };
  const found = [...candidates].sort((a, b) => distance(value, a) - distance(value, b))[0];
  return found && distance(value, found) <= Math.max(3, Math.floor(value.length / 2))
    ? found
    : null;
}

function issue(path: string, message: string): LessonPackageIssue {
  return { path, message };
}

function validateCommon(
  block: Record<string, unknown>,
  path: string,
  errors: LessonPackageIssue[],
) {
  for (const key of ["visible", "required", "blocksNext"]) {
    if (key in block && typeof block[key] !== "boolean")
      errors.push(issue(path, `поле "${key}" должно быть boolean.`));
  }
  if (
    "completionCondition" in block &&
    !completionConditions.has(String(block.completionCondition))
  ) {
    errors.push(
      issue(path, `неизвестное условие выполнения "${String(block.completionCondition)}".`),
    );
  }
}

function validateBlock(block: unknown, index: number, errors: LessonPackageIssue[]) {
  const path = `Блок ${index + 1}`;
  if (!isRecord(block)) {
    errors.push(issue(path, "должен быть объектом."));
    return;
  }
  if (!nonEmptyString(block.type)) {
    errors.push(issue(path, "не указан тип блока."));
    return;
  }
  if (!lessonBlockTypes.includes(block.type as LessonBlockType)) {
    const suggestion = nearest(block.type, lessonBlockTypes);
    errors.push(
      issue(
        path,
        `неизвестный тип "${block.type}".${suggestion ? ` Возможно, имелось в виду "${suggestion}".` : ""}`,
      ),
    );
    return;
  }
  const type = block.type as LessonBlockType;
  const catalog = blockCatalogByType.get(type)!;
  const allowed = new Set([...commonKeys, ...catalog.fields.map((field) => field.name)]);
  for (const key of Object.keys(block)) {
    if (!allowed.has(key))
      errors.push(issue(path, `неизвестное поле "${key}" для типа "${type}".`));
  }
  validateCommon(block, path, errors);
  for (const field of catalog.fields.filter((item) => item.required)) {
    const value = block[field.name];
    if (value === undefined || value === null || (typeof value === "string" && !value.trim())) {
      errors.push(issue(path, `не заполнено обязательное поле "${field.name}".`));
    }
  }
  const mustBeStrings = {
    heading: ["title"],
    text: ["markdown"],
    definition: ["term", "text"],
    important: ["title", "text"],
    guide: ["title", "text", "character"],
    example: ["title", "expected", "actual", "conclusion"],
    diagram: ["title"],
    state_diagram: ["title"],
    table: ["title"],
    image: ["url", "alt"],
    video: ["title"],
    question: ["question", "questionType", "explanation"],
    reflection: ["prompt", "hint", "feedback"],
    visual_choice: ["title", "prompt", "explanation"],
    code: ["language", "code"],
    summary: ["title"],
    homework: ["title", "instruction"],
  } as const;
  for (const key of mustBeStrings[type]) {
    if (!nonEmptyString(block[key]))
      errors.push(issue(path, `поле "${key}" должно быть непустой строкой.`));
  }
  if (
    type === "guide" &&
    !characterCatalog.some((character) => character.key === block.character)
  ) {
    const suggestion =
      typeof block.character === "string"
        ? nearest(
            block.character,
            characterCatalog.map((item) => item.key),
          )
        : null;
    errors.push(
      issue(
        path,
        `неизвестный ключ персонажа "${String(block.character)}".${suggestion ? ` Возможно, имелось в виду "${suggestion}".` : ""}`,
      ),
    );
  }
  if (
    type === "diagram" &&
    (!isStringArray(block.steps) ||
      block.steps.length < 2 ||
      block.steps.some((step) => !step.trim()))
  )
    errors.push(issue(path, "поле " + '"steps" должно содержать минимум два непустых шага.'));
  if (type === "state_diagram") validateStateDiagram(block, path, errors);
  if (type === "table") validateTable(block, path, errors);
  if (type === "question") validateQuestion(block, path, errors);
  if (type === "visual_choice") {
    const options = isStringArray(block.options) ? block.options : null;
    if (!isStringArray(block.options) || block.options.length < 2)
      errors.push(issue(path, 'поле "options" должно содержать минимум два варианта.'));
    if (!isIndexArray(block.correctAnswers) || block.correctAnswers.length === 0)
      errors.push(issue(path, 'нужен минимум один правильный вариант в "correctAnswers".'));
    else if (options && block.correctAnswers.some((answer) => answer >= options.length))
      errors.push(issue(path, 'индекс в "correctAnswers" выходит за границы вариантов.'));
  }
  if (type === "summary") {
    if (
      !Array.isArray(block.items) ||
      !block.items.every(
        (item) => isRecord(item) && nonEmptyString(item.term) && nonEmptyString(item.definition),
      )
    )
      errors.push(issue(path, 'поле "items" должно содержать объекты { term, definition }.'));
    if (!isStringArray(block.points))
      errors.push(issue(path, 'поле "points" должно быть массивом строк.'));
  }
  if (
    type === "homework" &&
    "homeworkRequiredForCompletion" in block &&
    typeof block.homeworkRequiredForCompletion !== "boolean"
  )
    errors.push(issue(path, 'поле "homeworkRequiredForCompletion" должно быть boolean.'));
}

function validateStateDiagram(
  block: Record<string, unknown>,
  path: string,
  errors: LessonPackageIssue[],
) {
  if (!isNamedIdList(block.states) || block.states.length < 2) {
    errors.push(issue(path, 'поле "states" должно содержать минимум два состояния { id, label }.'));
    return;
  }
  const stateIds = block.states.map((state) => state.id);
  const stateIdSet = new Set(stateIds);
  if (stateIdSet.size !== stateIds.length)
    errors.push(issue(path, 'идентификаторы в "states" должны быть уникальными.'));
  block.states.forEach((state, index) => {
    if ("position" in state) {
      if (
        !isRecord(state.position) ||
        !Number.isFinite(state.position.x) ||
        !Number.isFinite(state.position.y)
      )
        errors.push(issue(path, `координаты состояния ${index + 1} должны содержать числа x и y.`));
    }
  });
  if (!Array.isArray(block.transitions)) {
    errors.push(issue(path, 'поле "transitions" должно быть массивом переходов.'));
  } else {
    block.transitions.forEach((transition, index) => {
      if (
        !isRecord(transition) ||
        !nonEmptyString(transition.from) ||
        !nonEmptyString(transition.to)
      ) {
        errors.push(
          issue(path, `переход ${index + 1} должен содержать непустые поля "from" и "to".`),
        );
        return;
      }
      if ("label" in transition && typeof transition.label !== "string")
        errors.push(issue(path, `подпись перехода ${index + 1} должна быть строкой.`));
      if ("id" in transition && !nonEmptyString(transition.id))
        errors.push(issue(path, `id перехода ${index + 1} должен быть непустой строкой.`));
      if (
        "edgeType" in transition &&
        !["auto", "straight", "bezier", "smoothstep"].includes(String(transition.edgeType))
      )
        errors.push(issue(path, `тип линии перехода ${index + 1} неизвестен.`));
      for (const key of ["sourceHandle", "targetHandle"])
        if (key in transition && typeof transition[key] !== "string")
          errors.push(issue(path, `${key} перехода ${index + 1} должен быть строкой.`));
      if (!stateIdSet.has(transition.from) || !stateIdSet.has(transition.to))
        errors.push(issue(path, `переход ${index + 1} ссылается на несуществующее состояние.`));
    });
  }
  if (
    "initialState" in block &&
    (!nonEmptyString(block.initialState) || !stateIdSet.has(block.initialState))
  )
    errors.push(issue(path, 'поле "initialState" должно ссылаться на состояние из "states".'));
  if ("finalStates" in block) {
    if (
      !isStringArray(block.finalStates) ||
      block.finalStates.some((state) => !stateIdSet.has(state))
    )
      errors.push(issue(path, 'поле "finalStates" должно содержать id состояний из "states".'));
  }
  if ("viewport" in block) {
    if (
      !isRecord(block.viewport) ||
      !Number.isFinite(block.viewport.x) ||
      !Number.isFinite(block.viewport.y) ||
      !Number.isFinite(block.viewport.zoom) ||
      Number(block.viewport.zoom) <= 0
    )
      errors.push(issue(path, 'поле "viewport" должно содержать числа x, y и положительный zoom.'));
  }
}

function validateTable(block: Record<string, unknown>, path: string, errors: LessonPackageIssue[]) {
  if (!isNamedIdList(block.columns) || block.columns.length < 1 || block.columns.length > 10) {
    errors.push(issue(path, 'поле "columns" должно содержать от 1 до 10 колонок { id, label }.'));
    return;
  }
  const columnIds = block.columns.map((column) => column.id);
  const columnIdSet = new Set(columnIds);
  if (columnIdSet.size !== columnIds.length)
    errors.push(issue(path, 'идентификаторы в "columns" должны быть уникальными.'));
  if (!Array.isArray(block.rows) || block.rows.length > 30) {
    errors.push(issue(path, 'поле "rows" должно содержать не более 30 строк.'));
    return;
  }
  block.rows.forEach((row, index) => {
    if (!isRecord(row)) {
      errors.push(issue(path, `строка ${index + 1} должна быть объектом.`));
      return;
    }
    for (const columnId of columnIds) {
      if (typeof row[columnId] !== "string")
        errors.push(issue(path, `в строке ${index + 1} нет текстовой ячейки "${columnId}".`));
    }
    for (const key of Object.keys(row)) {
      if (!columnIdSet.has(key))
        errors.push(issue(path, `в строке ${index + 1} есть неизвестная колонка "${key}".`));
    }
  });
}

function validateQuestion(
  block: Record<string, unknown>,
  path: string,
  errors: LessonPackageIssue[],
) {
  const type = String(block.questionType);
  if (!questionTypes.has(type)) {
    errors.push(issue(path, `неизвестный тип вопроса "${type}".`));
    return;
  }
  if (!isStringArray(block.options) || block.options.length < 2) {
    errors.push(issue(path, 'поле "options" должно содержать минимум два варианта.'));
    return;
  }
  const options = block.options;
  if (type === "true_false" && options.length !== 2)
    errors.push(issue(path, "для true_false нужны ровно два варианта."));
  if (type === "multiple_choice") {
    if (!isIndexArray(block.correctAnswers) || block.correctAnswers.length === 0)
      errors.push(issue(path, 'для multiple_choice нужен минимум один индекс в "correctAnswers".'));
    else if (block.correctAnswers.some((answer) => answer >= options.length))
      errors.push(issue(path, 'индекс в "correctAnswers" выходит за границы вариантов.'));
  } else if (
    !Number.isInteger(block.correctIndex) ||
    Number(block.correctIndex) < 0 ||
    Number(block.correctIndex) >= options.length
  ) {
    errors.push(issue(path, 'нужен корректный "correctIndex" от 0 до последнего варианта.'));
  }
}

export function validateLessonPackage(raw: unknown): LessonPackageValidation {
  const errors: LessonPackageIssue[] = [];
  const warnings: LessonPackageIssue[] = [];
  if (!isRecord(raw))
    return {
      valid: false,
      errors: [issue("Файл", "корневой JSON должен быть объектом.")],
      warnings,
    };
  const rootKeys = new Set(["schemaVersion", "lesson"]);
  for (const key of Object.keys(raw))
    if (!rootKeys.has(key)) errors.push(issue("Файл", `неизвестное поле "${key}".`));
  if (raw.schemaVersion !== lessonPackageSchemaVersion)
    errors.push(
      issue(
        "Файл",
        `неподдерживаемая schemaVersion "${String(raw.schemaVersion)}". Поддерживается "${lessonPackageSchemaVersion}".`,
      ),
    );
  if (!isRecord(raw.lesson))
    return {
      valid: false,
      errors: [...errors, issue("Урок", "поле lesson должно быть объектом.")],
      warnings,
    };
  const lesson = raw.lesson;
  const lessonKeys = new Set([
    "day",
    "title",
    "description",
    "videoUrl",
    "contentMarkdown",
    "homeworkMarkdown",
    "blocks",
  ]);
  for (const key of Object.keys(lesson))
    if (!lessonKeys.has(key)) errors.push(issue("Урок", `неизвестное поле "${key}".`));
  if (!Number.isInteger(lesson.day) || Number(lesson.day) < 1)
    errors.push(issue("Урок", "день должен быть целым числом от 1."));
  if (!nonEmptyString(lesson.title)) errors.push(issue("Урок", "не заполнено название."));
  if (typeof lesson.description !== "string")
    errors.push(issue("Урок", "описание должно быть строкой."));
  for (const key of ["videoUrl", "contentMarkdown", "homeworkMarkdown"])
    if (key in lesson && typeof lesson[key] !== "string")
      errors.push(issue("Урок", `поле "${key}" должно быть строкой.`));
  if (!Array.isArray(lesson.blocks) || lesson.blocks.length === 0)
    errors.push(issue("Урок", "нужен хотя бы один блок."));
  else lesson.blocks.forEach((block, index) => validateBlock(block, index, errors));
  if (
    Array.isArray(lesson.blocks) &&
    !lesson.blocks.some((block) => isRecord(block) && block.type === "summary")
  )
    warnings.push(
      issue(
        "Урок",
        "нет блока summary. В правилах QA Start рекомендуется содержательный блок «Главное из урока».",
      ),
    );
  return errors.length
    ? { valid: false, errors, warnings }
    : { valid: true, value: raw as unknown as LessonPackage, warnings };
}

function copyCommon(content: Record<string, unknown>) {
  const output: Record<string, unknown> = {};
  for (const key of ["visible", "required", "blocksNext", "completionCondition"])
    if (key in content) output[key] = content[key];
  return output;
}

function characterKeyForVariant(value: unknown): CharacterKey {
  if (typeof value === "string" && characterCatalog.some((character) => character.key === value)) {
    return value as CharacterKey;
  }
  return (
    characterCatalog.find((character) => character.variant === value)?.key ?? "character_explain"
  );
}

function variantForCharacter(value: unknown): LessonGuideVariant {
  return characterCatalog.find((character) => character.key === value)?.variant ?? "explain";
}

export function exportLessonPackage(
  lesson: {
    day_number: number;
    title: string;
    description: string;
    video_url: string | null;
    content_md: string;
    homework_md: string;
  },
  blocks: LessonBlockDraft[],
): LessonPackage {
  const rawDay = lesson.day_number;
  const day =
    typeof rawDay === "number"
      ? rawDay
      : Number(String(rawDay).match(/^\s*(\d+)/)?.[1] ?? Number.NaN);
  if (!Number.isInteger(day) || day < 1) throw new Error("Неверный номер дня для экспорта урока");
  return {
    schemaVersion: lessonPackageSchemaVersion,
    lesson: {
      day,
      title: lesson.title,
      description: lesson.description,
      ...(lesson.video_url ? { videoUrl: lesson.video_url } : {}),
      ...(lesson.content_md ? { contentMarkdown: lesson.content_md } : {}),
      ...(lesson.homework_md ? { homeworkMarkdown: lesson.homework_md } : {}),
      blocks: blocks.map((block) => exportBlock(block)),
    },
  };
}

function exportBlock(block: LessonBlockDraft): PortableLessonBlock {
  const { block_type, content } = block;
  const common = copyCommon(content);
  const fields: Record<string, unknown> = { ...content };
  // submitHint was part of the legacy homework shape. Keep old records
  // importable, but never emit the removed field in new lesson packages.
  if (block_type === "homework") delete fields.submitHint;
  for (const key of ["visible", "required", "blocksNext", "completionCondition"])
    delete fields[key];
  if (block_type === "guide") {
    delete fields.variant;
    fields.character = characterKeyForVariant(content.variant);
  }
  if (block_type === "question" && !nonEmptyString(fields.questionType)) {
    fields.questionType = Array.isArray(fields.correctAnswers)
      ? "multiple_choice"
      : "single_choice";
  }
  if (block_type === "summary") {
    fields.items = Array.isArray(content.items)
      ? content.items
          .filter((item): item is [unknown, unknown] => Array.isArray(item) && item.length >= 2)
          .map(([term, definition]) => ({ term: String(term), definition: String(definition) }))
      : [];
  }
  return { type: block_type, ...fields, ...common } as PortableLessonBlock;
}

export function importLessonPackage(value: LessonPackage): {
  lesson: Omit<PortableLesson, "blocks"> & {
    video_url: string | null;
    content_md: string;
    homework_md: string;
  };
  blocks: LessonBlockDraft[];
} {
  return {
    lesson: {
      day: value.lesson.day,
      title: value.lesson.title,
      description: value.lesson.description,
      video_url: value.lesson.videoUrl || null,
      content_md: value.lesson.contentMarkdown || "",
      homework_md: value.lesson.homeworkMarkdown || "",
    },
    blocks: value.lesson.blocks.map((block) => {
      const { type, ...content } = block;
      if (type === "guide") {
        const character = content.character;
        delete content.character;
        content.variant = variantForCharacter(character);
      }
      if (type === "summary" && Array.isArray(content.items)) {
        content.items = content.items.map((item) => {
          const source = item as Record<string, unknown>;
          return [String(source.term ?? ""), String(source.definition ?? "")];
        });
      }
      return { block_type: type, content } as LessonBlockDraft;
    }),
  };
}

type LessonJsonSchemaNode = Record<string, unknown>;

function jsonType(type: string): LessonJsonSchemaNode {
  if (type === "{ id, label }[]" || type === "{ id, label, position? }[]") {
    return {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label"],
        properties: {
          id: { type: "string", minLength: 1 },
          label: { type: "string", minLength: 1 },
          ...(type.includes("position")
            ? {
                position: {
                  type: "object",
                  additionalProperties: false,
                  required: ["x", "y"],
                  properties: { x: { type: "number" }, y: { type: "number" } },
                },
              }
            : {}),
        },
      },
    };
  }
  if (type === "{ from, to, label? }[]" || type.startsWith("{ id?, from, to")) {
    return {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to"],
        properties: {
          ...(type.startsWith("{ id?") ? { id: { type: "string", minLength: 1 } } : {}),
          from: { type: "string", minLength: 1 },
          to: { type: "string", minLength: 1 },
          label: { type: "string" },
          ...(type.startsWith("{ id?")
            ? {
                edgeType: { enum: ["auto", "straight", "bezier", "smoothstep"] },
                sourceHandle: { type: "string" },
                targetHandle: { type: "string" },
              }
            : {}),
        },
      },
    };
  }
  if (type === "{ x, y, zoom }") {
    return {
      type: "object",
      additionalProperties: false,
      required: ["x", "y", "zoom"],
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        zoom: { type: "number", exclusiveMinimum: 0 },
      },
    };
  }
  if (type === "{ [columnId]: string }[]") {
    return { type: "array", items: { type: "object", additionalProperties: { type: "string" } } };
  }
  if (type.endsWith("[]")) {
    const itemType = type.slice(0, -2);
    return { type: "array", items: jsonType(itemType) };
  }
  if (type === "boolean") return { type: "boolean" };
  if (type === "number") return { type: "integer" };
  return { type: "string" };
}

export function getLessonJsonSchema() {
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "QA Start lesson package",
    type: "object",
    additionalProperties: false,
    required: ["schemaVersion", "lesson"],
    properties: {
      schemaVersion: { const: lessonPackageSchemaVersion },
      lesson: {
        type: "object",
        additionalProperties: false,
        required: ["day", "title", "description", "blocks"],
        properties: {
          day: { type: "integer", minimum: 1 },
          title: { type: "string", minLength: 1 },
          description: { type: "string" },
          videoUrl: { type: "string" },
          contentMarkdown: { type: "string" },
          homeworkMarkdown: { type: "string" },
          blocks: {
            type: "array",
            minItems: 1,
            items: {
              oneOf: lessonBlockCatalog.map((entry) => ({
                type: "object",
                additionalProperties: false,
                required: [
                  "type",
                  ...entry.fields.filter((field) => field.required).map((field) => field.name),
                ],
                properties: Object.fromEntries([
                  ["type", { const: entry.type }],
                  ...entry.fields.map((field) => [field.name, jsonType(field.type)]),
                ]),
              })),
            },
          },
        },
      },
    },
  };
}

export function buildAiKitReadme() {
  return `# QA Start AI kit\n\nЭтот набор помогает подготовить урок QA Start в JSON и импортировать его через админку.\n\n## Как работать\n\n1. Прочитайте LESSON_GUIDELINES.md.\n2. Изучите example-lesson.json. Это экспорт актуального Дня 1, эталона качества QA Start.\n3. Выберите только подходящие блоки из block-catalog.json.\n4. Используйте изображения персонажа только из character-catalog.json.\n5. Проверьте lesson-schema.json и создайте JSON с schemaVersion "${lessonPackageSchemaVersion}".\n\n## Важное\n\n- Урок описывается структурированным JSON, а не одним HTML-файлом.\n- Порядок элементов в blocks определяет порядок урока.\n- Не указывайте ID базы данных.\n- Для подсказки проводника используйте type "guide" и ключ character, например "character_explain".\n- Используйте только реально поддерживаемые типы блоков.\n- Для state_diagram задавайте states с id, label и необязательными position { x, y }; transitions могут образовывать ветвления, возвраты, циклы и self-loop.\n- Для table задавайте произвольные columns { id, label } и rows с текстовыми значениями по этим id.\n- Каждый следующий блок должен логично отвечать на предыдущий или развивать его.\n`;
}

function crc32(bytes: Uint8Array) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function writeUInt16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}
function writeUInt32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

export function createZip(files: Record<string, string>) {
  const encoder = new TextEncoder();
  const entries = Object.entries(files).map(([name, body]) => ({
    name: encoder.encode(name),
    body: encoder.encode(body),
  }));
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const checksum = crc32(entry.body);
    const header = new Uint8Array(30 + entry.name.length);
    const view = new DataView(header.buffer);
    writeUInt32(view, 0, 0x04034b50);
    writeUInt16(view, 4, 20);
    writeUInt16(view, 8, 0);
    writeUInt16(view, 10, 0);
    writeUInt32(view, 14, checksum);
    writeUInt32(view, 18, entry.body.length);
    writeUInt32(view, 22, entry.body.length);
    writeUInt16(view, 26, entry.name.length);
    writeUInt16(view, 28, 0);
    header.set(entry.name, 30);
    chunks.push(header, entry.body);
    const directory = new Uint8Array(46 + entry.name.length);
    const directoryView = new DataView(directory.buffer);
    writeUInt32(directoryView, 0, 0x02014b50);
    writeUInt16(directoryView, 4, 20);
    writeUInt16(directoryView, 6, 20);
    writeUInt16(directoryView, 10, 0);
    writeUInt16(directoryView, 12, 0);
    writeUInt32(directoryView, 16, checksum);
    writeUInt32(directoryView, 20, entry.body.length);
    writeUInt32(directoryView, 24, entry.body.length);
    writeUInt16(directoryView, 28, entry.name.length);
    writeUInt16(directoryView, 30, 0);
    writeUInt16(directoryView, 32, 0);
    writeUInt32(directoryView, 42, offset);
    directory.set(entry.name, 46);
    central.push(directory);
    offset += header.length + entry.body.length;
  }
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeUInt32(endView, 0, 0x06054b50);
  writeUInt16(endView, 8, entries.length);
  writeUInt16(endView, 10, entries.length);
  writeUInt32(endView, 12, centralSize);
  writeUInt32(endView, 16, offset);
  const output = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const chunk of [...chunks, ...central, end]) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}

export function createAiKitFiles(exampleLesson: LessonPackage, guidelines: string) {
  return {
    "README.md": buildAiKitReadme(),
    "lesson-schema.json": JSON.stringify(getLessonJsonSchema(), null, 2),
    "block-catalog.json": JSON.stringify(lessonBlockCatalog, null, 2),
    "character-catalog.json": JSON.stringify(characterCatalog, null, 2),
    "example-lesson.json": JSON.stringify(exampleLesson, null, 2),
    "LESSON_GUIDELINES.md": guidelines,
  };
}

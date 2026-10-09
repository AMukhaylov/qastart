import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  BookOpen,
  CheckCircle2,
  CheckSquare2,
  Circle,
  CircleAlert,
  Eye,
  Code2,
  Lightbulb,
  LockKeyhole,
  Loader2,
  MessageCircleQuestion,
  PlayCircle,
  Square,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { LessonGuide } from "@/components/lesson-guide";
import { LessonRichContent } from "@/components/lesson-rich-content";
import { SqlSandboxHomework } from "@/components/sql-sandbox-homework";
import type { LessonGuideVariant } from "@/lib/lesson-guide";
import {
  blockCompletionCondition,
  blocksNext,
  isBlockRequired,
  lessonTableColumns,
  lessonTableRows,
  LessonBlock,
  stringList,
  stringValue,
} from "@/lib/interactive-lesson";
import type { SqlSandboxConfig } from "@/lib/interactive-lesson";

const StateDiagramCanvas = lazy(() =>
  import("@/components/state-diagram").then((module) => ({ default: module.StateDiagramCanvas })),
);

type InteractiveLessonProps = {
  blocks: LessonBlock[];
  completedBlockIds: Set<string>;
  onBlocksCompleted: (blockIds: string[]) => Promise<boolean> | void;
  onQuestionAnswered?: (
    blockId: string,
    selectedIndexes: number[],
  ) => Promise<boolean | { saved: boolean; isCorrect: boolean }> | boolean | void;
  legacyContent?: string;
  lessonDay: number;
  lessonTitle: string;
  previousDay?: number;
  previewMode?: boolean;
  renderHomework?: (block: LessonBlock) => ReactNode;
  renderFinalQuiz?: (block: LessonBlock) => ReactNode;
};

type StepKind = "material" | "question" | "video" | "homework" | "final_quiz";
type LessonStep = { kind: StepKind; blocks: LessonBlock[] };

function isRequiredVideo(block: LessonBlock) {
  return block.block_type === "video" && isBlockRequired(block) && blocksNext(block);
}

function createSteps(blocks: LessonBlock[]): LessonStep[] {
  const steps: LessonStep[] = [];
  let material: LessonBlock[] = [];
  const flushMaterial = () => {
    if (material.length > 0) steps.push({ kind: "material", blocks: material });
    material = [];
  };

  for (const block of blocks) {
    if (block.block_type === "heading" && block.content.startsStep === true) {
      flushMaterial();
    }
    if (
      ((block.block_type === "question" || block.block_type === "homework") &&
        isBlockRequired(block) &&
        blocksNext(block)) ||
      isRequiredVideo(block) ||
      (block.block_type === "final_quiz" && isBlockRequired(block) && blocksNext(block))
    ) {
      flushMaterial();
      steps.push({
        kind:
          block.block_type === "question"
            ? "question"
            : block.block_type === "homework"
              ? "homework"
              : block.block_type === "final_quiz"
                ? "final_quiz"
                : "video",
        blocks: [block],
      });
    } else {
      material.push(block);
    }
  }
  flushMaterial();
  return steps;
}

export function InteractiveLesson({
  blocks,
  completedBlockIds,
  onBlocksCompleted,
  onQuestionAnswered,
  legacyContent,
  lessonDay,
  previousDay,
  previewMode = false,
  renderHomework,
  renderFinalQuiz,
}: InteractiveLessonProps) {
  const [completingStep, setCompletingStep] = useState<number | null>(null);
  const steps = useMemo(() => createSteps(blocks), [blocks]);
  const isStepCompleted = (step: LessonStep) =>
    step.blocks.filter(isBlockRequired).every((block) => completedBlockIds.has(block.id));
  const activeIndex = steps.findIndex((step) => !isStepCompleted(step));
  const visibleThrough = previewMode || activeIndex === -1 ? steps.length - 1 : activeIndex;
  const activeRef = useRef<HTMLElement | null>(null);
  const previousActiveIndex = useRef<number | null>(null);

  async function completeStep(index: number, requiredIds: string[]) {
    if (completingStep !== null) return;
    setCompletingStep(index);
    try {
      await onBlocksCompleted(requiredIds);
    } finally {
      setCompletingStep(null);
    }
  }

  useEffect(() => {
    const previous = previousActiveIndex.current;
    previousActiveIndex.current = activeIndex;
    if (previewMode) return;
    // Keep the explanation visible after an answer; the learner decides when to move on.
    if (
      previous !== null &&
      previous >= 0 &&
      steps[previous]?.kind === "question" &&
      activeIndex > previous
    )
      return;
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeIndex, previewMode, steps]);

  if (blocks.length === 0) {
    return legacyContent ? (
      <article className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h2 className="mb-4 text-xl font-extrabold">Материалы урока</h2>
        <LessonRichContent content={legacyContent} />
      </article>
    ) : null;
  }

  return (
    <div className="space-y-10 md:space-y-12">
      {steps.slice(0, visibleThrough + 1).map((step, index) => {
        const stepCompleted = isStepCompleted(step);
        const active = index === activeIndex;
        const requiredIds = step.blocks.filter(isBlockRequired).map((block) => block.id);
        return (
          <section
            key={step.blocks.map((block) => block.id).join("-")}
            ref={active ? activeRef : undefined}
            data-lesson-step={index}
            className="scroll-mt-8 space-y-6 md:space-y-7"
          >
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-muted-foreground">
                Часть {index + 1} из {steps.length}
              </span>
              {stepCompleted ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Пройдено
                </span>
              ) : active ? (
                <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                  <LockKeyhole className="h-4 w-4" /> Текущий шаг
                </span>
              ) : null}
            </div>
            {step.blocks.map((block) => {
              if (block.block_type === "homework" && renderHomework) {
                return <div key={block.id}>{renderHomework(block)}</div>;
              }
              if (block.block_type === "final_quiz" && renderFinalQuiz) {
                return <div key={block.id}>{renderFinalQuiz(block)}</div>;
              }
              return (
                <LessonBlockView
                  key={block.id}
                  block={block}
                  completed={completedBlockIds.has(block.id)}
                  onComplete={() => onBlocksCompleted([block.id])}
                  onQuestionAnswered={(selectedIndexes) =>
                    onQuestionAnswered?.(block.id, selectedIndexes)
                  }
                  previewMode={previewMode}
                />
              );
            })}
            {step.kind === "material" && !stepCompleted && !previewMode && (
              <div className="mt-1 flex items-center justify-between gap-3">
                {previousDay ? (
                  <Button asChild variant="soft" size="lg">
                    <Link to="/lessons/$day" params={{ day: String(previousDay) }}>
                      ← День {previousDay}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  variant="hero"
                  disabled={completingStep !== null}
                  onClick={() => void completeStep(index, requiredIds)}
                >
                  {completingStep !== null ? (
                    <span className="inline-flex items-center gap-2" aria-live="polite">
                      <Loader2 className="h-4 w-4 animate-spin" /> Сохраняем прогресс…
                    </span>
                  ) : (
                    "Продолжить"
                  )}
                </Button>
              </div>
            )}
            {step.kind === "video" && !stepCompleted && !previewMode && (
              <div className="mt-1 flex items-center justify-between gap-3">
                {previousDay ? (
                  <Button asChild variant="soft" size="lg">
                    <Link to="/lessons/$day" params={{ day: String(previousDay) }}>
                      ← День {previousDay}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                <Button
                  variant="hero"
                  disabled={completingStep !== null}
                  onClick={() => void completeStep(index, requiredIds)}
                >
                  {completingStep !== null ? (
                    <span className="inline-flex items-center gap-2" aria-live="polite">
                      <Loader2 className="h-4 w-4 animate-spin" /> Сохраняем прогресс…
                    </span>
                  ) : (
                    "Я посмотрел видео — продолжить"
                  )}
                </Button>
              </div>
            )}
            {step.kind === "homework" && !stepCompleted && !previewMode && (
              <p className="pt-1 text-sm text-muted-foreground">
                {step.blocks.some(
                  (block) =>
                    block.block_type === "homework" && block.content.mode === "sql_sandbox",
                )
                  ? "Выполни все SQL-задания ниже, чтобы завершить урок. Ответ наставнику отправлять не нужно."
                  : "Отправьте выполненное задание в форме ниже, чтобы открыть следующий шаг."}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

function LessonBlockView({
  block,
  completed,
  onComplete,
  onQuestionAnswered,
  previewMode = false,
}: {
  block: LessonBlock;
  completed: boolean;
  onComplete: () => Promise<boolean> | void;
  onQuestionAnswered?: (
    selectedIndexes: number[],
  ) => Promise<boolean | { saved: boolean; isCorrect: boolean }> | boolean | void;
  previewMode?: boolean;
}) {
  const c = block.content;
  if (c.visible === false) return null;
  const cardClass =
    "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-7";
  let content: React.ReactNode;

  switch (block.block_type) {
    case "heading":
      content = (
        <div className="px-1 pt-2 md:pt-3">
          {stringValue(c, "eyebrow") && (
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.14em] text-primary">
              {stringValue(c, "eyebrow")}
            </p>
          )}
          <h2 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            {stringValue(c, "title")}
          </h2>
        </div>
      );
      break;
    case "text":
      content = (
        <div className={cardClass}>
          <LessonRichContent content={stringValue(c, "markdown")} />
        </div>
      );
      break;
    case "definition":
      content = (
        <div className="rounded-2xl border border-primary/20 bg-primary-soft p-5 md:p-7">
          <div className="mb-3 inline-flex items-center gap-2 text-sm font-bold text-primary">
            <BookOpen className="h-4 w-4" /> Определение
          </div>
          <h3 className="text-xl font-extrabold">{stringValue(c, "term")}</h3>
          <div className="mt-2 leading-relaxed text-foreground/85">
            <LessonRichContent content={stringValue(c, "text")} />
          </div>
        </div>
      );
      break;
    case "important":
      content = (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-slate-900 md:p-7">
          <div className="flex gap-3">
            <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="font-extrabold">{stringValue(c, "title", "Важная мысль")}</h3>
              <div className="mt-2 leading-relaxed">
                <LessonRichContent content={stringValue(c, "text")} />
              </div>
            </div>
          </div>
        </div>
      );
      break;
    case "guide": {
      const rawVariant = stringValue(c, "variant", "explain");
      const variant: LessonGuideVariant = [
        "intro",
        "explain",
        "important",
        "question",
        "task",
        "success",
      ].includes(rawVariant)
        ? (rawVariant as LessonGuideVariant)
        : "explain";
      content = (
        <LessonGuide
          variant={variant}
          title={stringValue(c, "title", "Подсказка")}
          text={stringValue(c, "text")}
        />
      );
      break;
    }
    case "example":
      content = (
        <div className={cardClass}>
          <h3 className="mb-5 text-xl font-extrabold">{stringValue(c, "title", "Пример")}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <ExamplePart
              title={stringValue(c, "expectedTitle", "Ожидание")}
              text={stringValue(c, "expected")}
              tone="bg-sky-50"
            />
            <ExamplePart
              title={stringValue(c, "actualTitle", "Фактический результат")}
              text={stringValue(c, "actual")}
              tone="bg-amber-50"
            />
            <ExamplePart
              title={stringValue(c, "conclusionTitle", "Вывод")}
              text={stringValue(c, "conclusion")}
              tone="bg-emerald-50"
            />
          </div>
        </div>
      );
      break;
    case "diagram": {
      const steps = stringList(c, "steps");
      content = (
        <div className={cardClass}>
          <h3 className="mb-5 text-xl font-extrabold">{stringValue(c, "title", "Схема")}</h3>
          <div className="flex flex-col items-center gap-2">
            {steps.map((step, index) => (
              <div key={`${step}-${index}`} className="contents">
                <div className="w-full rounded-xl border border-primary/15 bg-primary-soft px-4 py-3 text-center font-semibold text-primary sm:w-4/5">
                  {step}
                </div>
                {index < steps.length - 1 && <ArrowDown className="h-4 w-4 text-primary" />}
              </div>
            ))}
          </div>
        </div>
      );
      break;
    }
    case "state_diagram":
      content = <StateDiagram content={c} cardClass={cardClass} />;
      break;
    case "table":
      content = <LessonTable content={c} cardClass={cardClass} />;
      break;
    case "image": {
      const url = stringValue(c, "url");
      content = url ? (
        <figure className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <img
            src={url}
            alt={stringValue(c, "alt")}
            className="max-h-[540px] w-full object-cover"
          />
          {stringValue(c, "caption") && (
            <figcaption className="px-5 py-3 text-sm text-muted-foreground">
              {stringValue(c, "caption")}
            </figcaption>
          )}
        </figure>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-5 text-sm text-muted-foreground">
          Изображение добавит администратор.
        </div>
      );
      break;
    }
    case "video": {
      const url = stringValue(c, "url");
      content = url ? (
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 px-5 py-4 font-bold">
            <PlayCircle className="h-5 w-5 text-primary" />
            {stringValue(c, "title", "Дополнительное видео")}
          </div>
          <div className="aspect-video bg-muted">
            <iframe
              src={url}
              className="h-full w-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={stringValue(c, "title", "Видео урока")}
            />
          </div>
        </section>
      ) : (
        <section className="overflow-hidden rounded-2xl border border-dashed border-primary/30 bg-primary-soft shadow-[var(--shadow-soft)]">
          <div className="flex aspect-video flex-col items-center justify-center p-6 text-center">
            <PlayCircle className="h-12 w-12 text-primary" />
            <h3 className="mt-3 font-extrabold">
              {stringValue(c, "title", "Дополнительное видео")}
            </h3>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              {stringValue(c, "description", "Видео появится здесь.")}
            </p>
          </div>
        </section>
      );
      break;
    }
    case "question":
      content = (
        <QuestionBlock
          content={c}
          completed={completed}
          onComplete={onComplete}
          onQuestionAnswered={onQuestionAnswered}
        />
      );
      break;
    case "reflection":
      content = <ReflectionBlock content={c} />;
      break;
    case "visual_choice":
      content = <VisualChoiceBlock content={c} />;
      break;
    case "code":
      content = (
        <div className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200">
            <Code2 className="h-4 w-4 text-sky-300" />
            {stringValue(c, "language", "Технический пример")}
          </div>
          <pre className="overflow-x-auto p-5 text-sm leading-relaxed text-slate-100">
            <code>{stringValue(c, "code")}</code>
          </pre>
        </div>
      );
      break;
    case "summary":
      content = <SummaryBlock content={c} />;
      break;
    case "homework":
      // The submission form below the lesson is the single homework card. Keeping the
      // instruction here as well created two identical homework blocks for the learner.
      content =
        c.mode === "sql_sandbox" && c.sandbox ? (
          <SqlSandboxHomework
            title={stringValue(c, "title", "SQL-практика")}
            instruction={stringValue(c, "instruction")}
            successMessage={stringValue(
              c,
              "sqlSandboxCompletionMessage",
              "Все задания выполнены. Молодец!",
            )}
            config={c.sandbox as SqlSandboxConfig}
          />
        ) : previewMode ? (
          <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
            <div className="flex items-center gap-2 text-primary">
              <CheckSquare2 className="h-5 w-5" />
              <span className="font-extrabold">{stringValue(c, "title", "Домашнее задание")}</span>
            </div>
            <div className="mt-3 leading-relaxed text-foreground/85">
              <LessonRichContent content={stringValue(c, "instruction")} />
            </div>
            <textarea
              disabled
              rows={3}
              placeholder="Твой ответ..."
              className="mt-5 w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm"
            />
            <Button className="mt-3" variant="hero" disabled>
              Отправить на проверку
            </Button>
          </section>
        ) : null;
      break;
    case "final_quiz":
      content = previewMode ? (
        <section className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-5 md:p-7">
          <h3 className="text-xl font-extrabold">Итоговый тест</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Здесь ученик сможет пройти итоговый тест курса.
          </p>
        </section>
      ) : null;
      break;
  }
  return content ? <div className="space-y-6 md:space-y-7">{content}</div> : null;
}

function StateDiagram({
  content,
  cardClass,
}: {
  content: Record<string, unknown>;
  cardClass: string;
}) {
  return (
    <section className={cardClass}>
      <h3 className="mb-5 text-xl font-extrabold">
        {stringValue(content, "title", "Диаграмма состояний")}
      </h3>
      <Suspense
        fallback={
          <div className="h-72 animate-pulse rounded-xl border border-border bg-muted/30" />
        }
      >
        <StateDiagramCanvas content={content} />
      </Suspense>
    </section>
  );
}

function LessonTable({
  content,
  cardClass,
}: {
  content: Record<string, unknown>;
  cardClass: string;
}) {
  const columns = lessonTableColumns(content);
  const rows = lessonTableRows(content);
  return (
    <section className={cardClass}>
      <h3 className="mb-5 text-xl font-extrabold">{stringValue(content, "title", "Таблица")}</h3>
      <div className="max-w-full overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-max border-collapse text-left text-sm">
          <thead className="bg-primary-soft text-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.id} className="border-b border-border px-4 py-3 font-bold">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="odd:bg-muted/30">
                {columns.map((column) => (
                  <td key={column.id} className="border-b border-border px-4 py-3 last:border-b-0">
                    {row[column.id] ?? ""}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ReflectionBlock({ content }: { content: Record<string, unknown> }) {
  const [answer, setAnswer] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <section className="rounded-2xl border border-violet-200 bg-violet-50/70 p-5 shadow-[var(--shadow-soft)] md:p-7">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
        <MessageCircleQuestion className="h-4 w-4" /> Подумай как тестировщик
      </div>
      <h3 className="text-xl font-extrabold">{stringValue(content, "prompt")}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{stringValue(content, "hint")}</p>
      <textarea
        value={answer}
        onChange={(event) => setAnswer(event.target.value)}
        disabled={sent}
        rows={3}
        className="mt-4 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        placeholder="Напиши свои идеи..."
      />
      {!sent ? (
        <Button
          className="mt-3"
          variant="soft"
          disabled={!answer.trim()}
          onClick={() => setSent(true)}
        >
          Показать подсказку
        </Button>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
          {stringValue(content, "feedback")}
        </div>
      )}
    </section>
  );
}

function VisualChoiceBlock({ content }: { content: Record<string, unknown> }) {
  const options = stringList(content, "options");
  const correctAnswers = Array.isArray(content.correctAnswers)
    ? content.correctAnswers.filter((item): item is number => typeof item === "number")
    : [];
  const [chosen, setChosen] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  return (
    <section className="rounded-2xl border border-sky-200 bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
        <Eye className="h-4 w-4" /> Визуальная проверка
      </div>
      <h3 className="text-xl font-extrabold">{stringValue(content, "title")}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{stringValue(content, "prompt")}</p>
      <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
        <div className="mx-auto max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-bold">Вход в аккаунт</p>
          <div className="mt-4 text-xs font-semibold">
            <p>Логин</p>
            <div className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal text-slate-500">
              name@example.com
            </div>
          </div>
          <div className="mt-3 text-xs font-semibold">
            <p>Пароль</p>
            <div className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal tracking-widest text-slate-400">
              ••••••••
            </div>
          </div>
          <div className="mt-4 w-full rounded-lg bg-primary px-3 py-2 text-center text-sm font-semibold text-primary-foreground">
            Войти
          </div>
          <p className="mt-3 text-center text-xs text-primary">Забыли пароль?</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            disabled={checked}
            onClick={() =>
              setChosen((value) =>
                value.includes(index) ? value.filter((item) => item !== index) : [...value, index],
              )
            }
            className={`rounded-xl border px-4 py-3 text-left text-sm font-semibold ${chosen.includes(index) ? "border-primary bg-primary-soft" : "border-border bg-background"}`}
          >
            {option}
          </button>
        ))}
      </div>
      {!checked ? (
        <Button
          className="mt-4"
          variant="hero"
          disabled={chosen.length === 0}
          onClick={() => setChecked(true)}
        >
          Проверить идеи
        </Button>
      ) : (
        <div className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-950">
          {stringValue(content, "explanation")}
        </div>
      )}
    </section>
  );
}

function ExamplePart({ title, text, tone }: { title: string; text: string; tone: string }) {
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <p className="text-sm font-bold">{title}</p>
      <div className="mt-2 text-sm leading-relaxed">
        <LessonRichContent content={text} />
      </div>
    </div>
  );
}

function QuestionBlock({
  content,
  completed,
  onComplete,
  onQuestionAnswered,
}: {
  content: Record<string, unknown>;
  completed: boolean;
  onComplete: () => Promise<boolean> | void;
  onQuestionAnswered?: (
    selectedIndexes: number[],
  ) => Promise<boolean | { saved: boolean; isCorrect: boolean }> | boolean | void;
}) {
  const options = stringList(content, "options");
  const correctIndex = typeof content.correctIndex === "number" ? content.correctIndex : 0;
  const questionType = stringValue(content, "questionType", "single_choice");
  const multiple = questionType === "multiple_choice";
  const correctAnswers = Array.isArray(content.correctAnswers)
    ? content.correctAnswers.filter((item): item is number => typeof item === "number")
    : [correctIndex];
  // Completed answers are loaded as progress only, so restore the visible
  // selection from the correct options when the learner returns to the lesson.
  const [selected, setSelected] = useState<number[]>(() => (completed ? correctAnswers : []));
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [incorrectAttempt, setIncorrectAttempt] = useState(false);
  const correct =
    submitted &&
    selected.length === correctAnswers.length &&
    selected.every((index) => correctAnswers.includes(index));
  const answered = submitted || completed;
  const saveAnswer = async (selectedIndexes = selected) => {
    setSaving(true);
    setSaveFailed(false);
    try {
      const answerResult = await onQuestionAnswered?.(selectedIndexes);
      if (answerResult === false || (typeof answerResult === "object" && !answerResult.saved)) {
        setSaveFailed(true);
        return;
      }
      const isCorrect =
        typeof answerResult === "object"
          ? answerResult.isCorrect
          : selectedIndexes.length === correctAnswers.length &&
            selectedIndexes.every((index) => correctAnswers.includes(index));
      if (
        !isCorrect &&
        blockCompletionCondition({ block_type: "question", content }) === "question_correct"
      ) {
        setIncorrectAttempt(true);
        setSubmitted(false);
        setSelected([]);
        return;
      }
      setIncorrectAttempt(false);
      if ((await onComplete()) === false) setSaveFailed(true);
    } catch {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };
  const choose = (index: number) => {
    if (answered) return;
    if (multiple) {
      setSelected((current) =>
        current.includes(index) ? current.filter((item) => item !== index) : [...current, index],
      );
      return;
    }
    setSelected([index]);
    setSubmitted(true);
    void saveAnswer([index]);
  };
  const submitMultiple = () => {
    if (answered) return;
    setSubmitted(true);
    void saveAnswer();
  };
  return (
    <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
        <CircleAlert className="h-4 w-4" /> Проверь себя
      </div>
      <h3 className="text-xl font-extrabold">{stringValue(content, "question")}</h3>
      {multiple && !answered && (
        <p className="mt-3 rounded-lg bg-primary-soft px-4 py-3 text-sm font-semibold text-primary">
          Можно выбрать несколько ответов. Отметь все верные варианты, затем нажми «Проверить
          ответ».
        </p>
      )}
      {incorrectAttempt && !answered && (
        <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
          Пока неверно — попробуй ещё раз. Этот шаг засчитается после правильного ответа.
        </p>
      )}
      <div className="mt-5 space-y-2">
        {options.map((option, index) => {
          const isSelected = selected.includes(index);
          const isCorrectOption = correctAnswers.includes(index);
          const className =
            answered && isCorrectOption
              ? "border-emerald-400 bg-emerald-50"
              : answered && isSelected
                ? "border-red-300 bg-red-50"
                : isSelected
                  ? "border-primary bg-primary-soft"
                  : "border-border hover:border-primary/40 hover:bg-primary-soft";
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              onClick={() => choose(index)}
              disabled={answered}
              aria-pressed={isSelected}
              className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors disabled:cursor-default ${className}`}
            >
              {multiple ? (
                isSelected ? (
                  <CheckSquare2 className="mt-0.5 h-5 w-5 shrink-0 fill-primary text-white" />
                ) : (
                  <Square className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )
              ) : isSelected ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 fill-primary text-white" />
              ) : (
                <Circle className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <span>{option}</span>
            </button>
          );
        })}
      </div>
      {multiple && !answered && (
        <Button
          className="mt-4"
          variant="hero"
          onClick={submitMultiple}
          disabled={selected.length === 0}
        >
          Проверить ответ{selected.length > 0 ? ` (${selected.length})` : ""}
        </Button>
      )}
      {answered && (
        <div
          className={`mt-4 rounded-xl p-4 text-sm ${!submitted ? "bg-primary-soft text-foreground" : correct ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-950"}`}
        >
          <p className="font-bold">
            {!submitted
              ? "Вопрос уже пройден. Повтори правильные варианты."
              : correct
                ? "Верно!"
                : "Неверно. Посмотри разбор ответа."}
          </p>
          <p className="mt-1">{stringValue(content, "explanation")}</p>
          {(!correct || !submitted) && (
            <p className="mt-2 font-semibold">
              {correctAnswers.length > 1 ? "Правильные варианты" : "Правильный вариант"}:{" "}
              {correctAnswers.map((index) => options[index]).join("; ")}
            </p>
          )}
          {saving && <p className="mt-3 text-muted-foreground">Сохраняем ответ…</p>}
          {saveFailed && !completed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void saveAnswer()}
            >
              Повторить сохранение
            </Button>
          )}
        </div>
      )}
    </section>
  );
}

function SummaryBlock({ content }: { content: Record<string, unknown> }) {
  const rawItems = Array.isArray(content.items) ? content.items : [];
  const items = rawItems.filter(
    (item): item is [string, string] =>
      Array.isArray(item) && typeof item[0] === "string" && typeof item[1] === "string",
  );
  const points = stringList(content, "points");
  return (
    <section className="rounded-2xl border border-primary/20 bg-primary-soft p-5 md:p-7">
      <dl className="grid gap-3">
        {items.map(([term, definition]) => (
          <div key={term} className="rounded-xl bg-background/80 p-4">
            <dt className="font-bold">{term}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{definition}</dd>
          </div>
        ))}
      </dl>
      {points.length > 0 && (
        <div className="mt-5">
          <h3 className="font-extrabold">Главные мысли</h3>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed">
            {points.map((point) => (
              <li key={point} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

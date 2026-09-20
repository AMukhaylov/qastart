import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  BookOpen,
  CheckCircle2,
  CircleAlert,
  Code2,
  Lightbulb,
  ListChecks,
  LockKeyhole,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LessonGuide } from "@/components/lesson-guide";
import { LessonRichContent } from "@/components/lesson-rich-content";
import {
  blocksNext,
  isBlockRequired,
  LessonBlock,
  stringList,
  stringValue,
} from "@/lib/interactive-lesson";

type InteractiveLessonProps = {
  blocks: LessonBlock[];
  completedBlockIds: Set<string>;
  onBlocksCompleted: (blockIds: string[]) => Promise<void> | void;
  legacyContent?: string;
  lessonDay: number;
  lessonTitle: string;
};

type StepKind = "material" | "question" | "video" | "homework";
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
    if (
      ((block.block_type === "question" || block.block_type === "homework") &&
        isBlockRequired(block) &&
        blocksNext(block)) ||
      isRequiredVideo(block)
    ) {
      flushMaterial();
      steps.push({
        kind:
          block.block_type === "question"
            ? "question"
            : block.block_type === "homework"
              ? "homework"
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
  legacyContent,
  lessonDay,
  lessonTitle,
}: InteractiveLessonProps) {
  const steps = useMemo(() => createSteps(blocks), [blocks]);
  const isStepCompleted = (step: LessonStep) =>
    step.blocks.filter(isBlockRequired).every((block) => completedBlockIds.has(block.id));
  const activeIndex = steps.findIndex((step) => !isStepCompleted(step));
  const visibleThrough = activeIndex === -1 ? steps.length - 1 : activeIndex;
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [activeIndex]);

  if (blocks.length === 0) {
    return legacyContent ? (
      <article className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] md:p-8">
        <h2 className="mb-4 text-xl font-extrabold">Материалы урока</h2>
        <LessonRichContent content={legacyContent} />
      </article>
    ) : null;
  }

  return (
    <div className="space-y-8">
      <LessonGuide
        variant="intro"
        title={`День ${lessonDay}: ${lessonTitle}`}
        text="Двигайся спокойно: изучи текущую часть, выполни короткое действие и открой следующий шаг."
      />
      {steps.slice(0, visibleThrough + 1).map((step, index) => {
        const stepCompleted = isStepCompleted(step);
        const active = index === activeIndex;
        const requiredIds = step.blocks.filter(isBlockRequired).map((block) => block.id);
        return (
          <section
            key={step.blocks.map((block) => block.id).join("-")}
            ref={active ? activeRef : undefined}
            data-lesson-step={index}
            className="scroll-mt-6"
          >
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
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
            {step.kind === "question" && (
              <LessonGuide
                variant="question"
                title="Проверь себя"
                text="Вопрос опирается только на материал, который уже был выше. Если ошибёшься, сможешь попробовать ещё раз."
              />
            )}
            {step.kind === "homework" && (
              <LessonGuide
                variant="task"
                title="Самостоятельная практика"
                text="Здесь можно применить знания на своей задаче. Обязательность домашнего задания настраивается в редакторе урока."
              />
            )}
            {step.blocks.map((block) => (
              <LessonBlockView
                key={block.id}
                block={block}
                completed={completedBlockIds.has(block.id)}
                onComplete={() => onBlocksCompleted([block.id])}
              />
            ))}
            {step.kind === "material" && !stepCompleted && (
              <Button
                className="mt-5"
                variant="hero"
                onClick={() => onBlocksCompleted(requiredIds)}
              >
                Продолжить
              </Button>
            )}
            {step.kind === "video" && !stepCompleted && (
              <Button
                className="mt-5"
                variant="hero"
                onClick={() => onBlocksCompleted(requiredIds)}
              >
                Я посмотрел видео — продолжить
              </Button>
            )}
            {step.kind === "homework" && !stepCompleted && (
              <p className="mt-4 text-sm text-muted-foreground">
                Отправьте выполненное задание в форме ниже, чтобы открыть следующий шаг.
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
}: {
  block: LessonBlock;
  completed: boolean;
  onComplete: () => Promise<void> | void;
}) {
  const c = block.content;
  const cardClass =
    "rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-7";
  let content: React.ReactNode;

  switch (block.block_type) {
    case "heading":
      content = (
        <div className="px-1 pt-4">
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
          <p className="mt-2 leading-relaxed text-foreground/85">{stringValue(c, "text")}</p>
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
              <p className="mt-2 leading-relaxed">{stringValue(c, "text")}</p>
            </div>
          </div>
        </div>
      );
      break;
    case "example":
      content = (
        <div className={cardClass}>
          <h3 className="mb-5 text-xl font-extrabold">{stringValue(c, "title", "Пример")}</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <ExamplePart title="Ожидание" text={stringValue(c, "expected")} tone="bg-sky-50" />
            <ExamplePart title="Фактически" text={stringValue(c, "actual")} tone="bg-amber-50" />
            <ExamplePart title="Вывод" text={stringValue(c, "conclusion")} tone="bg-emerald-50" />
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
      content = <QuestionBlock content={c} completed={completed} onComplete={onComplete} />;
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
      content = (
        <div className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
          <div className="flex items-center gap-2 text-primary">
            <ListChecks className="h-5 w-5" />
            <span className="font-extrabold">{stringValue(c, "title", "Домашнее задание")}</span>
          </div>
          <p className="mt-3 whitespace-pre-wrap leading-relaxed text-foreground/85">
            {stringValue(c, "instruction")}
          </p>
          {stringValue(c, "submitHint") && (
            <p className="mt-3 text-sm text-muted-foreground">{stringValue(c, "submitHint")}</p>
          )}
        </div>
      );
      break;
  }
  return <div className="space-y-5">{content}</div>;
}

function ExamplePart({ title, text, tone }: { title: string; text: string; tone: string }) {
  return (
    <div className={`rounded-xl p-4 ${tone}`}>
      <p className="text-sm font-bold">{title}</p>
      <p className="mt-2 text-sm leading-relaxed">{text}</p>
    </div>
  );
}

function QuestionBlock({
  content,
  completed,
  onComplete,
}: {
  content: Record<string, unknown>;
  completed: boolean;
  onComplete: () => Promise<void> | void;
}) {
  const options = stringList(content, "options");
  const correctIndex = typeof content.correctIndex === "number" ? content.correctIndex : 0;
  const [selected, setSelected] = useState<number | null>(null);
  const correct = selected === correctIndex;
  const answered = selected !== null;
  const choose = (index: number) => {
    setSelected(index);
    if (index === correctIndex) void onComplete();
  };
  return (
    <section className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
      <div className="mb-3 flex items-center gap-2 text-sm font-bold text-primary">
        <CircleAlert className="h-4 w-4" /> Проверь себя
      </div>
      <h3 className="text-xl font-extrabold">{stringValue(content, "question")}</h3>
      <div className="mt-5 space-y-2">
        {options.map((option, index) => {
          const isSelected = selected === index;
          const className =
            answered && isSelected
              ? correct
                ? "border-emerald-400 bg-emerald-50"
                : "border-red-300 bg-red-50"
              : "border-border hover:border-primary/40 hover:bg-primary-soft";
          return (
            <button
              key={`${option}-${index}`}
              type="button"
              onClick={() => choose(index)}
              className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors ${className}`}
            >
              {option}
            </button>
          );
        })}
      </div>
      {answered && (
        <div
          className={`mt-4 rounded-xl p-4 text-sm ${correct ? "bg-emerald-50 text-emerald-950" : "bg-red-50 text-red-950"}`}
        >
          <p className="font-bold">
            {correct ? "Верно! Следующая часть открыта." : "Почти. Попробуйте ещё раз."}
          </p>
          <p className="mt-1">{stringValue(content, "explanation")}</p>
          {!correct && (
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setSelected(null)}>
              Попробовать ещё раз
            </Button>
          )}
        </div>
      )}
      {completed && !answered && (
        <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" /> Ответ уже принят. Можете ответить ещё раз для
          повторения.
        </p>
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
      <h2 className="text-2xl font-extrabold text-primary">
        {stringValue(content, "title", "Главное из урока")}
      </h2>
      <dl className="mt-5 grid gap-3">
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

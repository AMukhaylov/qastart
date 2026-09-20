import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createLessonBlock,
  LessonBlockDraft,
  LessonBlockType,
  lessonBlockLabels,
  lessonBlockTypes,
  stringList,
  stringValue,
} from "@/lib/interactive-lesson";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/lessons")({ component: AdminLessons });

type Lesson = {
  id: string;
  day_number: number;
  title: string;
  description: string;
  video_url: string | null;
  content_md: string;
  homework_md: string;
};
type DbBlock = LessonBlockDraft & { id: string; lesson_id: string; position: number };

function AdminLessons() {
  const { isAdmin } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<LessonBlockDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isAdmin) void loadLessons();
  }, [isAdmin]);
  useEffect(() => {
    if (activeId) void loadBlocks(activeId);
  }, [activeId]);

  async function loadLessons() {
    setLoading(true);
    const { data } = await supabase.from("lessons").select("*").order("day_number");
    const loaded = (data ?? []) as Lesson[];
    setLessons(loaded);
    setActiveId(loaded[0]?.id ?? null);
    setLoading(false);
  }
  async function loadBlocks(lessonId: string) {
    const { data } = await supabase
      .from("lesson_blocks")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("position");
    setBlocks(
      ((data ?? []) as DbBlock[]).map(({ id, block_type, content }) => ({
        id,
        block_type: block_type as LessonBlockType,
        content: content as Record<string, unknown>,
      })),
    );
  }
  const active = lessons.find((lesson) => lesson.id === activeId) ?? null;
  function updateLesson<K extends keyof Lesson>(key: K, value: Lesson[K]) {
    if (active)
      setLessons((all) =>
        all.map((lesson) => (lesson.id === active.id ? { ...lesson, [key]: value } : lesson)),
      );
  }
  function updateBlock(index: number, content: Record<string, unknown>) {
    setBlocks((all) => all.map((block, i) => (i === index ? { ...block, content } : block)));
  }
  function moveBlock(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= blocks.length) return;
    setBlocks((all) => {
      const copy = [...all];
      [copy[index], copy[destination]] = [copy[destination], copy[index]];
      return copy;
    });
  }

  async function save() {
    if (!active) return;
    setSaving(true);
    try {
      const { error: lessonError } = await supabase
        .from("lessons")
        .update({
          title: active.title,
          description: active.description,
          video_url: active.video_url,
          content_md: active.content_md,
          homework_md: active.homework_md,
        })
        .eq("id", active.id);
      if (lessonError) throw lessonError;
      const saved = blocks.filter((block): block is LessonBlockDraft & { id: string } =>
        Boolean(block.id),
      );
      const { data: databaseBlocks, error: dbError } = await supabase
        .from("lesson_blocks")
        .select("id")
        .eq("lesson_id", active.id);
      if (dbError) throw dbError;
      const removed = (databaseBlocks ?? [])
        .map((block) => block.id)
        .filter((id) => !saved.some((block) => block.id === id));
      if (removed.length) {
        const { error } = await supabase.from("lesson_blocks").delete().in("id", removed);
        if (error) throw error;
      }
      // Shift persisted blocks first so exchanging two positions never violates the unique index.
      for (let i = 0; i < saved.length; i += 1) {
        const { error } = await supabase
          .from("lesson_blocks")
          .update({ position: 100000 + i })
          .eq("id", saved[i].id);
        if (error) throw error;
      }
      for (let i = 0; i < blocks.length; i += 1) {
        const block = blocks[i];
        const payload = { block_type: block.block_type, content: block.content, position: i };
        const result = block.id
          ? await supabase.from("lesson_blocks").update(payload).eq("id", block.id)
          : await supabase.from("lesson_blocks").insert({ ...payload, lesson_id: active.id });
        if (result.error) throw result.error;
      }
      await loadBlocks(active.id);
      toast.success("Урок и его блоки сохранены");
    } catch {
      toast.error("Не удалось сохранить урок");
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Управление уроками</h1>
        <p className="mt-1 text-muted-foreground">
          Собирайте уроки из коротких смысловых блоков. Старые поля сохранены для совместимости.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-32">
          <div className="max-h-[70vh] space-y-1 overflow-y-auto">
            {lessons.map((lesson) => (
              <button
                key={lesson.id}
                onClick={() => setActiveId(lesson.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${activeId === lesson.id ? "bg-primary-soft font-semibold text-primary" : "hover:bg-muted"}`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-xs font-bold">
                  {lesson.day_number}
                </span>
                <span className="truncate">{lesson.title}</span>
              </button>
            ))}
          </div>
        </aside>
        {active ? (
          <section className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" /> День {active.day_number}
              </span>
              <Button variant="hero" onClick={save} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Сохранить
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Название">
                <Input
                  value={active.title}
                  onChange={(event) => updateLesson("title", event.target.value)}
                />
              </Field>
              <Field label="Краткое описание">
                <Input
                  value={active.description}
                  onChange={(event) => updateLesson("description", event.target.value)}
                />
              </Field>
            </div>
            <details className="rounded-xl border border-border p-4">
              <summary className="cursor-pointer font-semibold">
                Старые поля урока (для совместимости)
              </summary>
              <div className="mt-4 space-y-4">
                <Field label="Ссылка на дополнительное видео">
                  <Input
                    value={active.video_url ?? ""}
                    onChange={(event) => updateLesson("video_url", event.target.value || null)}
                  />
                </Field>
                <Field label="Старый конспект">
                  <Textarea
                    rows={4}
                    value={active.content_md}
                    onChange={(event) => updateLesson("content_md", event.target.value)}
                  />
                </Field>
                <Field label="Старое домашнее задание">
                  <Textarea
                    rows={4}
                    value={active.homework_md}
                    onChange={(event) => updateLesson("homework_md", event.target.value)}
                  />
                </Field>
              </div>
            </details>
            <BlockBuilder
              blocks={blocks}
              setBlocks={setBlocks}
              updateBlock={updateBlock}
              moveBlock={moveBlock}
            />
          </section>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            Выберите урок слева
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function BlockBuilder({
  blocks,
  setBlocks,
  updateBlock,
  moveBlock,
}: {
  blocks: LessonBlockDraft[];
  setBlocks: React.Dispatch<React.SetStateAction<LessonBlockDraft[]>>;
  updateBlock: (index: number, value: Record<string, unknown>) => void;
  moveBlock: (index: number, direction: -1 | 1) => void;
}) {
  return (
    <section>
      <div>
        <h2 className="text-xl font-extrabold">Структура урока</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Добавляйте блоки и меняйте их порядок кнопками.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {lessonBlockTypes.map((type) => (
          <Button
            key={type}
            size="sm"
            variant="soft"
            onClick={() => setBlocks((all) => [...all, createLessonBlock(type)])}
          >
            <Plus className="h-3.5 w-3.5" />
            {lessonBlockLabels[type]}
          </Button>
        ))}
      </div>
      <div className="mt-5 space-y-4">
        {blocks.length === 0 && (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            В этом уроке пока нет интерактивных блоков. Добавьте первый блок выше.
          </p>
        )}
        {blocks.map((block, index) => (
          <BlockEditor
            key={block.id ?? `new-${index}`}
            block={block}
            index={index}
            total={blocks.length}
            onChange={(content) => updateBlock(index, content)}
            onUp={() => moveBlock(index, -1)}
            onDown={() => moveBlock(index, 1)}
            onDelete={() => setBlocks((all) => all.filter((_, itemIndex) => itemIndex !== index))}
          />
        ))}
      </div>
    </section>
  );
}

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onUp,
  onDown,
  onDelete,
}: {
  block: LessonBlockDraft;
  index: number;
  total: number;
  onChange: (content: Record<string, unknown>) => void;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
}) {
  const c = block.content;
  const set = (key: string, value: unknown) => onChange({ ...c, [key]: value });
  const simple = (label: string, key: string, multiline = false) => (
    <Field label={label}>
      {multiline ? (
        <Textarea rows={4} value={stringValue(c, key)} onChange={(e) => set(key, e.target.value)} />
      ) : (
        <Input value={stringValue(c, key)} onChange={(e) => set(key, e.target.value)} />
      )}
    </Field>
  );
  let fields: React.ReactNode;
  if (block.block_type === "heading") fields = simple("Заголовок", "title");
  else if (block.block_type === "text")
    fields = (
      <>
        {
          <p className="text-xs text-muted-foreground">
            Поддерживается Markdown: **жирный**, *курсив*, списки и ссылки.
          </p>
        }
        {simple("Текст", "markdown", true)}
      </>
    );
  else if (block.block_type === "definition")
    fields = (
      <>
        {simple("Термин", "term")}
        {simple("Определение", "text", true)}
      </>
    );
  else if (block.block_type === "important")
    fields = (
      <>
        {simple("Заголовок", "title")}
        {simple("Мысль", "text", true)}
      </>
    );
  else if (block.block_type === "example")
    fields = (
      <>
        {simple("Заголовок", "title")}
        {simple("Ожидание", "expected", true)}
        {simple("Фактический результат", "actual", true)}
        {simple("Вывод", "conclusion", true)}
      </>
    );
  else if (block.block_type === "diagram")
    fields = (
      <>
        {simple("Заголовок", "title")}
        <Field label="Шаги схемы (по одному на строке)">
          <Textarea
            rows={5}
            value={stringList(c, "steps").join("\n")}
            onChange={(e) => set("steps", e.target.value.split("\n").filter(Boolean))}
          />
        </Field>
      </>
    );
  else if (block.block_type === "image")
    fields = (
      <>
        {simple("URL изображения", "url")}
        {simple("Описание для доступности", "alt")}
        {simple("Подпись", "caption")}
      </>
    );
  else if (block.block_type === "video")
    fields = (
      <>
        {simple("Название", "title")}
        {simple("Embed URL", "url")}
      </>
    );
  else if (block.block_type === "question")
    fields = (
      <>
        {simple("Вопрос", "question", true)}
        <Field label="4 варианта, по одному на строке">
          <Textarea
            rows={5}
            value={stringList(c, "options").join("\n")}
            onChange={(e) => set("options", e.target.value.split("\n").slice(0, 4))}
          />
        </Field>
        <Field label="Номер правильного варианта (1–4)">
          <Input
            type="number"
            min="1"
            max="4"
            value={(Number(c.correctIndex) || 0) + 1}
            onChange={(e) => set("correctIndex", Math.max(0, Number(e.target.value) - 1))}
          />
        </Field>
        {simple("Объяснение", "explanation", true)}
      </>
    );
  else if (block.block_type === "code")
    fields = (
      <>
        {simple("Язык", "language")}
        {simple("Код", "code", true)}
      </>
    );
  else if (block.block_type === "summary")
    fields = (
      <>
        {simple("Заголовок", "title")}
        <Field label="Словарь: Термин | определение, по одному на строке">
          <Textarea
            rows={6}
            value={(Array.isArray(c.items) ? c.items : [])
              .map((item) => (Array.isArray(item) ? item.join(" | ") : ""))
              .join("\n")}
            onChange={(e) =>
              set(
                "items",
                e.target.value
                  .split("\n")
                  .filter(Boolean)
                  .map((line) => {
                    const [term, ...rest] = line.split("|");
                    return [term.trim(), rest.join("|").trim()];
                  }),
              )
            }
          />
        </Field>
        <Field label="Главные мысли, по одной на строке">
          <Textarea
            rows={4}
            value={stringList(c, "points").join("\n")}
            onChange={(e) => set("points", e.target.value.split("\n").filter(Boolean))}
          />
        </Field>
      </>
    );
  else
    fields = (
      <>
        {simple("Заголовок", "title")}
        {simple("Условие", "instruction", true)}
        {simple("Подсказка по отправке", "submitHint", true)}
      </>
    );
  const defaultCondition =
    block.block_type === "question"
      ? "question_correct"
      : block.block_type === "video"
        ? "video_watched"
        : block.block_type === "homework"
          ? "homework_submitted"
          : "viewed";
  return (
    <article className="rounded-2xl border border-border bg-muted/30 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold">
          {index + 1}. {lessonBlockLabels[block.block_type]}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            disabled={index === 0}
            onClick={onUp}
            aria-label="Поднять блок"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            disabled={index === total - 1}
            onClick={onDown}
            aria-label="Опустить блок"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={onDelete} aria-label="Удалить блок">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      <div className="space-y-3">{fields}</div>
      <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm md:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-background p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={c.required !== false}
            onChange={(event) => set("required", event.target.checked)}
          />
          <span>
            <span className="block font-semibold">Обязательный блок</span>
            <span className="text-xs text-muted-foreground">Учитывается в прогрессе урока.</span>
          </span>
        </label>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-background p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={c.blocksNext !== false}
            onChange={(event) => set("blocksNext", event.target.checked)}
          />
          <span>
            <span className="block font-semibold">Открывает следующий этап</span>
            <span className="text-xs text-muted-foreground">
              Ученик завершит этот блок перед следующим.
            </span>
          </span>
        </label>
        <Field label="Условие выполнения">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={stringValue(c, "completionCondition", defaultCondition)}
            onChange={(event) => set("completionCondition", event.target.value)}
          >
            <option value="viewed">Просмотрен</option>
            <option value="question_correct">Правильный ответ</option>
            <option value="video_watched">Видео просмотрено</option>
            <option value="task_completed">Задание выполнено</option>
            <option value="homework_submitted">Домашнее задание отправлено</option>
          </select>
        </Field>
        {block.block_type === "homework" && (
          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-background p-3">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={c.homeworkRequiredForCompletion === true}
              onChange={(event) => set("homeworkRequiredForCompletion", event.target.checked)}
            />
            <span>
              <span className="block font-semibold">ДЗ обязательно для завершения</span>
              <span className="text-xs text-muted-foreground">
                Без отправки урок не получит статус «Пройден».
              </span>
            </span>
          </label>
        )}
      </div>
    </article>
  );
}

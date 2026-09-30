import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileUp,
  Loader2,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { InteractiveLesson } from "@/components/interactive-lesson";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import guideSheet from "@/assets/lesson-guide-sheet.jpg";
import pendingArtwork from "@/assets/lesson-guide-pending.png";
import {
  lessonGuideArtworkPosition,
  lessonGuideVariantLabels,
  type LessonGuideVariant,
} from "@/lib/lesson-guide";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  createLessonBlock,
  LessonBlockDraft,
  LessonBlock,
  LessonBlockType,
  lessonBlockLabels,
  lessonBlockTypes,
  lessonTableColumns,
  lessonTableRows,
  stateDiagramStates,
  stateDiagramTransitions,
  stringList,
  stringValue,
} from "@/lib/interactive-lesson";
import {
  createAiKitFiles,
  createZip,
  exportLessonPackage,
  importLessonPackage,
  parseLessonPackageJson,
  lessonBlockCatalog,
  type LessonPackage,
  type LessonPackageIssue,
  validateLessonPackage,
} from "@/lib/lesson-package";
import lessonGuidelines from "../../docs/LESSON_GUIDELINES.md?raw";
import { toast } from "sonner";

const StateDiagramEditor = lazy(() =>
  import("@/components/state-diagram").then((module) => ({ default: module.StateDiagramEditor })),
);

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
type ImportPreview = {
  previewId: string;
  fileName: string;
  package: LessonPackage;
  warnings: LessonPackageIssue[];
  existingLesson: Lesson | null;
};

function downloadFile(filename: string, body: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function usePreviewScrollPosition(open: boolean, previewKey: string | null) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const activeKeyRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      containerRef.current = node;
      if (!node || !open || !previewKey) return;

      const isNewPreview = !wasOpenRef.current || activeKeyRef.current !== previewKey;
      if (isNewPreview) {
        activeKeyRef.current = previewKey;
        lastScrollTopRef.current = 0;
        node.scrollTop = 0;
      } else {
        node.scrollTop = lastScrollTopRef.current;
      }
      wasOpenRef.current = true;
    },
    [open, previewKey],
  );

  useLayoutEffect(() => {
    if (!open) {
      if (containerRef.current) lastScrollTopRef.current = containerRef.current.scrollTop;
      wasOpenRef.current = false;
      activeKeyRef.current = null;
      return;
    }
    const node = containerRef.current;
    if (!node || !previewKey) return;

    const isNewPreview = !wasOpenRef.current || activeKeyRef.current !== previewKey;
    if (isNewPreview) {
      activeKeyRef.current = previewKey;
      lastScrollTopRef.current = 0;
      node.scrollTop = 0;
    } else {
      node.scrollTop = lastScrollTopRef.current;
    }
    wasOpenRef.current = true;
  }, [open, previewKey]);

  const onScroll = useCallback<React.UIEventHandler<HTMLDivElement>>((event) => {
    lastScrollTopRef.current = event.currentTarget.scrollTop;
  }, []);

  useEffect(() => {
    if (!open) return;
    const restore = () => {
      requestAnimationFrame(() => {
        const node = containerRef.current;
        if (node) node.scrollTop = lastScrollTopRef.current;
      });
    };
    window.addEventListener("focus", restore);
    document.addEventListener("visibilitychange", restore);
    return () => {
      window.removeEventListener("focus", restore);
      document.removeEventListener("visibilitychange", restore);
    };
  }, [open]);

  return { ref: setContainerRef, onScroll };
}

function AdminLessons() {
  const { isAdmin } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<LessonBlockDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editorPreviewOpen, setEditorPreviewOpen] = useState(false);
  const [lessonListOpen, setLessonListOpen] = useState(true);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importIssues, setImportIssues] = useState<LessonPackageIssue[]>([]);
  const [importMode, setImportMode] = useState<"create" | "copy" | "replace">("create");
  const [importing, setImporting] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);
  const blocksLoadRequestRef = useRef(0);
  const loadedBlocksLessonRef = useRef<string | null>(null);
  const loadedBlockIdsRef = useRef<Set<string>>(new Set());
  const loadedBlockOrderRef = useRef<string[]>([]);

  useEffect(() => {
    if (isAdmin) void loadLessons();
  }, [isAdmin]);
  useEffect(() => {
    if (activeId) {
      setDirty(false);
      loadedBlocksLessonRef.current = null;
      loadedBlockIdsRef.current = new Set();
      loadedBlockOrderRef.current = [];
      setBlocks([]);
      void loadBlocks(activeId);
    }
  }, [activeId]);

  const editorPreviewScroll = usePreviewScrollPosition(
    editorPreviewOpen,
    activeId ? `lesson:${activeId}` : null,
  );

  async function loadLessons() {
    setLoading(true);
    const { data } = await supabase.from("lessons").select("*").order("day_number");
    const loaded = (data ?? []) as Lesson[];
    setLessons(loaded);
    setActiveId(loaded[0]?.id ?? null);
    setLoading(false);
  }
  async function loadBlocks(lessonId: string) {
    const requestId = ++blocksLoadRequestRef.current;
    setBlocksLoading(true);
    const { data, error } = await supabase
      .from("lesson_blocks")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("position");
    if (requestId !== blocksLoadRequestRef.current) return;
    if (error) {
      toast.error("Не удалось загрузить блоки урока");
      setBlocksLoading(false);
      return;
    }
    const loaded = ((data ?? []) as DbBlock[]).map(({ id, block_type, content }) => ({
      id,
      block_type: block_type as LessonBlockType,
      content: content as Record<string, unknown>,
    }));
    setBlocks(loaded);
    loadedBlocksLessonRef.current = lessonId;
    loadedBlockIdsRef.current = new Set(loaded.map((block) => block.id).filter(Boolean));
    loadedBlockOrderRef.current = loaded.map((block) => block.id).filter(Boolean) as string[];
    setBlocksLoading(false);
  }
  const active = lessons.find((lesson) => lesson.id === activeId) ?? null;
  function updateLesson<K extends keyof Lesson>(key: K, value: Lesson[K]) {
    if (active) {
      setDirty(true);
      setLessons((all) =>
        all.map((lesson) => (lesson.id === active.id ? { ...lesson, [key]: value } : lesson)),
      );
    }
  }
  function updateBlock(index: number, content: Record<string, unknown>) {
    setDirty(true);
    setBlocks((all) => all.map((block, i) => (i === index ? { ...block, content } : block)));
  }
  function moveBlock(index: number, direction: -1 | 1) {
    const destination = index + direction;
    if (destination < 0 || destination >= blocks.length) return;
    setDirty(true);
    setBlocks((all) => {
      const copy = [...all];
      [copy[index], copy[destination]] = [copy[destination], copy[index]];
      return copy;
    });
  }
  function moveBlockTo(index: number, position: number) {
    if (!Number.isInteger(position) || position < 1) return;
    const destination = Math.min(Math.max(position - 1, 0), blocks.length - 1);
    if (destination === index) return;
    setDirty(true);
    setBlocks((all) => {
      const copy = [...all];
      const [moved] = copy.splice(index, 1);
      copy.splice(destination, 0, moved);
      return copy;
    });
  }

  function createLesson() {
    const usedDays = new Set(lessons.map((lesson) => lesson.day_number));
    let day = 1;
    while (usedDays.has(day)) day += 1;
    const newLesson: Lesson = {
      id: `new-${crypto.randomUUID()}`,
      day_number: day,
      title: `Новый урок ${day}`,
      description: "",
      video_url: null,
      content_md: "",
      homework_md: "",
    };
    setLessons((all) => [...all, newLesson]);
    setActiveId(newLesson.id);
    setBlocks([]);
    setDirty(true);
    toast.message("Заполните урок и нажмите «Сохранить».");
  }

  async function exportActiveLesson() {
    if (!active || active.id.startsWith("new-")) return;
    const { data, error } = await supabase
      .from("lesson_blocks")
      .select("id, block_type, content")
      .eq("lesson_id", active.id)
      .order("position");
    if (error) {
      toast.error("Не удалось загрузить блоки для экспорта");
      return;
    }
    const exportBlocks = ((data ?? []) as DbBlock[]).map(({ id, block_type, content }) => ({
      id,
      block_type: block_type as LessonBlockType,
      content: content as Record<string, unknown>,
    }));
    const packageData = exportLessonPackage(active, exportBlocks);
    downloadFile(
      `qa-start-lesson-day-${active.day_number}.json`,
      JSON.stringify(packageData, null, 2),
      "application/json;charset=utf-8",
    );
    toast.success("Урок экспортирован в JSON");
  }

  async function downloadAiKit() {
    const example = lessons.find((lesson) => lesson.day_number === 1);
    if (!example) {
      toast.error("Не удалось найти День 1 для примера");
      return;
    }
    const { data, error } = await supabase
      .from("lesson_blocks")
      .select("id, block_type, content")
      .eq("lesson_id", example.id)
      .order("position");
    if (error) {
      toast.error("Не удалось подготовить пример урока");
      return;
    }
    const exampleBlocks = ((data ?? []) as DbBlock[]).map(({ id, block_type, content }) => ({
      id,
      block_type: block_type as LessonBlockType,
      content: content as Record<string, unknown>,
    }));
    const files = createAiKitFiles(exportLessonPackage(example, exampleBlocks), lessonGuidelines);
    downloadFile("qa-start-ai-kit.zip", createZip(files), "application/zip");
    toast.success("AI-kit скачан");
  }

  async function readImportFile(file: File) {
    setImportIssues([]);
    try {
      const parsed: unknown = parseLessonPackageJson(await file.text());
      const validation = validateLessonPackage(parsed);
      if (!validation.valid) {
        setImportPreview(null);
        setImportIssues(validation.errors);
        return;
      }
      const existingLesson =
        lessons.find((lesson) => lesson.day_number === validation.value.lesson.day) ?? null;
      setImportMode(existingLesson ? "copy" : "create");
      setImportPreview({
        previewId: crypto.randomUUID(),
        fileName: file.name,
        package: validation.value,
        warnings: validation.warnings,
        existingLesson,
      });
    } catch {
      setImportPreview(null);
      setImportIssues([
        { path: "Файл", message: "Не удалось прочитать JSON. Проверьте формат файла." },
      ]);
    } finally {
      if (importInputRef.current) importInputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!importPreview) return;
    setImporting(true);
    try {
      const imported = importLessonPackage(importPreview.package);
      const duplicate = importMode === "copy";
      const maxDay = Math.max(0, ...lessons.map((lesson) => lesson.day_number));
      const targetDay = duplicate ? maxDay + 1 : imported.lesson.day;
      const targetTitle = duplicate ? `${imported.lesson.title} (копия)` : imported.lesson.title;
      const mode = importMode === "replace" ? "replace" : "create";
      const existingId =
        importMode === "replace" ? (importPreview.existingLesson?.id ?? null) : null;
      if (importMode === "replace" && !existingId) throw new Error("Не выбран урок для замены");
      // The Supabase client is exposed through a lazy Proxy. Keep the method
      // bound to the client, otherwise supabase-js loses its `this` context
      // and fails with "Cannot read properties of undefined (reading 'rest')".
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: string | null; error: { message: string } | null }>;
      const { data, error } = await rpc("admin_import_lesson_package", {
        p_mode: mode,
        p_existing_lesson_id: existingId,
        p_day_number: targetDay,
        p_title: targetTitle,
        p_description: imported.lesson.description,
        p_video_url: imported.lesson.video_url,
        p_content_md: imported.lesson.content_md,
        p_homework_md: imported.lesson.homework_md,
        p_blocks: imported.blocks.map((block) => ({
          block_type: block.block_type,
          content: block.content,
        })),
      });
      if (error || !data) throw new Error(error?.message ?? "Не удалось сохранить урок");
      await loadLessons();
      setActiveId(data);
      setImportPreview(null);
      toast.success(importMode === "replace" ? "Урок заменён" : "Урок импортирован");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось импортировать урок");
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    if (!active) return;
    if (active.id.startsWith("new-")) {
      setSaving(true);
      try {
        const { data, error } = await supabase
          .from("lessons")
          .insert({
            day_number: active.day_number,
            title: active.title,
            description: active.description,
            video_url: active.video_url,
            content_md: active.content_md,
            homework_md: active.homework_md,
          })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("Не удалось создать урок");
        if (blocks.length) {
          const { error: blocksError } = await supabase.from("lesson_blocks").insert(
            blocks.map((block, index) => ({
              lesson_id: data.id,
              block_type: block.block_type,
              content: block.content as Json,
              position: index,
            })),
          );
          if (blocksError) throw blocksError;
        }
        await loadLessons();
        setActiveId(data.id);
        setDirty(false);
        toast.success("Урок создан");
      } catch {
        toast.error("Не удалось создать урок");
      } finally {
        setSaving(false);
      }
      return;
    }
    setSaving(true);
    try {
      if (loadedBlocksLessonRef.current !== active.id) {
        throw new Error("Блоки урока ещё не загружены. Обновите страницу и повторите сохранение.");
      }
      const { data: databaseBlocks, error: dbError } = await supabase
        .from("lesson_blocks")
        .select("id")
        .eq("lesson_id", active.id);
      if (dbError) throw dbError;
      const loadedIds = loadedBlockIdsRef.current;
      const databaseIds = new Set((databaseBlocks ?? []).map((block) => block.id));
      if (
        databaseIds.size !== loadedIds.size ||
        [...databaseIds].some((id) => !loadedIds.has(id))
      ) {
        await loadBlocks(active.id);
        throw new Error(
          "Данные урока изменились. Блоки перезагружены, проверьте их перед сохранением.",
        );
      }
      if (blocks.length === 0 && (databaseBlocks?.length ?? 0) > 0) {
        await loadBlocks(active.id);
        throw new Error("Блоки ещё загружаются. Повторите сохранение через секунду.");
      }
      const saved = blocks.filter((block): block is LessonBlockDraft & { id: string } =>
        Boolean(block.id),
      );
      const removed = (databaseBlocks ?? [])
        .map((block) => block.id)
        .filter((id) => !saved.some((block) => block.id === id));

      // The common case is editing text/content without changing the block order.
      // Persist all existing blocks in one upsert instead of issuing one update per
      // block (large lessons otherwise make Save appear to hang and can hit request
      // limits). Position values are unchanged in this path, so the unique
      // (lesson_id, position) constraint cannot be violated.
      const currentOrder = saved.map((block) => block.id);
      const orderUnchanged =
        removed.length === 0 &&
        blocks.length === saved.length &&
        currentOrder.length === loadedBlockOrderRef.current.length &&
        currentOrder.every((id, index) => id === loadedBlockOrderRef.current[index]);
      if (orderUnchanged) {
        const lessonPayload = {
          title: active.title,
          description: active.description,
          video_url: active.video_url,
          content_md: active.content_md,
          homework_md: active.homework_md,
        };
        const blockPayload = blocks.map((block, index) => ({
          id: block.id,
          lesson_id: active.id,
          block_type: block.block_type,
          content: block.content as Json,
          position: index,
        }));
        const [lessonResult, blocksResult] = await Promise.all([
          supabase.from("lessons").update(lessonPayload).eq("id", active.id),
          blockPayload.length
            ? supabase.from("lesson_blocks").upsert(blockPayload, { onConflict: "id" })
            : Promise.resolve({ error: null }),
        ]);
        if (lessonResult.error) throw lessonResult.error;
        if (blocksResult.error) throw blocksResult.error;
        loadedBlocksLessonRef.current = active.id;
        loadedBlockIdsRef.current = new Set(currentOrder);
        loadedBlockOrderRef.current = currentOrder;
        setDirty(false);
        toast.success("Урок и его блоки сохранены");
        return;
      }
      // Shift persisted blocks first so exchanging two positions never violates the unique index.
      const [lessonResult, removedResult, shiftResults] = await Promise.all([
        supabase
          .from("lessons")
          .update({
            title: active.title,
            description: active.description,
            video_url: active.video_url,
            content_md: active.content_md,
            homework_md: active.homework_md,
          })
          .eq("id", active.id),
        removed.length
          ? supabase.from("lesson_blocks").delete().in("id", removed)
          : Promise.resolve({ error: null }),
        Promise.all(
          saved.map((block, index) =>
            supabase
              .from("lesson_blocks")
              .update({ position: 100000 + index })
              .eq("id", block.id),
          ),
        ),
      ]);
      if (lessonResult.error) throw lessonResult.error;
      if (removedResult.error) throw removedResult.error;
      const shiftError = shiftResults.find((result) => result.error)?.error;
      if (shiftError) throw shiftError;
      const blockResults = await Promise.all(
        blocks.map((block, index) => {
          const payload = {
            block_type: block.block_type,
            content: block.content as Json,
            position: index,
          };
          return block.id
            ? supabase.from("lesson_blocks").update(payload).eq("id", block.id)
            : supabase
                .from("lesson_blocks")
                .insert({ ...payload, lesson_id: active.id })
                .select("id")
                .single();
        }),
      );
      const blockError = blockResults.find((result) => result.error)?.error;
      if (blockError) throw blockError;
      // Keep the editor state in place after saving. Refetching every block here
      // made the Save button wait on a second network request and could leave it
      // spinning even though the writes had already completed. Capture IDs for
      // blocks created in this save so future edits update instead of inserting
      // duplicates.
      setBlocks(
        blocks.map((block, index) => {
          if (block.id) return block;
          const insertedId = (blockResults[index] as { data?: { id?: string } | null }).data?.id;
          return insertedId ? { ...block, id: insertedId } : block;
        }),
      );
      loadedBlocksLessonRef.current = active.id;
      loadedBlockIdsRef.current = new Set(
        blocks
          .map(
            (block, index) =>
              block.id ?? (blockResults[index] as { data?: { id?: string } | null }).data?.id,
          )
          .filter(Boolean) as string[],
      );
      loadedBlockOrderRef.current = blocks
        .map(
          (block, index) =>
            block.id ?? (blockResults[index] as { data?: { id?: string } | null }).data?.id,
        )
        .filter(Boolean) as string[];
      setDirty(false);
      toast.success("Урок и его блоки сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить урок");
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
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="hero" onClick={createLesson}>
            <Plus className="h-4 w-4" /> Создать урок
          </Button>
          <Button type="button" variant="soft" onClick={() => importInputRef.current?.click()}>
            <FileUp className="h-4 w-4" /> Импортировать урок
          </Button>
          <Button type="button" variant="outline" onClick={() => void downloadAiKit()}>
            <Download className="h-4 w-4" /> Скачать спецификацию для ИИ
          </Button>
          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void readImportFile(file);
            }}
          />
        </div>
      </div>
      <div
        className={`grid gap-6 ${lessonListOpen ? "lg:grid-cols-[280px_1fr]" : "lg:grid-cols-[52px_1fr]"}`}
      >
        <aside className="h-fit rounded-2xl border border-border bg-card p-3 lg:sticky lg:top-32">
          <div
            className={`flex items-center ${lessonListOpen ? "justify-between" : "justify-center"}`}
          >
            {lessonListOpen && (
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Уроки
              </span>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setLessonListOpen((value) => !value)}
              aria-label={lessonListOpen ? "Свернуть список уроков" : "Развернуть список уроков"}
              title={lessonListOpen ? "Свернуть список уроков" : "Развернуть список уроков"}
            >
              {lessonListOpen ? (
                <PanelLeftClose className="h-4 w-4" />
              ) : (
                <PanelLeftOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
          {lessonListOpen ? (
            <div className="mt-2 max-h-[70vh] space-y-1 overflow-y-auto">
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
          ) : (
            <div className="mt-2 hidden flex-col items-center gap-2 lg:flex">
              <span className="text-[10px] font-bold text-muted-foreground [writing-mode:vertical-rl]">
                УРОКИ
              </span>
              <span className="text-xs font-bold text-primary">{active?.day_number ?? "—"}</span>
            </div>
          )}
        </aside>
        {active ? (
          <section className="space-y-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] md:p-7">
            <div
              data-testid="lesson-actions-bar"
              className="sticky top-[calc(var(--admin-header-height)+0.75rem)] z-20 -mx-2 flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 px-2 py-2 shadow-[var(--shadow-soft)] backdrop-blur md:-mx-3 md:px-3"
            >
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="h-4 w-4" /> День {active.day_number}
              </span>
              <div className="flex flex-wrap gap-2">
                {!active.id.startsWith("new-") && (
                  <Button type="button" variant="outline" onClick={exportActiveLesson}>
                    <Download className="h-4 w-4" /> Экспортировать урок
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setEditorPreviewOpen(true)}>
                  <Eye className="h-4 w-4" /> Предпросмотр
                </Button>
                <Button variant="hero" onClick={save} disabled={saving || blocksLoading || !dirty}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить
                </Button>
              </div>
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
            <BlockBuilder
              blocks={blocks}
              loading={blocksLoading}
              setBlocks={(updater) => {
                setDirty(true);
                setBlocks(updater);
              }}
              updateBlock={updateBlock}
              moveBlock={moveBlock}
              moveBlockTo={moveBlockTo}
              lessonDay={active.day_number}
            />
          </section>
        ) : (
          <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
            Выберите урок слева
          </div>
        )}
      </div>
      <ImportDialog
        preview={importPreview}
        issues={importIssues}
        mode={importMode}
        importing={importing}
        onModeChange={setImportMode}
        onClose={() => {
          setImportPreview(null);
          setImportIssues([]);
        }}
        onConfirm={() => void confirmImport()}
      />
      {active && (
        <Dialog open={editorPreviewOpen} onOpenChange={setEditorPreviewOpen}>
          <DialogContent
            ref={editorPreviewScroll.ref}
            className="max-h-[90vh] max-w-6xl overflow-y-auto"
            onScroll={editorPreviewScroll.onScroll}
          >
            <DialogHeader>
              <DialogTitle>Предпросмотр для ученика</DialogTitle>
              <DialogDescription>
                День {active.day_number} · {active.title}. Несохранённые изменения уже учтены.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-border bg-background p-4 md:p-6">
              <InteractiveLesson
                blocks={blocks.map((block, index) => ({
                  id: block.id ?? `preview-${index}`,
                  lesson_id: "preview",
                  position: index,
                  block_type: block.block_type,
                  content: block.content,
                }))}
                completedBlockIds={new Set()}
                onBlocksCompleted={() => undefined}
                lessonDay={active.day_number}
                lessonTitle={active.title}
                previewMode
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorPreviewOpen(false)}>
                Закрыть
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
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

function ImportDialog({
  preview,
  issues,
  mode,
  importing,
  onModeChange,
  onClose,
  onConfirm,
}: {
  preview: ImportPreview | null;
  issues: LessonPackageIssue[];
  mode: "create" | "copy" | "replace";
  importing: boolean;
  onModeChange: (mode: "create" | "copy" | "replace") => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const opened = Boolean(preview) || issues.length > 0;
  const previewScroll = usePreviewScrollPosition(
    Boolean(preview),
    preview ? `import:${preview.previewId}` : null,
  );
  const imported = preview ? importLessonPackage(preview.package) : null;
  const blocks = imported?.blocks ?? [];
  const types = [...new Set(blocks.map((block) => block.block_type))];
  const labelFor = (type: LessonBlockType) =>
    lessonBlockCatalog.find((item) => item.type === type)?.title ?? type;
  const studentBlocks: LessonBlock[] = blocks.map((block, index) => ({
    id: `preview-${index}`,
    lesson_id: "preview",
    position: index,
    block_type: block.block_type,
    content: block.content,
  }));
  const questions = blocks.filter(
    (block) =>
      block.block_type === "question" ||
      block.block_type === "visual_choice" ||
      block.block_type === "reflection",
  ).length;
  const hints = blocks.filter((block) => block.block_type === "guide").length;
  const images = blocks.filter((block) => block.block_type === "image").length;

  return (
    <Dialog open={opened} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        ref={previewScroll.ref}
        className="max-h-[90vh] max-w-6xl overflow-y-auto"
        onScroll={previewScroll.onScroll}
      >
        <DialogHeader>
          <DialogTitle>{preview ? "Импорт урока" : "JSON не прошёл проверку"}</DialogTitle>
          <DialogDescription>
            {preview
              ? `Проверьте состав «${preview.fileName}» перед сохранением.`
              : "Исправьте ошибки в файле и загрузите его снова. Ничего не было импортировано."}
          </DialogDescription>
        </DialogHeader>
        {issues.length > 0 && (
          <ul className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            {issues.map((entry) => (
              <li key={`${entry.path}-${entry.message}`}>
                <strong>{entry.path}:</strong> {entry.message}
              </li>
            ))}
          </ul>
        )}
        {preview && imported && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <ImportMetric label="Название" value={preview.package.lesson.title} />
              <ImportMetric label="День" value={String(preview.package.lesson.day)} />
              <ImportMetric label="Блоков" value={String(blocks.length)} />
              <ImportMetric label="Вопросов и активностей" value={String(questions)} />
              <ImportMetric label="Подсказок" value={String(hints)} />
              <ImportMetric label="Изображений персонажа" value={String(hints)} />
              <ImportMetric label="Обычных изображений" value={String(images)} />
              <div className="rounded-xl border border-border bg-muted/30 p-3 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Типы блоков
                </p>
                <p className="mt-1 text-sm font-semibold">{types.map(labelFor).join(", ")}</p>
              </div>
            </div>
            {preview.warnings.length > 0 && (
              <ul className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                {preview.warnings.map((entry) => (
                  <li key={`${entry.path}-${entry.message}`}>
                    <strong>{entry.path}:</strong> {entry.message}
                  </li>
                ))}
              </ul>
            )}
            {preview.existingLesson ? (
              <fieldset className="rounded-xl border border-border p-4">
                <legend className="px-1 font-semibold">
                  День {preview.package.lesson.day} уже существует
                </legend>
                <p className="mb-3 text-sm text-muted-foreground">
                  Существующий урок «{preview.existingLesson.title}» не будет перезаписан без
                  выбора.
                </p>
                <div className="grid gap-2 md:grid-cols-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={mode === "copy"}
                      onChange={() => onModeChange("copy")}
                    />
                    <span>
                      <span className="block font-semibold">Создать копию</span>
                      <span className="text-sm text-muted-foreground">
                        Будет создан новый день со словом «копия» в названии.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3">
                    <input
                      type="radio"
                      name="import-mode"
                      checked={mode === "replace"}
                      onChange={() => onModeChange("replace")}
                    />
                    <span>
                      <span className="block font-semibold">Заменить существующий урок</span>
                      <span className="text-sm text-muted-foreground">
                        Содержимое текущего дня будет заменено после подтверждения.
                      </span>
                    </span>
                  </label>
                </div>
              </fieldset>
            ) : null}
            <details className="rounded-xl border border-border bg-muted/20 p-4">
              <summary className="cursor-pointer font-semibold">Предпросмотр для ученика</summary>
              <div className="mt-5 rounded-xl border border-border bg-background p-4 md:p-6">
                <InteractiveLesson
                  blocks={studentBlocks}
                  completedBlockIds={new Set()}
                  onBlocksCompleted={() => undefined}
                  lessonDay={preview.package.lesson.day}
                  lessonTitle={preview.package.lesson.title}
                  previewMode
                />
              </div>
            </details>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={importing}>
            Отмена
          </Button>
          {preview && (
            <button
              type="button"
              data-testid="confirm-lesson-import"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] transition-all hover:-translate-y-0.5 hover:bg-primary/95 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onConfirm()}
              disabled={importing}
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              Импортировать
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-bold" title={value}>
        {value}
      </p>
    </div>
  );
}

function BlockBuilder({
  blocks,
  loading,
  setBlocks,
  updateBlock,
  moveBlock,
  moveBlockTo,
  lessonDay,
}: {
  blocks: LessonBlockDraft[];
  loading: boolean;
  setBlocks: React.Dispatch<React.SetStateAction<LessonBlockDraft[]>>;
  updateBlock: (index: number, value: Record<string, unknown>) => void;
  moveBlock: (index: number, direction: -1 | 1) => void;
  moveBlockTo: (index: number, position: number) => void;
  lessonDay: number;
}) {
  let part = 0;
  const blocksWithParts = blocks.map((block, index) => {
    if (block.block_type === "heading" && block.content.startsStep === true) part += 1;
    return { block, index, part: Math.max(part, 1) };
  });
  const totalParts = Math.max(1, part);
  return (
    <section>
      <div>
        <h2 className="text-xl font-extrabold">Структура урока</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Добавляйте блоки, меняйте номер позиции или используйте стрелки. У каждого блока указана
          часть урока.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {lessonBlockTypes.map((type) => (
          <Button
            key={type}
            size="sm"
            variant="soft"
            disabled={loading}
            onClick={() => setBlocks((all) => [...all, createLessonBlock(type)])}
          >
            <Plus className="h-3.5 w-3.5" />
            {lessonBlockLabels[type]}
          </Button>
        ))}
      </div>
      <div className="mt-5 space-y-4">
        {loading ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Загружаем блоки урока…
          </p>
        ) : blocks.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            В этом уроке пока нет интерактивных блоков. Добавьте первый блок выше.
          </p>
        ) : null}
        {blocksWithParts.map(({ block, index, part: partNumber }) => (
          <BlockEditor
            key={block.id ?? `new-${index}`}
            block={block}
            index={index}
            total={blocks.length}
            partNumber={partNumber}
            totalParts={totalParts}
            lessonDay={lessonDay}
            onChange={(content) => updateBlock(index, content)}
            onUp={() => moveBlock(index, -1)}
            onDown={() => moveBlock(index, 1)}
            onMoveTo={(position) => moveBlockTo(index, position)}
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
  partNumber,
  totalParts,
  lessonDay,
  onChange,
  onUp,
  onDown,
  onMoveTo,
  onDelete,
}: {
  block: LessonBlockDraft;
  index: number;
  total: number;
  partNumber: number;
  totalParts: number;
  lessonDay: number;
  onChange: (content: Record<string, unknown>) => void;
  onUp: () => void;
  onDown: () => void;
  onMoveTo: (position: number) => void;
  onDelete: () => void;
}) {
  const c = block.content;
  const [expanded, setExpanded] = useState(true);
  const [positionValue, setPositionValue] = useState(String(index + 1));
  useEffect(() => {
    setPositionValue(String(index + 1));
  }, [index]);
  const set = (key: string, value: unknown) => onChange({ ...c, [key]: value });
  const commitPosition = () => {
    const position = Number(positionValue);
    if (Number.isInteger(position) && position >= 1 && position <= total) onMoveTo(position);
    else setPositionValue(String(index + 1));
  };
  const insertNewline = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
    onValueChange: (value: string) => void,
  ) => {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const nextValue = textarea.value.slice(0, start) + "\n" + textarea.value.slice(end);
    onValueChange(nextValue);
    requestAnimationFrame(() => {
      textarea.selectionStart = start + 1;
      textarea.selectionEnd = start + 1;
    });
  };
  const simple = (label: string, key: string, multiline = false) => (
    <Field label={label}>
      {multiline ? (
        <Textarea
          rows={4}
          value={stringValue(c, key)}
          onChange={(e) => set(key, e.target.value)}
          onKeyDown={(e) => insertNewline(e, (value) => set(key, value))}
        />
      ) : (
        <Input value={stringValue(c, key)} onChange={(e) => set(key, e.target.value)} />
      )}
    </Field>
  );
  const lineList = (label: string, key: string, rows: number, maxItems?: number) => (
    <Field label={label}>
      <Textarea
        rows={rows}
        value={stringList(c, key).join("\n")}
        onChange={(e) => {
          const lines = e.target.value.split(/\r?\n/);
          set(key, lines);
        }}
        onBlur={(e) => {
          if (!maxItems) return;
          const lines = e.target.value.split(/\r?\n/);
          if (lines.length > maxItems) set(key, lines.slice(0, maxItems));
        }}
        onKeyDown={(e) => insertNewline(e, (value) => set(key, value.split(/\r?\n/)))}
      />
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
        {simple("Заголовок первой секции", "expectedTitle")}
        {simple("Описание первой секции", "expected", true)}
        {simple("Заголовок второй секции", "actualTitle")}
        {simple("Описание второй секции", "actual", true)}
        {simple("Заголовок третьей секции", "conclusionTitle")}
        {simple("Описание третьей секции", "conclusion", true)}
      </>
    );
  else if (block.block_type === "diagram")
    fields = (
      <>
        {simple("Заголовок", "title")}
        {lineList("Шаги схемы (по одному на строке)", "steps", 5)}
      </>
    );
  else if (block.block_type === "state_diagram") {
    fields = (
      <Suspense
        fallback={
          <div className="h-72 animate-pulse rounded-xl border border-border bg-muted/30" />
        }
      >
        <StateDiagramEditor content={c} onChange={onChange} />
      </Suspense>
    );
  } else if ((block.block_type as string) === "state_diagram_legacy") {
    const states = stateDiagramStates(c);
    const transitions = stateDiagramTransitions(c);
    const stateById = new Map(states.map((state) => [state.id, state]));
    const updateStates = (nextStates: typeof states) => {
      const stateIds = new Set(nextStates.map((state) => state.id));
      onChange({
        ...c,
        states: nextStates,
        transitions: transitions.filter(
          (transition) => stateIds.has(transition.from) && stateIds.has(transition.to),
        ),
        ...(stringValue(c, "initialState") && !stateIds.has(stringValue(c, "initialState"))
          ? { initialState: nextStates[0]?.id ?? "" }
          : {}),
        ...(stringList(c, "finalStates").some((id) => !stateIds.has(id))
          ? { finalStates: stringList(c, "finalStates").filter((id) => stateIds.has(id)) }
          : {}),
      });
    };
    const updateTransitions = (nextTransitions: typeof transitions) =>
      set("transitions", nextTransitions);
    fields = (
      <>
        {simple("Заголовок", "title")}
        <Field label={`Состояния (${states.length})`}>
          <div className="space-y-2">
            {states.map((state, stateIndex) => (
              <div key={state.id} className="flex items-center gap-2">
                <Input
                  aria-label={`Название состояния ${stateIndex + 1}`}
                  value={state.label}
                  onChange={(event) =>
                    updateStates(
                      states.map((item) =>
                        item.id === state.id ? { ...item, label: event.target.value } : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={stateIndex === 0}
                  onClick={() => {
                    const next = [...states];
                    [next[stateIndex - 1], next[stateIndex]] = [
                      next[stateIndex],
                      next[stateIndex - 1],
                    ];
                    updateStates(next);
                  }}
                  aria-label="Поднять состояние"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={stateIndex === states.length - 1}
                  onClick={() => {
                    const next = [...states];
                    [next[stateIndex], next[stateIndex + 1]] = [
                      next[stateIndex + 1],
                      next[stateIndex],
                    ];
                    updateStates(next);
                  }}
                  aria-label="Опустить состояние"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={states.length <= 2}
                  onClick={() => updateStates(states.filter((item) => item.id !== state.id))}
                  aria-label="Удалить состояние"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={states.length >= 20}
              onClick={() => {
                const id = `state-${crypto.randomUUID()}`;
                updateStates([...states, { id, label: `Состояние ${states.length + 1}` }]);
              }}
            >
              <Plus className="h-4 w-4" /> Добавить состояние
            </Button>
          </div>
        </Field>
        <Field label={`Переходы (${transitions.length})`}>
          <div className="space-y-3">
            {transitions.map((transition, transitionIndex) => (
              <div
                key={`${transition.from}-${transition.to}-${transitionIndex}`}
                className="rounded-xl border border-border p-3"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-sm font-medium">
                    <span>От</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={transition.from}
                      onChange={(event) =>
                        updateTransitions(
                          transitions.map((item, itemIndex) =>
                            itemIndex === transitionIndex
                              ? { ...item, from: event.target.value }
                              : item,
                          ),
                        )
                      }
                    >
                      {states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    <span>К</span>
                    <select
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={transition.to}
                      onChange={(event) =>
                        updateTransitions(
                          transitions.map((item, itemIndex) =>
                            itemIndex === transitionIndex
                              ? { ...item, to: event.target.value }
                              : item,
                          ),
                        )
                      }
                    >
                      {states.map((state) => (
                        <option key={state.id} value={state.id}>
                          {state.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    <span>Условие / событие</span>
                    <Input
                      value={transition.label ?? ""}
                      onChange={(event) =>
                        updateTransitions(
                          transitions.map((item, itemIndex) =>
                            itemIndex === transitionIndex
                              ? { ...item, label: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2 text-destructive hover:text-destructive"
                  onClick={() =>
                    updateTransitions(
                      transitions.filter((_, itemIndex) => itemIndex !== transitionIndex),
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" /> Удалить переход
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={states.length < 2}
              onClick={() =>
                updateTransitions([
                  ...transitions,
                  { from: states[0].id, to: states[1].id, label: "Новое событие" },
                ])
              }
            >
              <Plus className="h-4 w-4" /> Добавить переход
            </Button>
          </div>
        </Field>
        <Field label="Начальное состояние (необязательно)">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={stringValue(c, "initialState")}
            onChange={(event) => set("initialState", event.target.value)}
          >
            <option value="">Не выбрано</option>
            {states.map((state) => (
              <option key={state.id} value={state.id}>
                {state.label}
              </option>
            ))}
          </select>
        </Field>
      </>
    );
  } else if (block.block_type === "table") {
    const columns = lessonTableColumns(c);
    const rows = lessonTableRows(c);
    const updateTable = (nextColumns: typeof columns, nextRows: typeof rows) =>
      onChange({ ...c, columns: nextColumns, rows: nextRows });
    fields = (
      <>
        {simple("Заголовок", "title")}
        <Field label={`Колонки (${columns.length}/10)`}>
          <div className="space-y-2">
            {columns.map((column, columnIndex) => (
              <div key={column.id} className="flex items-center gap-2">
                <Input
                  aria-label={`Название колонки ${columnIndex + 1}`}
                  value={column.label}
                  onChange={(event) =>
                    updateTable(
                      columns.map((item) =>
                        item.id === column.id ? { ...item, label: event.target.value } : item,
                      ),
                      rows,
                    )
                  }
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={columnIndex === 0}
                  onClick={() => {
                    const next = [...columns];
                    [next[columnIndex - 1], next[columnIndex]] = [
                      next[columnIndex],
                      next[columnIndex - 1],
                    ];
                    updateTable(next, rows);
                  }}
                  aria-label="Поднять колонку"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={columnIndex === columns.length - 1}
                  onClick={() => {
                    const next = [...columns];
                    [next[columnIndex], next[columnIndex + 1]] = [
                      next[columnIndex + 1],
                      next[columnIndex],
                    ];
                    updateTable(next, rows);
                  }}
                  aria-label="Опустить колонку"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  disabled={columns.length <= 1}
                  onClick={() => {
                    const nextColumns = columns.filter((item) => item.id !== column.id);
                    updateTable(
                      nextColumns,
                      rows.map((row) => {
                        const { [column.id]: _removed, ...nextRow } = row;
                        return nextRow;
                      }),
                    );
                  }}
                  aria-label="Удалить колонку"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={columns.length >= 10}
              onClick={() => {
                const id = `column-${crypto.randomUUID()}`;
                updateTable(
                  [...columns, { id, label: `Колонка ${columns.length + 1}` }],
                  rows.map((row) => ({ ...row, [id]: "" })),
                );
              }}
            >
              <Plus className="h-4 w-4" /> Добавить колонку
            </Button>
          </div>
        </Field>
        <Field label={`Строки (${rows.length}/30)`}>
          <div className="max-w-full space-y-3 overflow-x-auto">
            {rows.map((row, rowIndex) => (
              <div key={rowIndex} className="min-w-max rounded-xl border border-border p-3">
                <div
                  className="grid gap-2"
                  style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(9rem, 1fr))` }}
                >
                  {columns.map((column) => (
                    <Input
                      key={column.id}
                      aria-label={`Строка ${rowIndex + 1}, ${column.label}`}
                      value={row[column.id] ?? ""}
                      onChange={(event) =>
                        updateTable(
                          columns,
                          rows.map((item, itemIndex) =>
                            itemIndex === rowIndex
                              ? { ...item, [column.id]: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  ))}
                </div>
                <div className="mt-2 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={rowIndex === 0}
                    onClick={() => {
                      const next = [...rows];
                      [next[rowIndex - 1], next[rowIndex]] = [next[rowIndex], next[rowIndex - 1]];
                      updateTable(columns, next);
                    }}
                  >
                    <ArrowUp className="h-4 w-4" /> Выше
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={rowIndex === rows.length - 1}
                    onClick={() => {
                      const next = [...rows];
                      [next[rowIndex], next[rowIndex + 1]] = [next[rowIndex + 1], next[rowIndex]];
                      updateTable(columns, next);
                    }}
                  >
                    <ArrowDown className="h-4 w-4" /> Ниже
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() =>
                      updateTable(
                        columns,
                        rows.filter((_, itemIndex) => itemIndex !== rowIndex),
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" /> Удалить
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="soft"
              disabled={rows.length >= 30}
              onClick={() =>
                updateTable(columns, [
                  ...rows,
                  Object.fromEntries(columns.map((column) => [column.id, ""])),
                ])
              }
            >
              <Plus className="h-4 w-4" /> Добавить строку
            </Button>
          </div>
        </Field>
      </>
    );
  } else if (block.block_type === "image")
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
        {simple("Описание", "description", true)}
      </>
    );
  else if (block.block_type === "question") {
    const questionType = stringValue(c, "questionType", "single_choice");
    fields = (
      <>
        <Field label="Тип активности">
          <select
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={questionType}
            onChange={(e) => set("questionType", e.target.value)}
          >
            <option value="single_choice">Один правильный ответ</option>
            <option value="multiple_choice">Несколько правильных ответов</option>
            <option value="true_false">Верно / неверно</option>
            <option value="scenario">Ситуационная задача</option>
          </select>
        </Field>
        {simple("Вопрос", "question", true)}
        {lineList("4 варианта, по одному на строке", "options", 5, 4)}
        {questionType === "multiple_choice" ? (
          <Field label="Правильные варианты (номера через запятую)">
            <Input
              value={
                Array.isArray(c.correctAnswers)
                  ? c.correctAnswers
                      .filter((item): item is number => typeof item === "number")
                      .map((item) => item + 1)
                      .join(", ")
                  : ""
              }
              onChange={(e) =>
                set(
                  "correctAnswers",
                  e.target.value
                    .split(",")
                    .map((item) => Number(item.trim()) - 1)
                    .filter((item) => Number.isInteger(item) && item >= 0 && item < 4),
                )
              }
            />
          </Field>
        ) : questionType === "single_choice" ? (
          <Field label="Номер правильного варианта (1–4)">
            <Input
              type="number"
              min="1"
              max="4"
              value={(Number(c.correctIndex) || 0) + 1}
              onChange={(e) => set("correctIndex", Math.max(0, Number(e.target.value) - 1))}
            />
          </Field>
        ) : null}
        {simple("Объяснение", "explanation", true)}
      </>
    );
  } else if (block.block_type === "reflection")
    fields = (
      <>
        {simple("Вопрос для размышления", "prompt", true)}
        {simple("Подсказка ученику", "hint", true)}
        {simple("Обратная связь после ответа", "feedback", true)}
      </>
    );
  else if (block.block_type === "visual_choice")
    fields = (
      <>
        {simple("Заголовок", "title")}
        {simple("Инструкция", "prompt", true)}
        {lineList("Варианты проверки, по одному на строке", "options", 5)}
        <Field label="Правильные варианты (номера через запятую)">
          <Input
            value={
              Array.isArray(c.correctAnswers)
                ? c.correctAnswers
                    .filter((item): item is number => typeof item === "number")
                    .map((item) => item + 1)
                    .join(", ")
                : ""
            }
            onChange={(e) =>
              set(
                "correctAnswers",
                e.target.value
                  .split(",")
                  .map((item) => Number(item.trim()) - 1)
                  .filter((item) => Number.isInteger(item) && item >= 0),
              )
            }
          />
        </Field>
        {simple("Объяснение", "explanation", true)}
      </>
    );
  else if (block.block_type === "guide")
    fields = (
      <>
        <Field label="Изображение персонажа">
          <GuideArtworkPicker
            value={stringValue(c, "variant", "explain")}
            onChange={(value) => set("variant", value)}
          />
        </Field>
        {simple("Заголовок подсказки", "title")}
        {simple("Текст подсказки", "text", true)}
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
                e.target.value.split("\n").map((line) => {
                  const [term, ...rest] = line.split("|");
                  return [term.trim(), rest.join("|").trim()];
                }),
              )
            }
            onKeyDown={(e) =>
              insertNewline(e, (value) =>
                set(
                  "items",
                  value.split(/\r?\n/).map((line) => {
                    const [term, ...rest] = line.split("|");
                    return [term.trim(), rest.join("|").trim()];
                  }),
                ),
              )
            }
          />
        </Field>
        {lineList("Главные мысли, по одной на строке", "points", 4)}
      </>
    );
  else if (block.block_type === "homework")
    fields = (
      <>
        <p className="rounded-xl border border-primary/20 bg-primary-soft/40 p-3 text-sm text-muted-foreground">
          Вводная плашка проводника — отдельный блок. Добавьте «Подсказку проводника» и разместите
          её в нужной части урока.
        </p>
        {simple("Название домашнего задания", "title")}
        {simple("Задание для ученика", "instruction", true)}
        <div className="mt-5 border-t border-border pt-5">
          <h3 className="text-sm font-bold">После отправки ДЗ — «День пройден»</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Эта карточка показывается ученику после отправки домашнего задания.
          </p>
        </div>
        <Field label="Изображение персонажа после отправки ДЗ">
          <GuideArtworkPicker
            value={stringValue(c, "completionVariant", "success").replace("character_", "")}
            onChange={(value) => set("completionVariant", value)}
          />
        </Field>
        <Field label="Заголовок после отправки ДЗ">
          <Input
            value={stringValue(c, "completionTitle", `День ${lessonDay} пройден`)}
            onChange={(event) => set("completionTitle", event.target.value)}
          />
        </Field>
        <Field label="Текст после отправки ДЗ">
          <Textarea
            rows={3}
            value={stringValue(
              c,
              "completionText",
              "Домашнее задание отправлено на проверку. Следующий урок уже доступен, а результат проверки появится здесь, как только наставник его проверит.",
            )}
            onChange={(event) => set("completionText", event.target.value)}
          />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-3">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={c.completionVisible !== false}
            onChange={(event) => set("completionVisible", event.target.checked)}
          />
          <span>
            <span className="block text-sm font-semibold">
              Показывать карточку после отправки ДЗ
            </span>
            <span className="text-xs text-muted-foreground">
              Её можно временно скрыть без удаления.
            </span>
          </span>
        </label>
      </>
    );
  else
    fields = (
      <>
        {simple("Заголовок", "title")}
        {simple("Условие", "instruction", true)}
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
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="sr-only" htmlFor={`block-position-${block.id ?? index}`}>
              Номер блока
            </Label>
            <Input
              id={`block-position-${block.id ?? index}`}
              className="h-9 w-16 bg-background text-center font-bold"
              type="number"
              min="1"
              max={total}
              value={positionValue}
              title="Номер блока: измените и нажмите Enter или перейдите к другому полю"
              onChange={(event) => setPositionValue(event.currentTarget.value)}
              onBlur={commitPosition}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
            />
            <span className="font-bold">. {lessonBlockLabels[block.block_type]}</span>
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary">
              Часть {partNumber} из {totalParts}
            </span>
          </div>
          <BlockPreview block={block} />
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button
            size="sm"
            variant="soft"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
          >
            {expanded ? "Свернуть" : "Редактировать"}
          </Button>
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
      {expanded && <div className="space-y-3">{fields}</div>}
      {expanded && (
        <details className="mt-5 rounded-xl border border-border bg-background p-3">
          <summary className="cursor-pointer font-semibold">Настройки блока</summary>
          <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-muted/40 p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={c.visible !== false}
                onChange={(event) => set("visible", event.target.checked)}
              />
              <span>
                <span className="block font-semibold">Показывать блок</span>
                <span className="text-xs text-muted-foreground">
                  Можно временно скрыть его без удаления.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-background p-3">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={c.required !== false}
                onChange={(event) => set("required", event.target.checked)}
              />
              <span>
                <span className="block font-semibold">Обязательный блок</span>
                <span className="text-xs text-muted-foreground">
                  Учитывается в прогрессе урока.
                </span>
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
        </details>
      )}
    </article>
  );
}

function BlockPreview({ block }: { block: LessonBlockDraft }) {
  const c = block.content;
  const title =
    block.block_type === "definition"
      ? stringValue(c, "term")
      : block.block_type === "guide"
        ? stringValue(c, "title", "Подсказка")
        : stringValue(c, "title") ||
          stringValue(c, "question") ||
          lessonBlockLabels[block.block_type];
  const text =
    block.block_type === "text"
      ? stringValue(c, "markdown")
      : block.block_type === "definition" ||
          block.block_type === "important" ||
          block.block_type === "guide"
        ? stringValue(c, "text")
        : block.block_type === "question"
          ? stringValue(c, "question")
          : "";
  return (
    <div className="mt-1 max-w-2xl truncate text-xs text-muted-foreground">
      <span className="font-semibold text-foreground/70">{title}</span>
      {text ? ` · ${text.replace(/\s+/g, " ")}` : ""}
    </div>
  );
}

function GuideArtworkPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: LessonGuideVariant) => void;
}) {
  const options: LessonGuideVariant[] = [
    "intro",
    "explain",
    "important",
    "question",
    "task",
    "pending",
    "success",
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {options.map((variant) => {
        const selected = value === variant;
        return (
          <button
            key={variant}
            type="button"
            onClick={() => onChange(variant)}
            className={`flex items-center gap-3 rounded-xl border p-2 text-left transition-colors ${selected ? "border-primary bg-primary-soft ring-2 ring-primary/20" : "border-border bg-background hover:border-primary/40"}`}
            aria-pressed={selected}
          >
            <span
              className="h-14 w-14 shrink-0 rounded-lg bg-cover bg-no-repeat"
              style={{
                backgroundImage: `url(${variant === "pending" ? pendingArtwork : guideSheet})`,
                backgroundSize: variant === "pending" ? "cover" : "300% 200%",
                backgroundPosition:
                  variant === "pending" ? "center" : lessonGuideArtworkPosition[variant],
              }}
            />
            <span>
              <span className="block text-sm font-semibold">
                {lessonGuideVariantLabels[variant]}
              </span>
              <span className="text-xs text-muted-foreground">
                {selected ? "Выбрано" : "Выбрать"}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

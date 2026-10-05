import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  Paperclip,
  Send,
  X,
} from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FinalQuiz } from "@/components/final-quiz";
import { InteractiveLesson } from "@/components/interactive-lesson";
import { LessonGuide } from "@/components/lesson-guide";
import { NotificationBell } from "@/components/notification-bell";
import { LessonRichContent } from "@/components/lesson-rich-content";
import { SqlSandboxHomework, type SavedSqlSandboxAttempt } from "@/components/sql-sandbox-homework";
import type { SqlSandboxConfig } from "@/lib/interactive-lesson";
import { getSqlSandboxProgress, type SqlSandboxResult } from "@/lib/sql-sandbox";
import type { LessonGuideVariant } from "@/lib/lesson-guide";
import { isBlockRequired, LessonBlock, stringValue } from "@/lib/interactive-lesson";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  persistProgressWithRecovery,
  progressQueueKey,
  queuePendingProgressIds,
  readPendingProgressIds,
  removePendingProgressIds,
  runProgressRequest,
} from "@/lib/lesson-progress";
import { listHomeworkMessages, submitHomeworkForCurrentUser } from "@/server/homework.functions";
import { getStudentLessonData } from "@/server/lesson-content.functions";
import { saveLessonQuestionAnswer } from "@/server/lesson-question-answers.functions";
import {
  completeLessonForCurrentUser,
  getLessonDailyAccessForCurrentUser,
  MAX_NEW_LESSONS_PER_DAY,
} from "@/server/lesson-access.functions";

export const Route = createFileRoute("/lessons/$day")({
  validateSearch: z.object({ focus: z.literal("homework").optional() }),
  component: LessonPage,
});

type Lesson = {
  id: string;
  day_number: number;
  title: string;
  description: string;
  video_url: string | null;
  content_md: string;
  homework_md: string;
};

type Submission = {
  id: string;
  user_id: string;
  content: string;
  status: "pending" | "approved" | "rejected" | "awaiting_mentor";
  feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type Attachment = {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  path?: string;
  url?: string;
};

type HomeworkMessage = {
  id: string;
  author_id: string | null;
  author_role: "student" | "mentor";
  author_name?: string | null;
  author_avatar_url?: string | null;
  body: string;
  attachments: Attachment[];
  created_at: string;
};

type ProfileMini = { id: string; full_name: string | null; avatar_url: string | null };

type LessonNavigationTone = "dashboard" | "previous" | "next";

function LessonNavigationButton({
  tone,
  ...props
}: Omit<ButtonProps, "variant" | "size"> & { tone: LessonNavigationTone }) {
  const variantByTone = {
    dashboard: "outline",
    previous: "soft",
    next: "hero",
  } as const;

  return <Button {...props} variant={variantByTone[tone]} size="lg" />;
}

function BackToDashboardButton({ onClick }: { onClick: () => void }) {
  return (
    <LessonNavigationButton tone="dashboard" onClick={onClick}>
      <ArrowLeft className="h-4 w-4" /> В кабинет
    </LessonNavigationButton>
  );
}

function LessonPage() {
  const { day } = Route.useParams();
  const { focus } = Route.useSearch();
  const dayNum = parseInt(day, 10);
  const { user, session, loading: authLoading, isAdmin, rolesLoading } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [finalQuizPassed, setFinalQuizPassed] = useState(false);
  const [blocks, setBlocks] = useState<LessonBlock[]>([]);
  const [viewedBlockIds, setViewedBlockIds] = useState<string[]>([]);
  const [completingLesson, setCompletingLesson] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [sqlSandboxAttempts, setSqlSandboxAttempts] = useState<SavedSqlSandboxAttempt[]>([]);
  const [messages, setMessages] = useState<HomeworkMessage[]>([]);
  const [hwText, setHwText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [dailyLimitReached, setDailyLimitReached] = useState(false);
  const [saving, setSaving] = useState(false);
  const [finalQuizActive, setFinalQuizActive] = useState(false);
  const [finalQuizExitRequest, setFinalQuizExitRequest] = useState(0);
  const [finalQuizExitDestination, setFinalQuizExitDestination] = useState<
    "dashboard" | number | null
  >(null);
  const loadedLessonKeyRef = useRef<string | null>(null);
  const focusedHomeworkKeyRef = useRef<string | null>(null);
  const pendingBlockIdsRef = useRef(new Set<string>());
  const progressSyncInFlightRef = useRef(false);
  const sqlHomeworkCompletionAttemptsRef = useRef(new Set<string>());

  const leaveFinalQuiz = (destination: "dashboard" | number) => {
    setFinalQuizExitDestination(destination);
    setFinalQuizExitRequest((request) => request + 1);
  };

  const returnToDashboard = () => {
    if (dayNum === 14 && finalQuizActive) {
      leaveFinalQuiz("dashboard");
      return;
    }
    navigate({ to: "/dashboard" });
  };

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    const shouldFocusHomework =
      focus === "homework" ||
      (typeof window !== "undefined" && window.location.hash === "#homework");
    if (!shouldFocusHomework || loading || !lesson || !submission) return;
    const focusKey = `${lesson.id}:${submission.id}`;
    if (focusedHomeworkKeyRef.current === focusKey) return;

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        const homework = document.getElementById("homework");
        if (!homework) return;
        const headerHeight = document.querySelector("header")?.getBoundingClientRect().height ?? 0;
        const top = homework.getBoundingClientRect().top + window.scrollY - headerHeight - 16;
        focusedHomeworkKeyRef.current = focusKey;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      });
    });
    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) window.cancelAnimationFrame(secondFrame);
    };
  }, [focus, lesson, loading, messages.length, submission]);

  useEffect(() => {
    if (!user?.id || isNaN(dayNum) || rolesLoading) return;
    const lessonKey = `${user.id}:${dayNum}:${isAdmin}`;
    if (loadedLessonKeyRef.current === lessonKey) return;
    loadedLessonKeyRef.current = lessonKey;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, dayNum, isAdmin, rolesLoading]);

  async function load() {
    setLoading(true);
    setFinalQuizPassed(false);
    setSubmission(null);
    setMessages([]);
    setAttachments([]);
    setLocked(false);
    setDailyLimitReached(false);
    setBlocks([]);
    setViewedBlockIds([]);
    setSqlSandboxAttempts([]);

    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    const lessonData = await getStudentLessonData({
      data: { accessToken: session.access_token, dayNumber: dayNum },
    });
    const l = lessonData.lesson;
    if (!l) {
      setLesson(null);
      setCompleted(false);
      setHwText("");
      setLoading(false);
      return;
    }
    if (dayNum > 1 && !isAdmin && !lessonData.previousCompleted) {
      setLesson(null);
      setCompleted(false);
      setLocked(true);
      setLoading(false);
      return;
    }
    if (!isAdmin && session?.access_token) {
      try {
        const access = await getLessonDailyAccessForCurrentUser({
          data: { accessToken: session.access_token, lessonId: l.id },
        });
        if (!access.allowed) {
          setLesson(null);
          setCompleted(false);
          setLocked(true);
          setDailyLimitReached(true);
          setLoading(false);
          return;
        }
      } catch {
        toast.error("Не удалось проверить дневной лимит. Попробуйте обновить страницу.");
        setLoading(false);
        return;
      }
    }
    setLesson(l as Lesson);
    const hasPassedFinalQuiz = Boolean(lessonData.finalQuizPassed);
    setFinalQuizPassed(hasPassedFinalQuiz);
    setCompleted(dayNum === 14 ? hasPassedFinalQuiz : !!lessonData.progress?.completed);
    setBlocks((lessonData.blocks ?? []) as LessonBlock[]);
    const serverViewedIds = (lessonData.blockProgress ?? []).map((row) => row.block_id);
    const queuedViewedIds =
      typeof window === "undefined" || !user?.id
        ? []
        : readPendingProgressIds(window.localStorage, progressQueueKey(user.id, l.id));
    setViewedBlockIds(Array.from(new Set([...serverViewedIds, ...queuedViewedIds])));
    setSqlSandboxAttempts((lessonData.sqlSandboxAttempts ?? []) as SavedSqlSandboxAttempt[]);
    if (lessonData.submission) {
      const currentSubmission = lessonData.submission as Submission;
      setSubmission(currentSubmission);
      setHwText(currentSubmission.status === "rejected" ? "" : currentSubmission.content);
      await loadMessages(currentSubmission);
    } else {
      setHwText("");
    }
    setLoading(false);
  }

  async function markBlocksCompleted(blockIds: string[]) {
    if (!lesson || !user) return false;
    const previouslyViewed = new Set(viewedBlockIds);
    const pendingIds = Array.from(new Set(blockIds)).filter(
      (id) => !previouslyViewed.has(id) && !pendingBlockIdsRef.current.has(id),
    );
    if (pendingIds.length === 0) return true;
    pendingIds.forEach((id) => pendingBlockIdsRef.current.add(id));
    const key = progressQueueKey(user.id, lesson.id);
    if (typeof window !== "undefined") {
      queuePendingProgressIds(window.localStorage, key, pendingIds);
    }
    // Move the learner forward immediately; local pending marks survive reloads
    // and are retried until the server confirms them.
    setViewedBlockIds((ids) => Array.from(new Set([...ids, ...pendingIds])));
    const rows = pendingIds.map((blockId) => ({
      user_id: user.id,
      lesson_id: lesson.id,
      block_id: blockId,
    }));
    const saveResult = await persistProgressWithRecovery(
      async () => {
        const result = await runProgressRequest((signal) =>
          supabase
            .from("lesson_block_progress")
            .upsert(rows, { onConflict: "user_id,block_id" })
            .abortSignal(signal),
        );
        return { error: result.error };
      },
      async () => {
        const result = await runProgressRequest((signal) =>
          supabase
            .from("lesson_block_progress")
            .select("block_id")
            .eq("user_id", user.id)
            .eq("lesson_id", lesson.id)
            .in("block_id", pendingIds)
            .abortSignal(signal),
        );
        return {
          persisted:
            !result.error &&
            new Set((result.data ?? []).map((row) => row.block_id)).size === pendingIds.length,
          error: result.error,
        };
      },
    );
    pendingIds.forEach((id) => pendingBlockIdsRef.current.delete(id));
    if (!saveResult.saved) {
      // Keep the learner moving and retain the unsynced marks locally. The
      // background sync below retries on reconnect, focus, and a short interval.
      return true;
    }
    if (typeof window !== "undefined")
      removePendingProgressIds(window.localStorage, key, pendingIds);
    return true;
  }

  async function saveQuestionAnswer(blockId: string, selectedIndexes: number[]) {
    if (!lesson || !session?.access_token) return false;
    try {
      const result = await saveLessonQuestionAnswer({
        data: { accessToken: session.access_token, blockId, selectedIndexes },
      });
      return result.saved;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    if (!lesson || !user || blocks.length === 0 || typeof window === "undefined") return;

    const key = progressQueueKey(user.id, lesson.id);
    const validBlockIds = new Set(blocks.map((block) => block.id));
    let disposed = false;

    const syncQueuedProgress = async () => {
      if (disposed || progressSyncInFlightRef.current || !navigator.onLine) return;
      const queuedIds = readPendingProgressIds(window.localStorage, key);
      const validIds = queuedIds.filter((id) => validBlockIds.has(id));
      const staleIds = queuedIds.filter((id) => !validBlockIds.has(id));
      if (staleIds.length > 0) removePendingProgressIds(window.localStorage, key, staleIds);
      if (validIds.length === 0) return;

      progressSyncInFlightRef.current = true;
      const rows = validIds.map((blockId) => ({
        user_id: user.id,
        lesson_id: lesson.id,
        block_id: blockId,
      }));
      try {
        const result = await persistProgressWithRecovery(
          async () => {
            const response = await runProgressRequest((signal) =>
              supabase
                .from("lesson_block_progress")
                .upsert(rows, { onConflict: "user_id,block_id" })
                .abortSignal(signal),
            );
            return { error: response.error };
          },
          async () => {
            const response = await runProgressRequest((signal) =>
              supabase
                .from("lesson_block_progress")
                .select("block_id")
                .eq("user_id", user.id)
                .eq("lesson_id", lesson.id)
                .in("block_id", validIds)
                .abortSignal(signal),
            );
            return {
              persisted:
                !response.error &&
                new Set((response.data ?? []).map((row) => row.block_id)).size === validIds.length,
              error: response.error,
            };
          },
        );
        if (result.saved) {
          removePendingProgressIds(window.localStorage, key, validIds);
          setViewedBlockIds((ids) => Array.from(new Set([...ids, ...validIds])));
        }
      } catch {
        // Keep queued marks for the next online/focus retry.
      } finally {
        progressSyncInFlightRef.current = false;
      }
    };

    void syncQueuedProgress();
    const intervalId = window.setInterval(() => void syncQueuedProgress(), 20_000);
    const onReconnect = () => void syncQueuedProgress();
    const onFocus = () => void syncQueuedProgress();
    window.addEventListener("online", onReconnect);
    window.addEventListener("focus", onFocus);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("online", onReconnect);
      window.removeEventListener("focus", onFocus);
    };
  }, [blocks, lesson, user]);

  async function completeLesson() {
    if (!lesson || !user || lesson.day_number === 14 || completed) return;
    setCompletingLesson(true);
    if (!session?.access_token) {
      setCompletingLesson(false);
      toast.error("Не удалось подтвердить сессию. Войди заново");
      return;
    }
    const requiredBlockIds = blocks.filter(isBlockRequired).map((block) => block.id);
    if (requiredBlockIds.length > 0) {
      const saveBlocks = await runProgressRequest((signal) =>
        supabase
          .from("lesson_block_progress")
          .upsert(
            requiredBlockIds.map((blockId) => ({
              user_id: user.id,
              lesson_id: lesson.id,
              block_id: blockId,
            })),
            { onConflict: "user_id,block_id" },
          )
          .abortSignal(signal),
      );
      if (saveBlocks.error) {
        setCompletingLesson(false);
        toast.error("Не удалось сохранить шаги урока. Проверь подключение и попробуй ещё раз.");
        return;
      }
    }
    let result: Awaited<ReturnType<typeof completeLessonForCurrentUser>>;
    try {
      result = await completeLessonForCurrentUser({
        data: { accessToken: session.access_token, lessonId: lesson.id },
      });
    } catch {
      setCompletingLesson(false);
      toast.error("Не удалось завершить урок. Попробуйте ещё раз.");
      return;
    }
    setCompletingLesson(false);
    if (!result.completed) {
      if (result.requirementsIncomplete) {
        toast.error("Сначала выполни обязательные шаги текущего и предыдущего урока.");
      } else {
        setDailyLimitReached(true);
        toast.error(`Сегодня можно завершить не больше ${MAX_NEW_LESSONS_PER_DAY} новых уроков.`);
      }
      return;
    }
    setCompleted(true);
    toast.success("Урок завершён. Следующий день открыт.");
  }

  useEffect(() => {
    if (
      !lesson ||
      !user ||
      lesson.day_number === 14 ||
      completed ||
      completingLesson ||
      blocks.length === 0 ||
      !blocks.filter(isBlockRequired).every((block) => viewedBlockIds.includes(block.id))
    ) {
      return;
    }
    void completeLesson();
    // completeLesson deliberately reads the current lesson and user from this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, completed, completingLesson, lesson, user, viewedBlockIds]);

  useEffect(() => {
    if (!lesson || loading) return;
    const sqlHomework = blocks.find(
      (block) => block.block_type === "homework" && block.content.mode === "sql_sandbox",
    );
    const config = sqlHomework?.content.sandbox as SqlSandboxConfig | undefined;
    if (
      !sqlHomework ||
      !config ||
      viewedBlockIds.includes(sqlHomework.id) ||
      !getSqlSandboxProgress(
        config.tasks,
        sqlSandboxAttempts.filter((attempt) => attempt.block_id === sqlHomework.id),
      ).isComplete
    ) {
      return;
    }
    const completionKey = `${lesson.id}:${sqlHomework.id}`;
    if (sqlHomeworkCompletionAttemptsRef.current.has(completionKey)) return;
    sqlHomeworkCompletionAttemptsRef.current.add(completionKey);
    // Recover the homework block completion if every answer was saved but the
    // progress write was interrupted before the page was refreshed.
    void markBlocksCompleted([sqlHomework.id]);
    // markBlocksCompleted deliberately uses this render's loaded lesson/user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, lesson, loading, sqlSandboxAttempts, viewedBlockIds]);

  async function loadMessages(currentSubmission: Submission) {
    if (!session?.access_token) {
      setMessages(
        await hydrateMessageAuthors(buildLegacyMessages(currentSubmission), currentSubmission),
      );
      return;
    }
    try {
      const data = await listHomeworkMessages({
        data: { accessToken: session.access_token, submissionId: currentSubmission.id },
      });
      const loaded = (data as HomeworkMessage[]) ?? [];
      const nextMessages = loaded.length > 0 ? loaded : buildLegacyMessages(currentSubmission);
      setMessages(await hydrateMessageAuthors(nextMessages, currentSubmission));
    } catch {
      setMessages(
        await hydrateMessageAuthors(buildLegacyMessages(currentSubmission), currentSubmission),
      );
    }
  }

  async function hydrateMessageAuthors(
    rawMessages: HomeworkMessage[],
    currentSubmission: Submission,
  ) {
    const authorIds = Array.from(
      new Set(
        rawMessages.map((message) => message.author_id).filter((id): id is string => Boolean(id)),
      ),
    );
    const { data } = authorIds.length
      ? await supabase.from("profiles").select("id,full_name,avatar_url").in("id", authorIds)
      : { data: [] as ProfileMini[] };
    const authorMap = new Map(
      ((data ?? []) as ProfileMini[]).map((profile) => [
        profile.id,
        { full_name: profile.full_name, avatar_url: profile.avatar_url },
      ]),
    );
    const fallbackStudentName = (user?.user_metadata?.full_name as string | undefined) ?? "Ученик";

    return rawMessages.map((message) => ({
      ...message,
      author_name:
        (message.author_id ? authorMap.get(message.author_id)?.full_name : null) ??
        message.author_name ??
        (message.author_role === "student" ? fallbackStudentName : "Артур Мухайлов"),
      author_avatar_url:
        (message.author_id ? authorMap.get(message.author_id)?.avatar_url : null) ??
        message.author_avatar_url ??
        null,
    }));
  }

  function buildLegacyMessages(currentSubmission: Submission): HomeworkMessage[] {
    return [
      {
        id: `${currentSubmission.id}-student`,
        author_id: currentSubmission.user_id,
        author_role: "student",
        body: currentSubmission.content,
        attachments: [],
        created_at: currentSubmission.created_at,
      },
      ...(currentSubmission.feedback
        ? [
            {
              id: `${currentSubmission.id}-mentor`,
              author_id: currentSubmission.reviewed_by,
              author_role: "mentor" as const,
              body: currentSubmission.feedback,
              attachments: [],
              created_at: currentSubmission.reviewed_at ?? currentSubmission.created_at,
            },
          ]
        : []),
    ];
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    if (attachments.length + incoming.length > 3) {
      toast.error("Можно приложить максимум 3 файла");
      return;
    }
    const tooBig = incoming.find((file) => file.size > 1_500_000);
    if (tooBig) {
      toast.error(`Файл «${tooBig.name}» больше 1.5 МБ`);
      return;
    }
    const loaded = await Promise.all(incoming.map(readAttachment));
    setAttachments((prev) => [...prev, ...loaded]);
  }

  function readAttachment(file: File): Promise<Attachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          dataUrl: String(reader.result),
        });
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async function submitHomework() {
    if (!lesson || !user || !hwText.trim()) return;
    if (!session?.access_token) {
      toast.error("Не удалось подтвердить сессию. Войди заново");
      return;
    }
    setSaving(true);
    try {
      const data = await submitHomeworkForCurrentUser({
        data: {
          accessToken: session.access_token,
          lessonId: lesson.id,
          submissionId: submission?.status === "rejected" ? submission.id : undefined,
          content: hwText.trim(),
          attachments,
        },
      });
      const savedSubmission = data as Submission;
      setSubmission(savedSubmission);
      setHwText(savedSubmission.content);
      setAttachments([]);
      await loadMessages(savedSubmission);
      const homeworkBlock = blocks.find((block) => block.block_type === "homework");
      if (homeworkBlock) await markBlocksCompleted([homeworkBlock.id]);
      toast.success("Домашка отправлена на проверку");
    } catch {
      toast.error("Не удалось отправить ДЗ");
    } finally {
      setSaving(false);
    }
  }

  async function saveSqlSandboxAttempt(
    block: LessonBlock,
    taskId: string,
    query: string,
    result: SqlSandboxResult,
  ) {
    if (!lesson || !user || !session?.access_token)
      throw new Error("Войди заново, чтобы сохранить прогресс SQL-задания.");
    const config = block.content.sandbox as SqlSandboxConfig | undefined;
    if (!config?.tasks.some((task) => task.id === taskId))
      throw new Error("Задание не найдено в конфигурации урока.");
    const row: SavedSqlSandboxAttempt = {
      block_id: block.id,
      task_id: taskId,
      query_text: query,
      passed: result.passed,
      result_columns: result.columns,
      result_rows: result.rows,
      feedback: result.message,
    };
    const { error } = await supabase.from("sql_sandbox_attempts").upsert(
      {
        user_id: user.id,
        lesson_id: lesson.id,
        block_id: block.id,
        task_id: taskId,
        query_text: query,
        passed: result.passed,
        result_columns: result.columns,
        result_rows: result.rows,
        feedback: result.message,
      },
      { onConflict: "user_id,block_id,task_id" },
    );
    if (error)
      throw new Error(
        "Не удалось сохранить ответ и прогресс. Проверь подключение и повтори попытку.",
      );
    setSqlSandboxAttempts((current) => [
      ...current.filter(
        (attempt) => !(attempt.task_id === taskId && attempt.block_id === block.id),
      ),
      row,
    ]);
    const progress = getSqlSandboxProgress(config.tasks, [
      ...sqlSandboxAttempts.filter(
        (attempt) => attempt.block_id === block.id && attempt.task_id !== taskId,
      ),
      row,
    ]);
    if (progress.isComplete) {
      const saved = await markBlocksCompleted([block.id]);
      if (!saved)
        throw new Error(
          "Ответ верный, но не удалось сохранить завершение домашнего задания. Нажми «Проверить» ещё раз.",
        );
    }
  }

  if (authLoading || rolesLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-soft)] px-6 flex items-center justify-center">
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Загружаем урок</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Подготавливаем материалы и твой прогресс.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    if (locked) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center">
          <div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
            <h1 className="text-xl font-extrabold">Урок пока закрыт</h1>
            <p className="mt-2 text-muted-foreground">
              {dailyLimitReached
                ? `Сегодня уже пройдено ${MAX_NEW_LESSONS_PER_DAY} новых урока. Следующий урок станет доступен завтра.`
                : "Сначала заверши предыдущий урок, чтобы открыть следующий материал."}
            </p>
            <Button asChild variant="soft" className="mt-6">
              <Link to="/dashboard">Вернуться к урокам</Link>
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Урок не найден</p>
        <Button asChild variant="soft">
          <Link to="/dashboard">В кабинет</Link>
        </Button>
      </div>
    );
  }

  const prevDay = dayNum > 1 ? dayNum - 1 : null;
  const nextDay = dayNum < 14 ? dayNum + 1 : null;
  const requiredBlocks = blocks.filter(isBlockRequired);
  const viewedCount = requiredBlocks.filter((block) => viewedBlockIds.includes(block.id)).length;
  const lessonProgress =
    requiredBlocks.length > 0
      ? Math.round((viewedCount / requiredBlocks.length) * 100)
      : completed
        ? 100
        : 0;
  const homeworkBlock = blocks.find(
    (block) => block.block_type === "homework" && block.content.visible !== false,
  );
  const hasLegacyHomework = blocks.length === 0 && Boolean(lesson.homework_md.trim());
  const homeworkUnlocked =
    Boolean(homeworkBlock) &&
    blocks
      .filter(
        (block) =>
          block.position < (homeworkBlock?.position ?? Number.MAX_SAFE_INTEGER) &&
          isBlockRequired(block),
      )
      .every((block) => viewedBlockIds.includes(block.id));
  const showHomework =
    (Boolean(homeworkBlock) && (homeworkUnlocked || Boolean(submission))) || hasLegacyHomework;
  const hasHomework = Boolean(homeworkBlock) || hasLegacyHomework;
  const isSqlSandboxHomework = homeworkBlock?.content.mode === "sql_sandbox";
  const showBottomCabinet = hasHomework
    ? Boolean(submission) || (isSqlSandboxHomework && completed)
    : completed;
  const homeworkInstruction = homeworkBlock
    ? stringValue(homeworkBlock.content, "instruction")
    : lesson.homework_md;
  const completionTitle = stringValue(
    homeworkBlock?.content ?? {},
    "completionTitle",
    `День ${lesson.day_number} пройден`,
  );
  const completionText = stringValue(
    homeworkBlock?.content ?? {},
    "completionText",
    isSqlSandboxHomework
      ? "Все SQL-задания выполнены. Домашнее задание проверено автоматически, отправлять его наставнику не нужно."
      : "Домашнее задание отправлено на проверку. Следующий урок уже доступен, а результат проверки появится здесь, как только наставник его проверит.",
  );
  const completionVariant = stringValue(
    homeworkBlock?.content ?? {},
    "completionVariant",
    "success",
  ).replace("character_", "") as LessonGuideVariant;
  const completionVisible = homeworkBlock?.content.completionVisible !== false;
  const homeworkPending = submission?.status === "pending";
  const completionCardVisible =
    completed && lesson.day_number !== 14 && completionVisible && submission?.status !== "rejected";
  const displayedCompletionTitle = homeworkPending
    ? `День ${lesson.day_number} почти пройден`
    : completionTitle;
  const displayedCompletionText = homeworkPending
    ? "Ты выполнил урок и отправил домашнее задание. Осталось дождаться проверки наставника. После принятия ДЗ день будет полностью завершён."
    : submission && submission.status !== "approved"
      ? completionText
      : lesson.day_number === 1
        ? "Первый день готов. Ты разобрался, зачем нужно тестирование, чем ожидаемый результат отличается от фактического и какую роль QA играет в команде. В следующем уроке посмотрим, кто ещё работает над продуктом и как специалисты взаимодействуют друг с другом."
        : `Ты завершил урок «${lesson.title}». Все обязательные шаги сохранены, а следующий день уже открыт.`;
  const displayedCompletionVariant = homeworkPending ? "pending" : completionVariant;

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="border-b border-border bg-background">
        <div className="container-page h-16 flex items-center justify-between">
          <BackToDashboardButton onClick={returnToDashboard} />
          <div className="flex items-center gap-4">
            {!(lesson.day_number === 14 && finalQuizActive) && <NotificationBell />}
            <div className="text-sm text-muted-foreground">День {lesson.day_number} из 14</div>
          </div>
        </div>
      </header>

      <main className="container-page py-10 max-w-4xl space-y-8">
        <div>
          <Badge variant="secondary" className="mb-3">
            День {lesson.day_number}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{lesson.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{lesson.description}</p>
          <div className="mt-5 max-w-xl">
            <div className="mb-2 flex justify-between text-sm">
              <span className="font-semibold">Прогресс урока</span>
              <span className="text-muted-foreground">{lessonProgress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${lessonProgress}%` }}
              />
            </div>
          </div>
        </div>

        {blocks.length === 0 && lesson.video_url && (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <div className="aspect-video bg-muted">
              <iframe
                src={lesson.video_url}
                className="h-full w-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Дополнительное видео"
              />
            </div>
          </div>
        )}

        <InteractiveLesson
          blocks={
            submission
              ? blocks.filter(
                  (block) =>
                    !(
                      block.block_type === "guide" &&
                      stringValue(block.content, "title").toLowerCase().includes("почти готов")
                    ),
                )
              : blocks
          }
          completedBlockIds={new Set(viewedBlockIds)}
          onBlocksCompleted={markBlocksCompleted}
          onQuestionAnswered={isAdmin ? undefined : saveQuestionAnswer}
          legacyContent={lesson.content_md}
          lessonDay={lesson.day_number}
          lessonTitle={lesson.title}
          previousDay={prevDay || undefined}
          renderHomework={(block) =>
            showHomework && block.id === homeworkBlock?.id ? (
              block.content.mode === "sql_sandbox" && block.content.sandbox ? (
                <SqlSandboxHomework
                  title={stringValue(block.content, "title", "SQL-практика")}
                  instruction={homeworkInstruction}
                  successMessage={stringValue(
                    block.content,
                    "sqlSandboxCompletionMessage",
                    "Все задания выполнены. Молодец!",
                  )}
                  config={block.content.sandbox as SqlSandboxConfig}
                  attempts={sqlSandboxAttempts.filter((attempt) => attempt.block_id === block.id)}
                  onAttemptSaved={(taskId, query, result) =>
                    saveSqlSandboxAttempt(block, taskId, query, result)
                  }
                />
              ) : (
                <HomeworkSubmissionCard
                  title={stringValue(block.content, "title", "Домашнее задание")}
                  instruction={homeworkInstruction}
                  submission={submission}
                  messages={messages}
                  hwText={hwText}
                  setHwText={setHwText}
                  attachments={attachments}
                  onFiles={handleFiles}
                  onRemoveAttachment={(index) =>
                    setAttachments((previous) =>
                      previous.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  onSubmit={submitHomework}
                  saving={saving}
                />
              )
            ) : null
          }
          renderFinalQuiz={(block) =>
            lesson.day_number === 14 && session?.access_token ? (
              <FinalQuiz
                accessToken={session.access_token}
                exitRequest={finalQuizExitRequest}
                onActiveChange={setFinalQuizActive}
                onPassed={() => {
                  void markBlocksCompleted([block.id]);
                  setFinalQuizPassed(true);
                  setCompleted(true);
                }}
                onExitComplete={() => {
                  const destination = finalQuizExitDestination;
                  setFinalQuizExitDestination(null);
                  if (typeof destination === "number") {
                    navigate({ to: "/lessons/$day", params: { day: String(destination) } });
                    return;
                  }
                  navigate({ to: "/dashboard" });
                }}
              />
            ) : null
          }
        />

        {lesson.day_number !== 14 && showHomework && !homeworkBlock ? (
          <HomeworkSubmissionCard
            title="Домашнее задание"
            instruction={homeworkInstruction}
            submission={submission}
            messages={messages}
            hwText={hwText}
            setHwText={setHwText}
            attachments={attachments}
            onFiles={handleFiles}
            onRemoveAttachment={(index) =>
              setAttachments((previous) => previous.filter((_, itemIndex) => itemIndex !== index))
            }
            onSubmit={submitHomework}
            saving={saving}
          />
        ) : null}

        {completionCardVisible && (
          <section
            className={`rounded-2xl p-5 shadow-[var(--shadow-soft)] md:p-7 ${homeworkPending ? "border border-primary/20 bg-primary-soft/30" : "border border-emerald-200 bg-emerald-50"}`}
          >
            <LessonGuide
              variant={displayedCompletionVariant}
              title={displayedCompletionTitle}
              text={displayedCompletionText}
            />
          </section>
        )}
      </main>

      <footer className="container-page pb-10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            {showBottomCabinet && <BackToDashboardButton onClick={returnToDashboard} />}
            {completed && prevDay ? (
              dayNum === 14 ? (
                <LessonNavigationButton
                  tone="previous"
                  onClick={() =>
                    finalQuizActive
                      ? leaveFinalQuiz(prevDay)
                      : navigate({ to: "/lessons/$day", params: { day: String(prevDay) } })
                  }
                >
                  <ArrowLeft className="h-4 w-4" /> День {prevDay}
                </LessonNavigationButton>
              ) : (
                <LessonNavigationButton tone="previous" asChild>
                  <Link to="/lessons/$day" params={{ day: String(prevDay) }}>
                    <ArrowLeft className="h-4 w-4" /> День {prevDay}
                  </Link>
                </LessonNavigationButton>
              )
            ) : null}
          </div>

          {nextDay ? (
            completed ? (
              <LessonNavigationButton tone="next" asChild className="self-start sm:self-auto">
                <Link to="/lessons/$day" params={{ day: String(nextDay) }}>
                  День {nextDay} <ArrowRight className="h-4 w-4" />
                </Link>
              </LessonNavigationButton>
            ) : null
          ) : completed && finalQuizPassed ? (
            <LessonNavigationButton
              tone="next"
              className="self-start sm:self-auto"
              onClick={returnToDashboard}
            >
              Завершить курс <CheckCircle2 className="h-4 w-4" />
            </LessonNavigationButton>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

function HomeworkSubmissionCard({
  title,
  instruction,
  submission,
  messages,
  hwText,
  setHwText,
  attachments,
  onFiles,
  onRemoveAttachment,
  onSubmit,
  saving,
}: {
  title: string;
  instruction: string;
  submission: Submission | null;
  messages: HomeworkMessage[];
  hwText: string;
  setHwText: (value: string) => void;
  attachments: Attachment[];
  onFiles: (files: FileList | null) => void;
  onRemoveAttachment: (index: number) => void;
  onSubmit: () => void;
  saving: boolean;
}) {
  return (
    <section
      id="homework"
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]"
    >
      <div className="mb-3 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <ClipboardCheck className="h-5 w-5" />
        </div>
        <h2 className="text-xl font-extrabold">{title}</h2>
      </div>
      <div className="text-muted-foreground">
        <LessonRichContent content={instruction} />
      </div>

      {submission ? (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Статус:</span>
            <Badge
              variant={
                submission.status === "approved"
                  ? "default"
                  : submission.status === "rejected"
                    ? "destructive"
                    : "secondary"
              }
            >
              {submission.status === "approved"
                ? "Принято"
                : submission.status === "rejected"
                  ? "На доработку"
                  : submission.status === "awaiting_mentor"
                    ? "Ждёт ответа наставника"
                    : "На проверке"}
            </Badge>
          </div>
          <MessageHistory messages={messages} />
          {submission.status === "rejected" && (
            <div className="space-y-5 pt-2">
              <Textarea
                placeholder="Напиши доработанный ответ..."
                value={hwText}
                onChange={(event) => setHwText(event.target.value)}
                rows={6}
                className="resize-y"
              />
              <AttachmentPicker
                attachments={attachments}
                onFiles={onFiles}
                onRemove={onRemoveAttachment}
              />
              <Button variant="hero" onClick={onSubmit} disabled={!hwText.trim() || saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Отправить доработку
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <Textarea
            placeholder="Твой ответ..."
            value={hwText}
            onChange={(event) => setHwText(event.target.value)}
            rows={6}
            className="resize-y"
          />
          <AttachmentPicker
            attachments={attachments}
            onFiles={onFiles}
            onRemove={onRemoveAttachment}
          />
          <Button variant="hero" onClick={onSubmit} disabled={!hwText.trim() || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Отправить на проверку
          </Button>
        </div>
      )}
    </section>
  );
}

function AttachmentPicker({
  attachments,
  onFiles,
  onRemove,
}: {
  attachments: Attachment[];
  onFiles: (files: FileList | null) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted">
        <Paperclip className="h-4 w-4" />
        Приложить файл
        <input
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            void onFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </label>
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="inline-flex max-w-full items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs"
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">До 3 файлов, каждый до 1.5 МБ.</p>
    </div>
  );
}

function MessageHistory({ messages }: { messages: HomeworkMessage[] }) {
  if (messages.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold">История переписки</div>
      {messages.map((message) => (
        <div
          key={message.id}
          className={`rounded-xl border p-4 text-sm ${
            message.author_role === "mentor"
              ? "border-primary/20 bg-primary-soft"
              : "border-border bg-muted"
          }`}
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="h-8 w-8 shrink-0 border border-background bg-background">
                {message.author_avatar_url && (
                  <AvatarImage
                    src={message.author_avatar_url}
                    alt={
                      message.author_name ||
                      (message.author_role === "mentor" ? "Наставник" : "Ученик")
                    }
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="text-[11px] font-semibold">
                  {getInitials(
                    message.author_name ||
                      (message.author_role === "mentor" ? "Наставник" : "Ученик"),
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 font-semibold text-foreground">
                {message.author_name || (message.author_role === "mentor" ? "Наставник" : "Ученик")}{" "}
                ({message.author_role === "mentor" ? "наставник" : "ученик"})
              </span>
            </div>
            <span>{new Date(message.created_at).toLocaleString("ru-RU")}</span>
          </div>
          {message.body && <div className="whitespace-pre-wrap">{message.body}</div>}
          {message.attachments?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.attachments.map((file, index) => (
                <a
                  key={`${file.name}-${index}`}
                  href={file.url ?? file.dataUrl}
                  download={file.name}
                  className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium hover:bg-muted"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

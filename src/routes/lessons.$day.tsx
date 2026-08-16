import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Loader2,
  Paperclip,
  PlayCircle,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { FinalQuiz } from "@/components/final-quiz";
import { LessonRichContent } from "@/components/lesson-rich-content";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  askHomeworkQuestion,
  listHomeworkMessages,
  submitHomeworkForCurrentUser,
} from "@/server/homework.functions";

export const Route = createFileRoute("/lessons/$day")({
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

function LessonPage() {
  const { day } = Route.useParams();
  const dayNum = parseInt(day, 10);
  const { user, session, loading: authLoading, isAdmin, rolesLoading } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [messages, setMessages] = useState<HomeworkMessage[]>([]);
  const [hwText, setHwText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [questionText, setQuestionText] = useState("");
  const [questionAttachments, setQuestionAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || isNaN(dayNum) || rolesLoading) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dayNum, isAdmin, rolesLoading]);

  async function load() {
    setLoading(true);
    setSubmission(null);
    setMessages([]);
    setAttachments([]);
    setQuestionAttachments([]);
    setQuestionText("");
    setLocked(false);

    if (dayNum > 1 && !isAdmin) {
      const { data: previousLesson } = await supabase
        .from("lessons")
        .select("id")
        .eq("day_number", dayNum - 1)
        .maybeSingle();
      const { data: previousProgress } = previousLesson
        ? await supabase
            .from("lesson_progress")
            .select("completed")
            .eq("user_id", user!.id)
            .eq("lesson_id", previousLesson.id)
            .eq("completed", true)
            .maybeSingle()
        : { data: null };

      if (!previousProgress?.completed) {
        setLesson(null);
        setCompleted(false);
        setLocked(true);
        setLoading(false);
        return;
      }
    }

    const { data: l } = await supabase
      .from("lessons")
      .select("*")
      .eq("day_number", dayNum)
      .maybeSingle();
    if (!l) {
      setLesson(null);
      setCompleted(false);
      setHwText("");
      setLoading(false);
      return;
    }
    setLesson(l as Lesson);

    const [{ data: prog }, { data: sub }] = await Promise.all([
      supabase
        .from("lesson_progress")
        .select("completed")
        .eq("user_id", user!.id)
        .eq("lesson_id", l.id)
        .maybeSingle(),
      supabase
        .from("homework_submissions")
        .select("id,user_id,content,status,feedback,created_at,reviewed_at,reviewed_by")
        .eq("user_id", user!.id)
        .eq("lesson_id", l.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setCompleted(!!prog?.completed);
    if (sub) {
      const currentSubmission = sub as Submission;
      setSubmission(currentSubmission);
      setHwText(currentSubmission.status === "rejected" ? "" : currentSubmission.content);
      await loadMessages(currentSubmission);
    } else {
      setHwText("");
    }
    setLoading(false);
  }

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

  async function handleQuestionFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files);
    if (questionAttachments.length + incoming.length > 3) {
      toast.error("Можно приложить максимум 3 файла");
      return;
    }
    const tooBig = incoming.find((file) => file.size > 1_500_000);
    if (tooBig) {
      toast.error(`Файл «${tooBig.name}» больше 1.5 МБ`);
      return;
    }
    const loaded = await Promise.all(incoming.map(readAttachment));
    setQuestionAttachments((prev) => [...prev, ...loaded]);
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
      toast.success("Домашка отправлена на проверку");
    } catch {
      toast.error("Не удалось отправить ДЗ");
    } finally {
      setSaving(false);
    }
  }

  async function submitQuestion() {
    if (!submission || !questionText.trim()) return;
    if (!session?.access_token) {
      toast.error("Не удалось подтвердить сессию. Войди заново");
      return;
    }
    setAsking(true);
    try {
      const data = await askHomeworkQuestion({
        data: {
          accessToken: session.access_token,
          submissionId: submission.id,
          question: questionText.trim(),
          attachments: questionAttachments,
        },
      });
      const savedSubmission = data as Submission;
      setSubmission(savedSubmission);
      setQuestionText("");
      setQuestionAttachments([]);
      await loadMessages(savedSubmission);
      toast.success("Вопрос отправлен наставнику");
    } catch {
      toast.error("Не удалось отправить вопрос");
    } finally {
      setAsking(false);
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
              Сначала заверши предыдущий урок, чтобы открыть следующий материал.
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

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="border-b border-border bg-background">
        <div className="container-page h-16 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" /> В кабинет
            </Link>
          </Button>
          <div className="text-sm text-muted-foreground">День {lesson.day_number} из 14</div>
        </div>
      </header>

      <main className="container-page py-10 max-w-4xl space-y-8">
        <div>
          <Badge variant="secondary" className="mb-3">
            День {lesson.day_number}
          </Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{lesson.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{lesson.description}</p>
        </div>

        {/* Video */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="aspect-video bg-[var(--gradient-hero)] flex items-center justify-center text-primary-foreground">
            {lesson.video_url ? (
              <iframe
                src={lesson.video_url}
                className="w-full h-full"
                allow="autoplay; encrypted-media"
                allowFullScreen
              />
            ) : (
              <div className="text-center">
                <PlayCircle className="h-16 w-16 mx-auto mb-3 opacity-90" />
                <p className="opacity-90">Видео-урок появится здесь</p>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <article className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
          <h2 className="text-xl font-extrabold mb-4">Конспект</h2>
          <LessonRichContent content={lesson.content_md} />
          <div className="mt-6 rounded-xl bg-primary-soft p-4 text-sm text-primary">
            {lesson.day_number === 14 ? (
              completed ? (
                <div className="inline-flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4" /> Итоговый тест пройден.
                </div>
              ) : (
                "Пройди итоговый тест минимум на 70%, чтобы завершить курс."
              )
            ) : completed ? (
              <div className="inline-flex items-center gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4" /> Урок зачтен: домашнее задание принято
                наставником.
              </div>
            ) : (
              "Урок будет засчитан автоматически после того, как наставник примет домашнее задание."
            )}
          </div>
        </article>

        {lesson.day_number === 14 ? (
          session?.access_token ? (
            <FinalQuiz accessToken={session.access_token} />
          ) : null
        ) : (
          <section className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                <ClipboardCheck className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-extrabold">Домашнее задание</h2>
            </div>
            <p className="text-muted-foreground whitespace-pre-wrap">{lesson.homework_md}</p>

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
                    <div className="space-y-3">
                      <Textarea
                        placeholder="Напиши доработанный ответ..."
                        value={hwText}
                        onChange={(e) => setHwText(e.target.value)}
                        rows={6}
                        className="resize-y"
                      />
                      <AttachmentPicker
                        attachments={attachments}
                        onFiles={handleFiles}
                        onRemove={(index) =>
                          setAttachments((prev) => prev.filter((_, i) => i !== index))
                        }
                      />
                      <Button
                        variant="hero"
                        onClick={submitHomework}
                        disabled={!hwText.trim() || saving}
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Отправить доработку
                      </Button>
                    </div>

                    <div className="rounded-xl border border-border bg-muted/40 p-4">
                      <h3 className="text-sm font-semibold">Нужна помощь наставника?</h3>
                      <div className="mt-3 space-y-3">
                        <Textarea
                          placeholder="Напиши вопрос по доработке..."
                          value={questionText}
                          onChange={(e) => setQuestionText(e.target.value)}
                          rows={4}
                          className="resize-y bg-background"
                        />
                        <AttachmentPicker
                          attachments={questionAttachments}
                          onFiles={handleQuestionFiles}
                          onRemove={(index) =>
                            setQuestionAttachments((prev) => prev.filter((_, i) => i !== index))
                          }
                        />
                        <Button
                          variant="outline"
                          onClick={submitQuestion}
                          disabled={!questionText.trim() || asking}
                        >
                          {asking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                          Задать вопрос наставнику
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
                {submission.status === "awaiting_mentor" && (
                  <div className="rounded-xl bg-primary-soft p-4 text-sm text-primary">
                    Вопрос отправлен наставнику. Когда наставник ответит, здесь появится продолжение
                    переписки.
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                <Textarea
                  placeholder="Твой ответ..."
                  value={hwText}
                  onChange={(e) => setHwText(e.target.value)}
                  rows={6}
                  className="resize-y"
                />
                <AttachmentPicker
                  attachments={attachments}
                  onFiles={handleFiles}
                  onRemove={(index) => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                />
                <Button variant="hero" onClick={submitHomework} disabled={!hwText.trim() || saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Отправить на проверку
                </Button>
              </div>
            )}
          </section>
        )}

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          {prevDay ? (
            <Button asChild variant="soft" size="lg">
              <Link to="/lessons/$day" params={{ day: String(prevDay) }}>
                <ArrowLeft className="h-4 w-4" /> День {prevDay}
              </Link>
            </Button>
          ) : (
            <div />
          )}
          {nextDay ? (
            <Button asChild variant="hero" size="lg">
              <Link to="/lessons/$day" params={{ day: String(nextDay) }}>
                День {nextDay} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild variant="hero" size="lg">
              <Link to="/dashboard">
                Завершить курс <CheckCircle2 className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </main>
    </div>
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

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  MessageSquare,
  User,
  BookOpen,
  HelpCircle,
  Send,
  Paperclip,
  X,
  Download,
  Edit3,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { withRetry } from "@/lib/admin-diagnostics";
import {
  answerHomeworkQuestion,
  editHomeworkMessage,
  listAdminHomeworkSubmissions,
  listHomeworkMessages,
  reviewHomeworkSubmission,
} from "@/server/homework.functions";

export const Route = createFileRoute("/admin/homework")({
  validateSearch: z.object({ submission: z.string().uuid().optional() }),
  component: AdminHomework,
});

type Status = "pending" | "approved" | "rejected" | "awaiting_mentor";

type Submission = {
  id: string;
  relatedIds?: string[];
  relatedSubmissions?: Submission[];
  user_id: string;
  lesson_id: string;
  content: string;
  status: Status;
  feedback: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  lesson?: { day_number: number; title: string; homework_md?: string | null } | null;
  profile?: { full_name: string | null; avatar_url?: string | null } | null;
  mentor?: { full_name: string | null; avatar_url?: string | null } | null;
};

type ProfileMini = { id: string; full_name: string | null; avatar_url: string | null };
type LessonMini = { id: string; day_number: number; title: string; homework_md: string | null };
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

function AdminHomework() {
  const { session, isAdmin, user } = useAuth();
  const { submission: targetSubmissionId } = Route.useSearch();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Status>("pending");
  const [items, setItems] = useState<Submission[]>([]);
  const [messagesBySubmission, setMessagesBySubmission] = useState<
    Record<string, HomeworkMessage[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [attachmentsBySubmission, setAttachmentsBySubmission] = useState<
    Record<string, Attachment[]>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadedMessageThreads, setLoadedMessageThreads] = useState<Record<string, boolean>>({});
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageBody, setEditingMessageBody] = useState("");
  const [updatingMessageId, setUpdatingMessageId] = useState<string | null>(null);
  const selected = selectedId ? (items.find((item) => item.id === selectedId) ?? null) : null;

  useEffect(() => {
    if (!isAdmin) return;
    void load(targetSubmissionId);
    // `load` intentionally closes over the current filter for the retry timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, filter, targetSubmissionId]);

  useEffect(() => {
    if (!selected || loadedMessageThreads[selected.id]) return;
    void loadMessagesForSubmission(selected);
    // Message threads are intentionally loaded only when the admin opens a work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id, session?.access_token]);

  async function load(targetId?: string) {
    setLoading(true);
    setLoadError(null);
    try {
      if (!session?.access_token) throw new Error("Не удалось подтвердить админ-сессию");
      const result = await listAdminHomeworkSubmissions({
        data: {
          accessToken: session.access_token,
          status: filter,
          submissionId: targetId,
        },
      });

      const list = groupSubmissions(result.submissions as Submission[]);
      const profileRows = result.profiles as ProfileMini[];
      const lessonRows = result.lessons as LessonMini[];
      const pMap = new Map(
        profileRows.map((p) => [p.id, { full_name: p.full_name, avatar_url: p.avatar_url }]),
      );
      const lMap = new Map(
        lessonRows.map((l) => [
          l.id,
          { day_number: l.day_number, title: l.title, homework_md: l.homework_md },
        ]),
      );

      const hydrated = list.map(
        (s): Submission => ({
          ...s,
          profile: pMap.get(s.user_id) ?? null,
          mentor: s.reviewed_by ? (pMap.get(s.reviewed_by) ?? null) : null,
          lesson: lMap.get(s.lesson_id) ?? null,
        }),
      );
      setItems(hydrated);
      if (targetId) setSelectedId(hydrated[0]?.id ?? null);
      setMessagesBySubmission((prev) => {
        const next = { ...prev };
        for (const submission of hydrated) {
          if (!next[submission.id]) {
            next[submission.id] = buildLegacyMessages(submission);
          }
        }
        return next;
      });
    } catch (error) {
      console.error("Failed to load homework submissions", error);
      setItems([]);
      setLoadError("Не удалось загрузить работы. Попробуйте обновить страницу.");
    } finally {
      setLoading(false);
    }
  }

  function groupSubmissions(rows: Submission[]) {
    const groups = new Map<string, Submission[]>();
    for (const row of rows) {
      const key = `${row.user_id}:${row.lesson_id}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }

    return Array.from(groups.values()).map((group) => {
      const sorted = [...group].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
      return {
        ...sorted[0],
        relatedIds: sorted.map((item) => item.id),
        relatedSubmissions: sorted,
      };
    });
  }

  async function loadMessagesForSubmission(submission: Submission) {
    if (!session?.access_token) {
      setLoadedMessageThreads((prev) => ({ ...prev, [submission.id]: true }));
      return;
    }

    try {
      const threadRes = await withRetry(
        `homework.thread[${submission.id}]`,
        () =>
          supabase
            .from("homework_submissions")
            .select(
              "id,user_id,lesson_id,content,status,feedback,created_at,updated_at,reviewed_at,reviewed_by",
            )
            .eq("user_id", submission.user_id)
            .eq("lesson_id", submission.lesson_id)
            .order("created_at", { ascending: true }),
        { retries: 2, timeoutMs: 5000 },
      );
      const threadRows = ((threadRes.data ?? []) as Submission[]).map((row) => ({
        ...row,
        profile: submission.profile,
        mentor: row.reviewed_by === submission.reviewed_by ? submission.mentor : null,
        lesson: submission.lesson,
      }));
      const fullSubmission: Submission = {
        ...submission,
        relatedIds: threadRows.length ? threadRows.map((item) => item.id) : submission.relatedIds,
        relatedSubmissions: threadRows.length ? threadRows : submission.relatedSubmissions,
      };
      const relatedIds = fullSubmission.relatedIds?.length
        ? fullSubmission.relatedIds
        : [submission.id];
      const messageGroups = await Promise.all(
        relatedIds.map(async (submissionId) => {
          const data = await listHomeworkMessages({
            data: { accessToken: session.access_token, submissionId },
          });
          return ((data as HomeworkMessage[]) ?? []).map((message) => ({
            ...message,
            id: `${submissionId}:${message.id}`,
          }));
        }),
      );
      const loaded = messageGroups
        .flat()
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const messages = loaded.length > 0 ? loaded : buildLegacyMessages(fullSubmission);
      const hydrated = await hydrateMessageAuthors(messages, fullSubmission);
      setMessagesBySubmission((prev) => ({ ...prev, [submission.id]: hydrated }));
    } catch {
      setMessagesBySubmission((prev) => ({
        ...prev,
        [submission.id]: buildLegacyMessages(submission),
      }));
    } finally {
      setLoadedMessageThreads((prev) => ({ ...prev, [submission.id]: true }));
    }
  }

  async function hydrateMessageAuthors(messages: HomeworkMessage[], submission: Submission) {
    const authorIds = Array.from(
      new Set(
        messages.map((message) => message.author_id).filter((id): id is string => Boolean(id)),
      ),
    );
    let rows: { data: ProfileMini[] | null; error: unknown } = {
      data: [] as ProfileMini[],
      error: null,
    };
    if (authorIds.length) {
      try {
        rows = await withRetry("profiles.messageAuthors", () =>
          supabase.from("profiles").select("id,full_name,avatar_url").in("id", authorIds),
        );
      } catch {
        rows = { data: [] as ProfileMini[], error: null };
      }
    }
    const authorMap = new Map(
      ((rows.data ?? []) as ProfileMini[]).map((profile) => [
        profile.id,
        { full_name: profile.full_name, avatar_url: profile.avatar_url },
      ]),
    );

    return messages.map((message) => {
      const fallbackName =
        message.author_role === "student"
          ? submission.profile?.full_name
          : submission.mentor?.full_name;
      return {
        ...message,
        author_name:
          (message.author_id ? authorMap.get(message.author_id)?.full_name : null) ??
          fallbackName ??
          null,
        author_avatar_url:
          (message.author_id ? authorMap.get(message.author_id)?.avatar_url : null) ??
          (message.author_role === "student"
            ? submission.profile?.avatar_url
            : submission.mentor?.avatar_url) ??
          null,
      };
    });
  }

  function buildLegacyMessages(submission: Submission): HomeworkMessage[] {
    const rows = submission.relatedSubmissions?.length
      ? submission.relatedSubmissions
      : [submission];
    return rows
      .flatMap((item) => [
        {
          id: `${item.id}-student`,
          author_id: item.user_id,
          author_role: "student" as const,
          body: item.content,
          attachments: [],
          created_at: item.created_at,
        },
        ...(item.feedback
          ? [
              {
                id: `${item.id}-mentor`,
                author_id: item.reviewed_by,
                author_role: "mentor" as const,
                body: item.feedback,
                attachments: [],
                created_at: item.reviewed_at ?? item.created_at,
              },
            ]
          : []),
      ])
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  async function handleFiles(submissionId: string, files: FileList | null) {
    if (!files?.length) return;
    const current = attachmentsBySubmission[submissionId] ?? [];
    const incoming = Array.from(files);
    if (current.length + incoming.length > 3) {
      toast.error("Можно приложить максимум 3 файла");
      return;
    }
    const tooBig = incoming.find((file) => file.size > 1_500_000);
    if (tooBig) {
      toast.error(`Файл «${tooBig.name}» больше 1.5 МБ`);
      return;
    }
    const loaded = await Promise.all(incoming.map(readAttachment));
    setAttachmentsBySubmission((prev) => ({ ...prev, [submissionId]: [...current, ...loaded] }));
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

  function removeAttachment(submissionId: string, index: number) {
    setAttachmentsBySubmission((prev) => ({
      ...prev,
      [submissionId]: (prev[submissionId] ?? []).filter((_, i) => i !== index),
    }));
  }

  async function review(id: string, status: "approved" | "rejected") {
    if (!session?.access_token) {
      toast.error("Не удалось подтвердить админ-сессию");
      return;
    }
    const fb = feedbacks[id]?.trim() ?? "";
    if (status === "rejected" && !fb) {
      toast.error("Добавь комментарий, что нужно доработать");
      return;
    }
    setSavingId(id);
    try {
      await reviewHomeworkSubmission({
        data: {
          accessToken: session.access_token,
          submissionId: id,
          status,
          feedback: fb,
          attachments: attachmentsBySubmission[id] ?? [],
        },
      });
    } catch {
      setSavingId(null);
      toast.error("Не удалось сохранить");
      return;
    }
    setSavingId(null);
    toast.success(status === "approved" ? "ДЗ принято" : "Отправлено на доработку");
    setItems((prev) => prev.filter((s) => s.id !== id));
    setSelectedId(null);
  }

  async function answerQuestion(id: string) {
    if (!session?.access_token) {
      toast.error("Не удалось подтвердить админ-сессию");
      return;
    }
    const reply = feedbacks[id]?.trim() ?? "";
    if (!reply) {
      toast.error("Напиши ответ ученику");
      return;
    }
    setSavingId(id);
    try {
      await answerHomeworkQuestion({
        data: {
          accessToken: session.access_token,
          submissionId: id,
          feedback: reply,
          attachments: attachmentsBySubmission[id] ?? [],
        },
      });
    } catch {
      setSavingId(null);
      toast.error("Не удалось отправить");
      return;
    }
    setSavingId(null);

    toast.success("Ответ отправлен ученику");
    setItems((prev) => prev.filter((s) => s.id !== id));
    setSelectedId(null);
  }

  async function saveEditedMessage(message: HomeworkMessage) {
    if (!session?.access_token || !editingMessageBody.trim()) return;
    setUpdatingMessageId(message.id);
    try {
      const updated = await editHomeworkMessage({
        data: {
          accessToken: session.access_token,
          messageId: message.id,
          body: editingMessageBody.trim(),
        },
      });
      if (!selected) return;
      setMessagesBySubmission((prev) => ({
        ...prev,
        [selected.id]: (prev[selected.id] ?? []).map((item) =>
          item.id === message.id ? { ...item, body: updated.body } : item,
        ),
      }));
      setEditingMessageId(null);
      setEditingMessageBody("");
      toast.success("Комментарий обновлён");
    } catch {
      toast.error("Не удалось обновить комментарий");
    } finally {
      setUpdatingMessageId(null);
    }
  }

  const tabs: { key: Status; label: string; icon: typeof Clock }[] = [
    { key: "pending", label: "На проверке", icon: Clock },
    { key: "awaiting_mentor", label: "Ждут ответа", icon: HelpCircle },
    { key: "approved", label: "Принятые", icon: CheckCircle2 },
    { key: "rejected", label: "На доработке", icon: XCircle },
  ];
  const closeSubmission = () => {
    setSelectedId(null);
    if (targetSubmissionId) void navigate({ to: "/admin/homework", search: {} });
  };
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Проверка работ</h1>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">
          {loading ? "Загружаем работы…" : `Найдено: ${items.length}`}
        </span>
        <span>по фильтрам:</span>
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => {
                setSelectedId(null);
                setFilter(t.key);
              }}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === t.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <HomeworkDetail
          submission={selected}
          messages={messagesBySubmission[selected.id] ?? buildLegacyMessages(selected)}
          feedback={feedbacks[selected.id] ?? ""}
          attachments={attachmentsBySubmission[selected.id] ?? []}
          saving={savingId === selected.id}
          filter={filter}
          onBack={closeSubmission}
          onFeedback={(value) => setFeedbacks((p) => ({ ...p, [selected.id]: value }))}
          onFiles={(files) => handleFiles(selected.id, files)}
          onRemoveAttachment={(index) => removeAttachment(selected.id, index)}
          onReview={(status) => review(selected.id, status)}
          onAnswer={() => answerQuestion(selected.id)}
          currentUserId={user?.id ?? null}
          editingMessageId={editingMessageId}
          editingMessageBody={editingMessageBody}
          updatingMessageId={updatingMessageId}
          onStartEdit={(message) => {
            setEditingMessageId(message.id);
            setEditingMessageBody(message.body);
          }}
          onCancelEdit={() => {
            setEditingMessageId(null);
            setEditingMessageBody("");
          }}
          onEditedMessageChange={setEditingMessageBody}
          onSaveEditedMessage={saveEditedMessage}
        />
      ) : loadError ? (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          <p>{loadError}</p>
          <Button variant="outline" onClick={() => void load(targetSubmissionId)}>
            Попробовать ещё раз
          </Button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          Здесь пока пусто
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <div className="min-w-[1040px]">
            <div className="grid grid-cols-[170px_minmax(280px,1fr)_120px_110px_180px_130px] bg-muted/70 px-4 py-3 text-xs font-semibold text-muted-foreground">
              <div>Ученик</div>
              <div>Задание</div>
              <div>Создано</div>
              <div>SLA ↑</div>
              <div>Наставник</div>
              <div>Статус</div>
            </div>
            {items.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedId(s.id)}
                className="grid w-full grid-cols-[170px_minmax(280px,1fr)_120px_110px_180px_130px] items-center gap-x-3 border-t border-border px-4 py-4 text-left text-sm transition-colors hover:bg-muted/50"
              >
                <div className="min-w-0 font-medium">{s.profile?.full_name ?? "Студент"}</div>
                <div className="min-w-0">
                  <div className="font-semibold text-primary">{s.lesson?.title ?? "Урок"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    День {s.lesson?.day_number ?? "?"}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
                <SlaCell
                  submission={s}
                  messages={messagesBySubmission[s.id] ?? buildLegacyMessages(s)}
                />
                <div className="min-w-0">{s.mentor?.full_name ?? "Артур Мухайлов"}</div>
                <div className="inline-flex items-center gap-2">
                  <StatusBadge status={s.status} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HomeworkDetail({
  submission,
  messages,
  feedback,
  attachments,
  saving,
  filter,
  onBack,
  onFeedback,
  onFiles,
  onRemoveAttachment,
  onReview,
  onAnswer,
  currentUserId,
  editingMessageId,
  editingMessageBody,
  updatingMessageId,
  onStartEdit,
  onCancelEdit,
  onEditedMessageChange,
  onSaveEditedMessage,
}: {
  submission: Submission;
  messages: HomeworkMessage[];
  feedback: string;
  attachments: Attachment[];
  saving: boolean;
  filter: Status;
  onBack: () => void;
  onFeedback: (value: string) => void;
  onFiles: (files: FileList | null) => void;
  onRemoveAttachment: (index: number) => void;
  onReview: (status: "approved" | "rejected") => void;
  onAnswer: () => void;
  currentUserId: string | null;
  editingMessageId: string | null;
  editingMessageBody: string;
  updatingMessageId: string | null;
  onStartEdit: (message: HomeworkMessage) => void;
  onCancelEdit: () => void;
  onEditedMessageChange: (value: string) => void;
  onSaveEditedMessage: (message: HomeworkMessage) => void;
}) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" /> К списку работ
      </Button>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl font-extrabold">Информация о работе</h2>
        <div className="mt-4 grid gap-3 text-sm md:grid-cols-[160px_1fr]">
          <div className="text-muted-foreground">Ученик</div>
          <div className="font-medium">{submission.profile?.full_name ?? "Студент"}</div>
          <div className="text-muted-foreground">Наставник</div>
          <div className="font-medium">{submission.mentor?.full_name ?? "Артур Мухайлов"}</div>
          <div className="text-muted-foreground">Задача</div>
          <div className="font-medium">
            День {submission.lesson?.day_number ?? "?"}: {submission.lesson?.title ?? "Урок"}
          </div>
          <div className="text-muted-foreground">Дата создания</div>
          <div>{new Date(submission.created_at).toLocaleString("ru-RU")}</div>
          <div className="text-muted-foreground">Статус</div>
          <div>
            <StatusBadge status={submission.status} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl font-extrabold">Условия задания</h2>
        <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {submission.lesson?.homework_md || "Условие задания не заполнено."}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <h2 className="text-xl font-extrabold">Ответ студента и переписка</h2>
        <div className="mt-4">
          <MessageHistory
            messages={messages}
            currentUserId={currentUserId}
            editingMessageId={editingMessageId}
            editingMessageBody={editingMessageBody}
            updatingMessageId={updatingMessageId}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onEditedMessageChange={onEditedMessageChange}
            onSaveEditedMessage={onSaveEditedMessage}
          />
        </div>
      </section>

      {(filter === "pending" || filter === "awaiting_mentor") && (
        <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
          <h2 className="text-xl font-extrabold">Проверка</h2>
          <div className="mt-4 space-y-3">
            <Textarea
              placeholder={
                filter === "awaiting_mentor"
                  ? "Ответ ученику..."
                  : "Комментарий наставника (обязателен при возврате на доработку)..."
              }
              rows={4}
              value={feedback}
              onChange={(e) => onFeedback(e.target.value)}
            />
            <AttachmentPicker
              attachments={attachments}
              onFiles={onFiles}
              onRemove={onRemoveAttachment}
            />
            <div className="flex flex-wrap gap-2">
              {filter === "awaiting_mentor" ? (
                <Button variant="hero" size="sm" disabled={saving} onClick={onAnswer}>
                  <Send className="h-4 w-4" /> Отправить ответ
                </Button>
              ) : (
                <>
                  <Button
                    variant="hero"
                    size="sm"
                    disabled={saving}
                    onClick={() => onReview("approved")}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Принять
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => onReview("rejected")}
                  >
                    <XCircle className="h-4 w-4" /> На доработку
                  </Button>
                </>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const label =
    status === "approved"
      ? "Принято"
      : status === "rejected"
        ? "На доработке"
        : status === "awaiting_mentor"
          ? "Ждёт ответа"
          : "На проверке";
  return (
    <Badge
      variant={
        status === "approved" ? "default" : status === "rejected" ? "destructive" : "secondary"
      }
    >
      {label}
    </Badge>
  );
}

function SlaCell({
  submission,
  messages,
}: {
  submission: Submission;
  messages: HomeworkMessage[];
}) {
  const sla = getSla(submission, messages);
  if (!sla) return <div className="text-muted-foreground">—</div>;
  return (
    <div className={sla.overdue ? "font-semibold text-destructive" : "text-foreground"}>
      {sla.label}
    </div>
  );
}

function getSla(submission: Submission, messages: HomeworkMessage[]) {
  if (submission.status === "awaiting_mentor") return null;

  const lastStudentMessage = [...messages]
    .filter((message) => message.author_role === "student")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
  const fallbackStart =
    submission.status === "pending" ? submission.updated_at : submission.created_at;
  const startedAt = new Date(lastStudentMessage?.created_at ?? fallbackStart).getTime();
  const endAt = submission.reviewed_at ? new Date(submission.reviewed_at).getTime() : Date.now();
  const elapsedMs = Math.max(endAt - startedAt, 0);
  const deadlineMs = 24 * 60 * 60 * 1000;
  const overdue = elapsedMs > deadlineMs;
  const visibleMs = overdue ? elapsedMs - deadlineMs : deadlineMs - elapsedMs;
  const hours = Math.floor(visibleMs / 3_600_000);
  const minutes = Math.floor((visibleMs % 3_600_000) / 60_000);

  return {
    overdue,
    label: overdue ? `+${hours}ч ${minutes}м` : `${hours}ч ${minutes}м`,
  };
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

function MessageHistory({
  messages,
  currentUserId,
  editingMessageId,
  editingMessageBody,
  updatingMessageId,
  onStartEdit,
  onCancelEdit,
  onEditedMessageChange,
  onSaveEditedMessage,
}: {
  messages: HomeworkMessage[];
  currentUserId: string | null;
  editingMessageId: string | null;
  editingMessageBody: string;
  updatingMessageId: string | null;
  onStartEdit: (message: HomeworkMessage) => void;
  onCancelEdit: () => void;
  onEditedMessageChange: (value: string) => void;
  onSaveEditedMessage: (message: HomeworkMessage) => void;
}) {
  if (messages.length === 0) return null;
  return (
    <div className="space-y-3">
      <div className="text-sm font-semibold inline-flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4" />
        История переписки
      </div>
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
          {editingMessageId === message.id ? (
            <div className="space-y-2">
              <Textarea
                aria-label="Редактирование комментария наставника"
                rows={4}
                value={editingMessageBody}
                onChange={(event) => onEditedMessageChange(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onSaveEditedMessage(message)}
                  disabled={!editingMessageBody.trim() || updatingMessageId === message.id}
                >
                  {updatingMessageId === message.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  Сохранить
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit}>
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <>
              {message.body && <div className="whitespace-pre-wrap">{message.body}</div>}
              {message.author_role === "mentor" && message.author_id === currentUserId && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-auto px-0 text-primary hover:bg-transparent hover:text-primary/80"
                  onClick={() => onStartEdit(message)}
                >
                  <Edit3 className="h-3.5 w-3.5" /> Редактировать комментарий
                </Button>
              )}
            </>
          )}
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

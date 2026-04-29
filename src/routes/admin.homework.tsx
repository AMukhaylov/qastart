import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, Loader2, Clock, MessageSquare, User, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/homework")({
  component: AdminHomework,
});

type Status = "pending" | "approved" | "rejected";

type Submission = {
  id: string;
  user_id: string;
  lesson_id: string;
  content: string;
  status: Status;
  feedback: string | null;
  created_at: string;
  reviewed_at: string | null;
  lesson?: { day_number: number; title: string } | null;
  profile?: { full_name: string | null } | null;
};

type ProfileMini = { id: string; full_name: string | null };
type LessonMini = { id: string; day_number: number; title: string };

function withTimeout<T>(query: PromiseLike<T>, ms = 8000): Promise<T> {
  return Promise.race([
    Promise.resolve(query),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error("Request timed out")), ms)),
  ]);
}

function AdminHomework() {
  const { user, isAdmin } = useAuth();
  const [filter, setFilter] = useState<Status>("pending");
  const [items, setItems] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, filter]);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const { data: subs, error } = await withTimeout(
        supabase
          .from("homework_submissions")
          .select("id,user_id,lesson_id,content,status,feedback,created_at,reviewed_at")
          .eq("status", filter)
          .order("created_at", { ascending: false })
      );
      if (error) throw error;

      const list = (subs ?? []) as Submission[];
      const userIds = Array.from(new Set(list.map((s) => s.user_id)));
      const lessonIds = Array.from(new Set(list.map((s) => s.lesson_id)));

      const [{ data: profiles }, { data: lessons }] = await Promise.all([
        userIds.length
          ? withTimeout(supabase.from("profiles").select("id,full_name").in("id", userIds))
          : Promise.resolve({ data: [] as ProfileMini[] }),
        lessonIds.length
          ? withTimeout(supabase.from("lessons").select("id,day_number,title").in("id", lessonIds))
          : Promise.resolve({ data: [] as LessonMini[] }),
      ]);

      const pMap = new Map((profiles as ProfileMini[] | null ?? []).map((p) => [p.id, { full_name: p.full_name }]));
      const lMap = new Map((lessons as LessonMini[] | null ?? []).map((l) => [l.id, { day_number: l.day_number, title: l.title }]));

      setItems(list.map((s) => ({ ...s, profile: pMap.get(s.user_id) ?? null, lesson: lMap.get(s.lesson_id) ?? null })));
    } catch {
      setItems([]);
      setLoadError("Не удалось загрузить ДЗ. Обнови страницу или попробуй позже.");
    } finally {
      setLoading(false);
    }
  }

  async function review(id: string, status: "approved" | "rejected") {
    if (!user) return;
    const fb = feedbacks[id]?.trim() ?? "";
    if (status === "rejected" && !fb) {
      toast.error("Добавь комментарий, что нужно доработать");
      return;
    }
    setSavingId(id);
    const { error } = await supabase
      .from("homework_submissions")
      .update({
        status,
        feedback: fb || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id);
    setSavingId(null);
    if (error) {
      toast.error("Не удалось сохранить");
      return;
    }
    toast.success(status === "approved" ? "ДЗ принято" : "Отправлено на доработку");
    setItems((prev) => prev.filter((s) => s.id !== id));
  }

  const tabs: { key: Status; label: string; icon: typeof Clock }[] = [
    { key: "pending", label: "На проверке", icon: Clock },
    { key: "approved", label: "Принятые", icon: CheckCircle2 },
    { key: "rejected", label: "На доработке", icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Проверка домашних заданий</h1>
        <p className="text-muted-foreground mt-1">Оставь комментарий и прими работу или верни на доработку.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              filter === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-muted-foreground">
          Здесь пока пусто
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <article key={s.id} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
              <header className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant="secondary" className="gap-1"><BookOpen className="h-3 w-3" /> День {s.lesson?.day_number ?? "?"}</Badge>
                  <span className="font-semibold">{s.lesson?.title ?? "Урок"}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-muted-foreground inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> {s.profile?.full_name ?? "Студент"}</span>
                </div>
                <span className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("ru-RU")}</span>
              </header>

              <div className="rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap mb-4">{s.content}</div>

              {filter === "pending" ? (
                <div className="space-y-3">
                  <Textarea
                    placeholder="Комментарий наставника (обязателен при возврате на доработку)…"
                    rows={3}
                    value={feedbacks[s.id] ?? ""}
                    onChange={(e) => setFeedbacks((p) => ({ ...p, [s.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button variant="hero" size="sm" disabled={savingId === s.id} onClick={() => review(s.id, "approved")}>
                      <CheckCircle2 className="h-4 w-4" /> Принять
                    </Button>
                    <Button variant="outline" size="sm" disabled={savingId === s.id} onClick={() => review(s.id, "rejected")}>
                      <XCircle className="h-4 w-4" /> На доработку
                    </Button>
                  </div>
                </div>
              ) : (
                s.feedback && (
                  <div className="rounded-xl bg-primary-soft p-4 text-sm">
                    <div className="font-semibold mb-1 inline-flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Комментарий</div>
                    <div className="whitespace-pre-wrap">{s.feedback}</div>
                  </div>
                )
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

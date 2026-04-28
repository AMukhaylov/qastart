import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, Loader2, PlayCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/lessons/")({
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
  content: string;
  status: "pending" | "approved" | "rejected";
  feedback: string | null;
};

function LessonPage() {
  const { day } = Route.useParams();
  const dayNum = parseInt(day, 10);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [completed, setCompleted] = useState(false);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [hwText, setHwText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!user || isNaN(dayNum)) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dayNum]);

  async function load() {
    setLoading(true);
    const { data: l } = await supabase
      .from("lessons")
      .select("*")
      .eq("day_number", dayNum)
      .maybeSingle();
    if (!l) { setLoading(false); return; }
    setLesson(l as Lesson);

    const [{ data: prog }, { data: sub }] = await Promise.all([
      supabase.from("lesson_progress").select("completed").eq("user_id", user!.id).eq("lesson_id", l.id).maybeSingle(),
      supabase.from("homework_submissions").select("id,content,status,feedback").eq("user_id", user!.id).eq("lesson_id", l.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setCompleted(!!prog?.completed);
    if (sub) {
      setSubmission(sub as Submission);
      setHwText(sub.content);
    }
    setLoading(false);
  }

  async function markComplete() {
    if (!lesson || !user) return;
    setSaving(true);
    const { error } = await supabase
      .from("lesson_progress")
      .upsert({ user_id: user.id, lesson_id: lesson.id, completed: true, completed_at: new Date().toISOString() }, { onConflict: "user_id,lesson_id" });
    setSaving(false);
    if (error) { toast.error("Не удалось сохранить прогресс"); return; }
    setCompleted(true);
    toast.success("Урок отмечен как пройденный");
  }

  async function submitHomework() {
    if (!lesson || !user || !hwText.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from("homework_submissions")
      .insert({ user_id: user.id, lesson_id: lesson.id, content: hwText.trim() })
      .select("id,content,status,feedback")
      .single();
    setSaving(false);
    if (error || !data) { toast.error("Не удалось отправить ДЗ"); return; }
    setSubmission(data as Submission);
    toast.success("Домашка отправлена на проверку");
  }

  if (authLoading || loading) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  if (!lesson) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Урок не найден</p>
        <Button asChild variant="soft"><Link to="/dashboard">В кабинет</Link></Button>
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
            <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> В кабинет</Link>
          </Button>
          <div className="text-sm text-muted-foreground">День {lesson.day_number} из 14</div>
        </div>
      </header>

      <main className="container-page py-10 max-w-4xl space-y-8">
        <div>
          <Badge variant="secondary" className="mb-3">День {lesson.day_number}</Badge>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">{lesson.title}</h1>
          <p className="mt-3 text-lg text-muted-foreground">{lesson.description}</p>
        </div>

        {/* Video */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="aspect-video bg-[var(--gradient-hero)] flex items-center justify-center text-primary-foreground">
            {lesson.video_url ? (
              <iframe src={lesson.video_url} className="w-full h-full" allow="autoplay; encrypted-media" allowFullScreen />
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
          <div className="prose prose-slate max-w-none whitespace-pre-wrap text-[15px] leading-relaxed">
            {lesson.content_md}
          </div>
          <div className="mt-6">
            <Button variant={completed ? "soft" : "hero"} size="lg" onClick={markComplete} disabled={completed || saving}>
              {completed ? (<><CheckCircle2 className="h-5 w-5" /> Урок пройден</>) : (<>Отметить как пройденный</>)}
            </Button>
          </div>
        </article>

        {/* Homework */}
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
                <Badge variant={submission.status === "approved" ? "default" : submission.status === "rejected" ? "destructive" : "secondary"}>
                  {submission.status === "approved" ? "Принято" : submission.status === "rejected" ? "На доработку" : "На проверке"}
                </Badge>
              </div>
              <div className="rounded-xl bg-muted p-4 text-sm whitespace-pre-wrap">{submission.content}</div>
              {submission.feedback && (
                <div className="rounded-xl bg-primary-soft p-4 text-sm">
                  <div className="font-semibold mb-1">Комментарий наставника:</div>
                  <div className="whitespace-pre-wrap">{submission.feedback}</div>
                </div>
              )}
              {submission.status === "rejected" && (
                <Button variant="soft" onClick={() => { setSubmission(null); setHwText(""); }}>
                  Отправить заново
                </Button>
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
              <Button variant="hero" onClick={submitHomework} disabled={!hwText.trim() || saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Отправить на проверку
              </Button>
            </div>
          )}
        </section>

        {/* Navigation */}
        <div className="flex justify-between gap-3">
          {prevDay ? (
            <Button asChild variant="soft" size="lg">
              <Link to="/lessons/$day" params={{ day: String(prevDay) }}><ArrowLeft className="h-4 w-4" /> День {prevDay}</Link>
            </Button>
          ) : <div />}
          {nextDay ? (
            <Button asChild variant="hero" size="lg">
              <Link to="/lessons/$day" params={{ day: String(nextDay) }}>День {nextDay} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          ) : (
            <Button asChild variant="hero" size="lg">
              <Link to="/dashboard">Завершить курс <CheckCircle2 className="h-4 w-4" /></Link>
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

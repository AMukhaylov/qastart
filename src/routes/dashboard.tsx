import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GraduationCap, PlayCircle, Trophy, Flame, ArrowRight, BookOpen, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

type Lesson = { id: string; day_number: number; title: string; description: string };

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [hwApproved, setHwApproved] = useState(0);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      const [{ data: ls }, { data: prog }, { data: hw }] = await Promise.all([
        supabase.from("lessons").select("id,day_number,title,description").order("day_number"),
        supabase.from("lesson_progress").select("lesson_id,completed").eq("user_id", user.id).eq("completed", true),
        supabase.from("homework_submissions").select("id").eq("user_id", user.id).eq("status", "approved"),
      ]);
      setLessons((ls ?? []) as Lesson[]);
      setCompletedIds(new Set((prog ?? []).map((p) => p.lesson_id as string)));
      setHwApproved((hw ?? []).length);
    })();
  }, [user]);

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Загрузка…</div>;
  }

  const name = (user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "друг";
  const totalDays = lessons.length || 14;
  const completedCount = completedIds.size;
  const progressPct = totalDays ? Math.round((completedCount / totalDays) * 100) : 0;
  const currentDay = Math.min(completedCount + 1, totalDays);
  const nextLesson = lessons.find((l) => !completedIds.has(l.id)) ?? lessons[0];

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="border-b border-border bg-background">
        <div className="container-page h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-display font-bold">QA школа</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-primary-soft text-primary font-semibold flex items-center justify-center text-sm">
              {name[0]?.toUpperCase()}
            </div>
            <Button variant="ghost" size="sm" onClick={signOut}>Выйти</Button>
          </div>
        </div>
      </header>

      <main className="container-page py-10 space-y-8">
        {/* Greeting */}
        <section className="rounded-3xl p-8 md:p-10 text-primary-foreground shadow-[var(--shadow-glow)] relative overflow-hidden" style={{ background: "var(--gradient-hero)" }}>
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <Flame className="h-3.5 w-3.5" /> День {currentDay} из {totalDays}
            </div>
            <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">Привет, {name} 👋</h1>
            <p className="mt-2 opacity-90">Каждый день обучения приближает тебя к первой работе в IT.</p>

            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2 opacity-90">
                <span>Прогресс курса</span>
                <span>{progressPct}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
          </div>
        </section>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Next lesson */}
          {nextLesson && (
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {completedCount === 0 ? "Первый урок" : "Следующий урок"}
                </div>
                <div className="text-xs text-primary font-semibold">День {nextLesson.day_number}</div>
              </div>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">{nextLesson.title}</h2>
              <p className="mt-2 text-muted-foreground">{nextLesson.description}</p>
              <div className="mt-6 flex items-center gap-3">
                <Button asChild variant="hero" size="lg">
                  <Link to="/lessons/$day" params={{ day: String(nextLesson.day_number) }}>
                    <PlayCircle className="h-5 w-5" /> {completedCount === 0 ? "Начать урок" : "Продолжить"}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <StatCard icon={BookOpen} label="Уроков пройдено" value={`${completedCount} / ${totalDays}`} />
            <StatCard icon={CheckCircle2} label="ДЗ принято" value={`${hwApproved} / ${totalDays}`} />
            <StatCard icon={Trophy} label="Прогресс" value={`${progressPct}%`} />
          </div>
        </div>

        {/* All lessons */}
        <section className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
          <h3 className="text-xl font-extrabold mb-6">Все уроки курса</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lessons.map((l, i) => {
              const isDone = completedIds.has(l.id);
              const isLocked = !isDone && i > 0 && !completedIds.has(lessons[i - 1].id);
              return (
                <Link
                  key={l.id}
                  to="/lessons/$day"
                  params={{ day: String(l.day_number) }}
                  className={`group rounded-xl border border-border p-4 transition-all hover:shadow-[var(--shadow-card)] hover:-translate-y-0.5 ${isDone ? "bg-primary-soft/50" : "bg-background"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">День {l.day_number}</span>
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : isLocked ? (
                      <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                    )}
                  </div>
                  <div className="font-display font-bold text-sm leading-snug">{l.title}</div>
                </Link>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <div className="h-10 w-10 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-2xl font-extrabold font-display">{value}</div>
      </div>
      <div className="mt-3 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { GraduationCap, PlayCircle, Trophy, Flame, ArrowRight, BookOpen, CheckCircle2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "друг";

  // Demo progress — будет из БД на следующих этапах
  const currentDay = 1;
  const totalDays = 14;
  const progressPct = Math.round((currentDay / totalDays) * 100);

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      {/* Top bar */}
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
            <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">
              Привет, {name} 👋
            </h1>
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
          <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Следующий урок</div>
              <div className="text-xs text-primary font-semibold">День {currentDay}</div>
            </div>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Что такое тестирование</h2>
            <p className="mt-2 text-muted-foreground">Введение в профессию, типы тестирования, ключевые термины.</p>
            <div className="mt-6 flex items-center gap-3">
              <Button variant="hero" size="lg">
                <PlayCircle className="h-5 w-5" /> Начать урок
              </Button>
              <Button variant="soft" size="lg">Конспект</Button>
            </div>
          </div>

          {/* Mini stats */}
          <div className="space-y-4">
            <StatCard icon={BookOpen} label="Уроков пройдено" value="0 / 14" />
            <StatCard icon={CheckCircle2} label="ДЗ сдано" value="0 / 14" />
            <StatCard icon={Trophy} label="Тестов пройдено" value="0 / 14" />
          </div>
        </div>

        {/* Recent assignments */}
        <section className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-extrabold">Последние задания</h3>
            <Button variant="ghost" size="sm">Все задания <ArrowRight className="h-4 w-4" /></Button>
          </div>
          <div className="mt-6 text-center py-12 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-3 text-primary" />
            Заданий пока нет. Они появятся после первого урока.
          </div>
        </section>

        {/* Motivation */}
        <section className="rounded-2xl border border-border bg-primary-soft p-7">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Flame className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg">Маленькие шаги — большие результаты</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Удели курсу 1.5–2 часа сегодня. Через 14 дней ты будешь готов к собеседованию на позицию QA Engineer.
              </p>
            </div>
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

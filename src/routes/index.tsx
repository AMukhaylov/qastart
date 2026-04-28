import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, BookOpen, Code2, Bug, FileText, Briefcase, Users, PlayCircle, MessageSquare, ClipboardCheck, Database, Globe, Search, Layers, Target, LogIn } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import heroQa from "@/assets/hero-qa.png";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const program = [
  { day: "День 1", title: "Что такое тестирование", icon: BookOpen, desc: "Знакомство с профессией QA, базовые понятия" },
  { day: "День 2", title: "Как работает IT-команда", icon: Users, desc: "Роли, процессы, где в команде QA" },
  { day: "День 3", title: "Тест-кейсы и чек-листы", icon: ClipboardCheck, desc: "Учимся описывать проверки понятно" },
  { day: "День 4", title: "Баг-репорты", icon: Bug, desc: "Как правильно оформить найденную ошибку" },
  { day: "День 5", title: "Виды тестирования", icon: Layers, desc: "Функциональное, регрессионное, smoke и другие" },
  { day: "День 6", title: "Тест-дизайн и техники", icon: Sparkles, desc: "Классы эквивалентности, граничные значения" },
  { day: "День 7", title: "Клиент-серверная архитектура", icon: Globe, desc: "Как устроены приложения изнутри" },
  { day: "День 8", title: "Основы API тестирования", icon: Code2, desc: "REST, методы, статусы ответов" },
  { day: "День 9", title: "Postman для новичков", icon: PlayCircle, desc: "Первые запросы и коллекции" },
  { day: "День 10", title: "SQL для тестировщика", icon: Database, desc: "SELECT, JOIN, проверка данных в БД" },
  { day: "День 11", title: "Работа с DevTools", icon: Search, desc: "Network, Console, проверка фронтенда" },
  { day: "День 12", title: "Agile / Scrum / Jira", icon: Briefcase, desc: "Командные процессы и трекеры задач" },
  { day: "День 13", title: "Как искать первую работу QA", icon: FileText, desc: "Резюме, отклики, подготовка к собеседованию" },
  { day: "День 14", title: "Итоговая практика", icon: Target, desc: "Закрепляем всё на реальном мини-проекте" },
];

const howSteps = [
  { icon: PlayCircle, title: "Видео-уроки", desc: "Каждый день — короткий понятный урок без воды" },
  { icon: ClipboardCheck, title: "Практика", desc: "Закрепляем теорию на реальных примерах" },
  { icon: MessageSquare, title: "Поддержка", desc: "Можно задавать вопросы, тебя не оставят одного" },
  { icon: Target, title: "Итоговый проект", desc: "Пробуешь себя в роли тестировщика" },
];

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-accent)" }} />
        <div className="absolute -top-32 -right-32 -z-10 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="container-page pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Интенсивный курс • 14 дней
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              <span className="text-gradient-brand">Интенсивный 2-недельный курс</span><br />
              по тестированию ПО для новичков
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl">
              Интенсивный курс по тестированию для новичков. Попробуй себя в IT и пойми, подходит ли тебе профессия тестировщика — спокойно, понятно и без давления.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/auth">
                  Начать обучение <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="soft" size="xl">
                <Link to="/auth">
                  <LogIn className="h-5 w-5" /> Войти в кабинет
                </Link>
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 blur-3xl bg-primary/20 rounded-full" />
            <div className="relative aspect-square max-w-[520px] mx-auto">
              <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-primary/5 to-primary/0 border border-border" />
              <img
                src={heroQa}
                alt="Иллюстрация QA-инженера с ноутбуком"
                width={520}
                height={520}
                className="relative z-10 w-full h-full object-contain animate-float-slow"
              />
            </div>
          </div>
        </div>
      </section>

      {/* HOW */}
      <section id="how" className="py-20 md:py-28">
        <div className="container-page">
          <SectionHead
            badge="Как проходит обучение"
            title="Интенсивный формат обучения"
            subtitle="Каждый день — новая тема, практика и домашка. Будет насыщенно: придётся приложить усилия, но за 2 недели ты реально попробуешь себя в роли тестировщика."
          />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {howSteps.map((s) => (
              <div key={s.title} className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display font-bold text-lg">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROGRAM */}
      <section id="program" className="py-20 md:py-28 bg-[var(--gradient-soft)]">
        <div className="container-page">
          <SectionHead
            badge="14 дней"
            title="Программа курса"
            subtitle="Каждый день — новая тема: видео, конспект и небольшая практика, чтобы попробовать себя в роли тестировщика."
          />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {program.map((p, i) => (
              <div
                key={p.day}
                className="group rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] hover:-translate-y-1 transition-all"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <p.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground">{p.day}</span>
                </div>
                <h3 className="mt-4 font-display font-bold text-lg leading-snug">{p.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function SectionHead({ badge, title, subtitle, align = "center" }: { badge: string; title: string; subtitle?: string; align?: "center" | "left" }) {
  return (
    <div className={align === "center" ? "text-center max-w-2xl mx-auto" : ""}>
      <div className="inline-flex items-center gap-2 rounded-full bg-primary-soft text-primary px-3 py-1 text-xs font-semibold uppercase tracking-wider">
        {badge}
      </div>
      <h2 className="mt-4 text-3xl md:text-5xl font-extrabold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

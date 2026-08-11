import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ArrowRight,
  Sparkles,
  BookOpen,
  Code2,
  Bug,
  FileText,
  Briefcase,
  Users,
  PlayCircle,
  MessageSquare,
  ClipboardCheck,
  Database,
  Globe,
  Search,
  Layers,
  Target,
  LogIn,
  Heart,
  Video,
  CheckCircle2,
  GraduationCap,
  Award,
  Sprout,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import heroQa from "@/assets/hero-qa.png";
import mentorPhoto from "@/assets/mentor-mukhailov.jpg";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const program = [
  {
    day: "День 1",
    title: "Что такое тестирование",
    icon: BookOpen,
    desc: "Знакомство с профессией QA и базовыми понятиями",
  },
  {
    day: "День 2",
    title: "Как работает IT-команда",
    icon: Users,
    desc: "Роли в команде, взаимодействие участников и место QA",
  },
  {
    day: "День 3",
    title: "Тест-кейсы и чек-листы",
    icon: ClipboardCheck,
    desc: "Учимся описывать проверки понятно",
  },
  {
    day: "День 4",
    title: "Баги и баг-репорты",
    icon: Bug,
    desc: "Дефекты, Severity, Priority и понятный баг-репорт",
  },
  {
    day: "День 5",
    title: "Виды и уровни тестирования",
    icon: Layers,
    desc: "Functional, Smoke, Regression, Integration и UI",
  },
  {
    day: "День 6",
    title: "Техники тест-дизайна",
    icon: Sparkles,
    desc: "Классы эквивалентности, граничные значения",
  },
  {
    day: "День 7",
    title: "Клиент-серверная архитектура",
    icon: Globe,
    desc: "Как устроены приложения изнутри",
  },
  {
    day: "День 8",
    title: "DevTools для тестировщика",
    icon: Search,
    desc: "Elements, Console, Network и разбор запросов",
  },
  {
    day: "День 9",
    title: "API и HTTP",
    icon: Code2,
    desc: "REST, JSON, методы запросов и HTTP status codes",
  },
  {
    day: "День 10",
    title: "Postman",
    icon: PlayCircle,
    desc: "Params, Headers, Body, переменные и практика API",
  },
  {
    day: "День 11",
    title: "SQL и базы данных",
    icon: Database,
    desc: "SELECT, WHERE, ORDER BY, JOIN и проверка данных",
  },
  {
    day: "День 12",
    title: "Методологии разработки",
    icon: Briefcase,
    desc: "Waterfall, Agile, Scrum, Kanban: как устроены и чем отличаются",
  },
  {
    day: "День 13",
    title: "Твой первый день QA",
    icon: FileText,
    desc: "Получаем реальную QA-задачу и тестируем на учебном стенде",
  },
  {
    day: "День 14",
    title: "Итоговый тест QA Start",
    icon: Target,
    desc: "Финальная проверка знаний по всему курсу",
  },
];

const benefits = [
  { icon: PlayCircle, title: "14 понятных уроков", desc: "Короткие видео без воды" },
  { icon: ClipboardCheck, title: "Практические задания", desc: "Закрепляешь теорию руками" },
  { icon: Video, title: "2 групповые встречи", desc: "Живая практика и разбор вопросов" },
  {
    icon: MessageSquare,
    title: "Поддержка в чате",
    desc: "Ответы на вопросы и помощь по заданиям",
  },
  { icon: Target, title: "Итоговый мини-проект", desc: "Пробуешь себя в роли тестировщика" },
];

function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const name = user
    ? ((user.user_metadata?.full_name as string | undefined) ?? user.email?.split("@")[0] ?? "друг")
    : null;

  useEffect(() => {
    if (!user) return;

    const search = new URLSearchParams(window.location.search);
    const hasOAuthParams =
      search.has("code") ||
      search.has("state") ||
      window.location.hash.includes("access_token") ||
      window.location.hash.includes("refresh_token");

    if (hasOAuthParams) {
      window.history.replaceState(null, "", "/");
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [navigate, user]);

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />

      {/* HERO — welcome to platform */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{ background: "var(--gradient-accent)" }} />
        <div className="absolute -top-32 -right-32 -z-10 h-[520px] w-[520px] rounded-full bg-primary/10 blur-3xl" />
        <div className="container-page pt-16 pb-20 md:pt-24 md:pb-28 grid lg:grid-cols-[1.1fr_0.9fr] gap-12 items-center">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <Heart className="h-3.5 w-3.5 text-primary" />
              {user ? `Рад видеть тебя, ${name} 👋` : "Интенсивный курс QA Start"}
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              <span className="text-gradient-brand">Твой путь в тестирование</span>
              <br />
              начинается здесь
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl">
              14 дней видеоуроков, домашних заданий, обратной связи наставника и итоговый
              сертификат. Всё, чтобы спокойно познакомиться с QA.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Sprout className="h-4 w-4 text-primary" /> Для новичков
              </span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-primary" /> Без опыта
              </span>
              <span className="text-border">•</span>
              <span className="inline-flex items-center gap-1.5">
                <UserCheck className="h-4 w-4 text-primary" /> С поддержкой наставника
              </span>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              {user ? (
                <Button asChild variant="hero" size="xl">
                  <Link to="/dashboard">
                    Продолжить обучение <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild variant="hero" size="xl">
                    <Link to="/auth">
                      Регистрация <ArrowRight className="h-5 w-5" />
                    </Link>
                  </Button>
                  <Button asChild variant="soft" size="xl">
                    <Link to="/auth">
                      <LogIn className="h-5 w-5" /> Войти
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -z-10 blur-3xl bg-primary/20 rounded-full" />
            <div className="relative aspect-square max-w-[520px] mx-auto">
              <div className="absolute inset-0 rounded-[2.5rem] bg-gradient-to-br from-primary/5 to-primary/0 border border-border" />
              <img
                src={heroQa}
                alt="Иллюстрация старта обучения QA"
                width={520}
                height={520}
                className="relative z-10 w-full h-full object-contain animate-float-slow"
              />

              {/* Floating decorative cards */}
              <div className="absolute top-4 left-2 md:-left-6 z-20 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] px-4 py-3 flex items-center gap-3 animate-float-slow">
                <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <Bug className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] text-muted-foreground">Найдено багов</div>
                  <div className="font-display font-bold text-sm">128</div>
                </div>
              </div>

              <div className="absolute top-10 -right-2 md:-right-4 z-20 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] px-4 py-3 flex items-center gap-3 animate-float-slow [animation-delay:1.5s]">
                <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] text-muted-foreground">Урок 1</div>
                  <div className="font-display font-bold text-sm">Завершён</div>
                </div>
              </div>

              <div className="absolute bottom-6 -left-2 md:-left-8 z-20 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] px-4 py-3 flex items-center gap-3 animate-float-slow [animation-delay:0.8s]">
                <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] text-muted-foreground">Прогресс</div>
                  <div className="font-display font-bold text-sm">14 дней</div>
                </div>
              </div>

              <div className="absolute bottom-2 right-2 md:-right-6 z-20 rounded-2xl bg-card border border-border shadow-[var(--shadow-card)] px-4 py-3 flex items-center gap-3 animate-float-slow [animation-delay:2.2s]">
                <div className="h-9 w-9 rounded-xl bg-primary-soft text-primary flex items-center justify-center">
                  <PlayCircle className="h-4 w-4" />
                </div>
                <div className="leading-tight">
                  <div className="text-[11px] text-muted-foreground">Видео</div>
                  <div className="font-display font-bold text-sm">14 уроков</div>
                </div>
              </div>

              {/* Tiny floating dots */}
              <div className="absolute top-1/4 -right-8 h-3 w-3 rounded-full bg-primary/60 animate-float-slow [animation-delay:1s] hidden md:block" />
              <div className="absolute bottom-1/3 -left-10 h-2 w-2 rounded-full bg-primary animate-float-slow [animation-delay:1.8s] hidden md:block" />
            </div>
          </div>
        </div>
      </section>

      {/* BENEFITS — what's inside */}
      <section id="how" className="py-20 md:py-24">
        <div className="container-page">
          <SectionHead
            badge="Что внутри"
            title="Что тебя ждёт внутри"
            subtitle="Всё сделано для того, чтобы ты уверенно попробовал себя в QA — от первого урока до итогового проекта."
          />
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-5 gap-5">
            {benefits.map((s) => (
              <div
                key={s.title}
                className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] hover:-translate-y-1 transition-all"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <s.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 font-display font-bold text-base">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROADMAP */}
      <section id="program" className="py-20 md:py-28 bg-[var(--gradient-soft)]">
        <div className="container-page">
          <SectionHead
            badge="14 дней"
            title="Твой маршрут обучения"
            subtitle="Каждый день — новая тема, короткое видео и небольшая практика. Двигайся последовательно — и через две недели соберётся полная картина профессии."
          />
          <div className="mt-12 relative">
            {/* roadmap line on lg+ */}
            <div className="hidden lg:block absolute left-0 right-0 top-7 h-px bg-border" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-7 gap-4">
              {program.map((p, i) => (
                <div
                  key={p.day}
                  className="group relative rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] hover:shadow-[var(--shadow-card)] hover:-translate-y-1 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {p.day}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display font-bold text-sm leading-snug">{p.title}</h3>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                  {/* tiny step number */}
                  <div className="absolute -top-2 -left-2 h-6 w-6 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center shadow-[var(--shadow-glow)]">
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MENTOR */}
      <section id="mentor" className="py-20 md:py-24">
        <div className="container-page">
          <SectionHead
            badge="Наставник"
            title="О наставнике"
            subtitle="Курс ведёт практикующий инженер, который помогал десяткам новичков войти в профессию."
          />
          <div className="mt-12 max-w-3xl mx-auto">
            <div className="rounded-3xl border border-border bg-card p-8 md:p-10 shadow-[var(--shadow-card)] flex flex-col md:flex-row items-center md:items-start gap-8">
              <div className="relative shrink-0">
                <img
                  src={mentorPhoto}
                  alt="Артур Мухайлов — Senior QA Engineer"
                  width={160}
                  height={160}
                  className="h-32 w-32 md:h-40 md:w-40 rounded-3xl object-cover border border-border shadow-[var(--shadow-card)]"
                />
                <div className="absolute -bottom-2 -right-2 h-9 w-9 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-[var(--shadow-glow)]">
                  <GraduationCap className="h-4 w-4" />
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="font-display font-extrabold text-2xl md:text-3xl">Артур Мухайлов</h3>
                <p className="mt-2 text-muted-foreground">
                  Senior QA Engineer • 8+ лет в тестировании • Ментор
                </p>
                <div className="mt-5 flex flex-wrap justify-center md:justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft text-primary px-3 py-1 text-xs font-semibold">
                    <Award className="h-3.5 w-3.5" /> 8+ лет опыта
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft text-primary px-3 py-1 text-xs font-semibold">
                    <Users className="h-3.5 w-3.5" /> Сотни студентов
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft text-primary px-3 py-1 text-xs font-semibold">
                    <MessageSquare className="h-3.5 w-3.5" /> На связи в чате
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function SectionHead({
  badge,
  title,
  subtitle,
  align = "center",
}: {
  badge: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
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

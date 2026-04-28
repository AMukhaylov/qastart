import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Sparkles, PlayCircle, Star, Trophy, MessageSquare, BookOpen, Code2, Bug, FileText, Briefcase } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import heroQa from "@/assets/hero-qa.png";
import arthur from "@/assets/arthur.png";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const program = [
  { day: "День 1", title: "Что такое тестирование", icon: BookOpen, desc: "Роль QA, виды тестирования, термины" },
  { day: "День 2", title: "Тест-дизайн и техники", icon: Sparkles, desc: "Классы эквивалентности, граничные значения" },
  { day: "День 3", title: "Тест-кейсы и чек-листы", icon: FileText, desc: "Учимся писать понятную документацию" },
  { day: "День 4", title: "Баг-репорты", icon: Bug, desc: "Структура, серьёзность, приоритет" },
  { day: "День 5", title: "Jira и трекеры задач", icon: Briefcase, desc: "Работа в команде, статусы, workflow" },
  { day: "День 6", title: "Веб-тестирование", icon: Code2, desc: "DevTools, проверка фронтенда" },
  { day: "День 7", title: "API и Postman", icon: Code2, desc: "REST, методы, статусы, коллекции" },
  { day: "День 8", title: "SQL для тестировщика", icon: Code2, desc: "SELECT, JOIN, проверка данных в БД" },
  { day: "День 9", title: "Мобильное тестирование", icon: PlayCircle, desc: "iOS, Android, эмуляторы" },
  { day: "День 10", title: "Charles и снифферы", icon: Bug, desc: "Анализ трафика, mock-ответы" },
  { day: "День 11", title: "Git и CI/CD основы", icon: Code2, desc: "Зачем QA нужен Git" },
  { day: "День 12", title: "Автотесты — введение", icon: Sparkles, desc: "Selenium, Cypress: что выбрать" },
  { day: "День 13", title: "Резюме и портфолио", icon: FileText, desc: "Как оформить опыт без коммерческого" },
  { day: "День 14", title: "Собеседование", icon: Trophy, desc: "Топ-50 вопросов и как отвечать" },
];

const reviews = [
  {
    name: "Анна К.",
    role: "Junior QA в финтех",
    text: "За 2 недели разобралась с тем, что не могла полгода. Через месяц после курса получила оффер.",
  },
  {
    name: "Дмитрий П.",
    role: "Тестировщик, e-commerce",
    text: "Артур объясняет максимально просто. Куча практики, а не теории «для галочки».",
  },
  {
    name: "Мария Л.",
    role: "QA Engineer",
    text: "Лучшее вложение в себя. Личная обратная связь по каждому ДЗ — это космос.",
  },
];

const faq = [
  { q: "Нужен ли опыт в IT?", a: "Нет. Курс рассчитан на людей с нуля. Мы начинаем с самых базовых понятий." },
  { q: "Сколько времени уделять в день?", a: "1.5–2 часа: видео-урок, конспект, практика и домашнее задание." },
  { q: "Будет ли сертификат?", a: "Да. После завершения курса вы получаете именной сертификат." },
  { q: "Помогаете с трудоустройством?", a: "Разбираем резюме, готовим к собесу, делимся вакансиями партнёров." },
  { q: "Что если я не справлюсь?", a: "Мы рядом на каждом этапе. Личная обратная связь по каждому ДЗ от Senior QA." },
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
              Старт нового потока — каждые 2 недели
            </div>
            <h1 className="mt-6 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Индивидуальный курс <br />
              <span className="text-gradient-brand">«Инженер по тестированию»</span> с нуля
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl">
              Освой востребованную профессию и выйди на первую работу в IT за 14 дней. Личное наставничество от Senior QA Engineer.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Button asChild variant="hero" size="xl">
                <Link to="/auth">
                  Начать обучение <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button asChild variant="soft" size="xl">
                <a href="#program">Программа курса</a>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-8 text-sm">
              <Stat value="500+" label="Выпускников" />
              <Stat value="92%" label="Получают оффер" />
              <Stat value="4.9" label="Средняя оценка" />
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
              <FloatingCard className="absolute -left-4 top-12 hidden md:flex" icon={CheckCircle2} title="Тест пройден" subtitle="Login form" />
              <FloatingCard className="absolute -right-2 bottom-16 hidden md:flex" icon={Bug} title="Баг найден" subtitle="API /payments" />
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAM */}
      <section id="program" className="py-20 md:py-28 bg-[var(--gradient-soft)]">
        <div className="container-page">
          <SectionHead
            badge="14 дней"
            title="Программа курса"
            subtitle="Каждый день — новая тема, видео, конспект, практика и домашнее задание с личной проверкой."
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

      {/* REVIEWS */}
      <section className="py-20 md:py-28">
        <div className="container-page">
          <SectionHead badge="Отзывы" title="Что говорят выпускники" />
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {reviews.map((r) => (
              <div key={r.name} className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
                <div className="flex gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="mt-5 text-base leading-relaxed">«{r.text}»</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary-soft text-primary flex items-center justify-center font-semibold">
                    {r.name[0]}
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="py-20 md:py-28 bg-[var(--gradient-soft)]">
        <div className="container-page grid lg:grid-cols-2 gap-12 items-center">
          <div className="relative">
            <div className="absolute -inset-6 bg-primary/10 rounded-[2rem] blur-2xl -z-10" />
            <div className="aspect-square max-w-md mx-auto rounded-[2rem] overflow-hidden border border-border bg-card shadow-[var(--shadow-card)]">
              <img src={arthur} alt="Артур — Senior QA Engineer" width={500} height={500} loading="lazy" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <SectionHead badge="Обо мне" title="Артур — ваш наставник" align="left" />
            <p className="mt-6 text-lg text-muted-foreground">
              Senior QA Engineer с 8+ годами опыта. Работал в продуктовых IT-компаниях, проводил собеседования, нанимал и обучал джунов.
            </p>
            <ul className="mt-6 space-y-3">
              {[
                "8+ лет в тестировании ПО",
                "Менторил 500+ начинающих QA",
                "Веб, мобильное, API, автотесты",
                "Личная обратная связь по каждому ДЗ",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* PRICE */}
      <section id="price" className="py-20 md:py-28">
        <div className="container-page max-w-3xl">
          <SectionHead badge="Стоимость" title="Один курс — одна цена" />
          <div className="mt-12 relative rounded-[2rem] p-1 shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-hero)" }}>
            <div className="rounded-[calc(2rem-4px)] bg-card p-8 md:p-12">
              <div className="flex flex-wrap items-baseline gap-3">
                <div className="text-5xl md:text-6xl font-extrabold font-display">29 990 ₽</div>
                <div className="text-xl text-muted-foreground line-through">49 990 ₽</div>
                <span className="rounded-full bg-primary text-primary-foreground text-xs font-semibold px-3 py-1">−40%</span>
              </div>
              <p className="mt-3 text-muted-foreground">Полный курс 14 дней + наставничество + сертификат</p>

              <ul className="mt-8 grid sm:grid-cols-2 gap-3">
                {[
                  "14 видео-уроков",
                  "Личная проверка ДЗ",
                  "Тесты после каждого урока",
                  "Чек-листы и шпаргалки QA",
                  "Сертификат об окончании",
                  "Помощь с резюме",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <Button asChild variant="hero" size="xl" className="flex-1">
                  <Link to="/auth">Записаться на курс</Link>
                </Button>
                <Button asChild variant="soft" size="xl">
                  <a href="https://t.me/" target="_blank" rel="noreferrer">
                    <MessageSquare className="h-5 w-5" /> Написать
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 md:py-28 bg-[var(--gradient-soft)]">
        <div className="container-page max-w-3xl">
          <SectionHead badge="FAQ" title="Частые вопросы" />
          <Accordion type="single" collapsible className="mt-10">
            {faq.map((item, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-b border-border">
                <AccordionTrigger className="text-left text-base font-semibold py-5 hover:no-underline">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-20">
        <div className="container-page">
          <div className="rounded-[2rem] p-10 md:p-16 text-center shadow-[var(--shadow-glow)]" style={{ background: "var(--gradient-hero)" }}>
            <h2 className="text-3xl md:text-5xl font-extrabold text-primary-foreground tracking-tight">
              Готов сменить профессию за 14 дней?
            </h2>
            <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">
              Присоединяйся к сотням выпускников, которые уже работают QA-инженерами.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="xl" className="bg-background text-primary hover:bg-background/90 shadow-2xl">
                <Link to="/auth">
                  Начать обучение <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold font-display">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
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

function FloatingCard({ icon: Icon, title, subtitle, className = "" }: { icon: typeof CheckCircle2; title: string; subtitle: string; className?: string }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-card border border-border px-4 py-3 shadow-[var(--shadow-card)] ${className}`}>
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-sm font-semibold leading-tight">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
      </div>
    </div>
  );
}

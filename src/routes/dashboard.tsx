import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  PlayCircle,
  Trophy,
  Flame,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Lock,
  Award,
  ExternalLink,
  ShieldCheck,
  TriangleAlert,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { CompletionConfetti } from "@/components/completion-confetti";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { ensureCurrentUserCertificate } from "@/server/certificates.functions";
import { listPublishedMeetings } from "@/server/meetings.functions";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

type Lesson = { id: string; day_number: number; title: string; description: string };
type Certificate = {
  certificate_number: string;
  verification_code: string;
  course_title: string;
  issued_at: string;
  mentor_name: string;
  revoked_at: string | null;
};
type Profile = { full_name: string | null; avatar_url: string | null };
type Meeting = Awaited<ReturnType<typeof listPublishedMeetings>>[number];

function formatMeetingDate(value: string | null) {
  if (!value) return "Дата скоро появится";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Dashboard() {
  const { user, session, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [hwApproved, setHwApproved] = useState(0);
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setDataLoading(true);
    void (async () => {
      try {
        const [
          { data: ls },
          { data: prog },
          { data: hw },
          { data: cert },
          { data: profileRow },
          publishedMeetings,
        ] = await Promise.all([
          supabase.from("lessons").select("id,day_number,title,description").order("day_number"),
          supabase
            .from("lesson_progress")
            .select("lesson_id,completed")
            .eq("user_id", user.id)
            .eq("completed", true),
          supabase
            .from("homework_submissions")
            .select("id")
            .eq("user_id", user.id)
            .eq("status", "approved"),
          supabase
            .from("certificates")
            .select(
              "certificate_number,verification_code,course_title,issued_at,mentor_name,revoked_at",
            )
            .eq("user_id", user.id)
            .order("issued_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase.from("profiles").select("full_name,avatar_url").eq("id", user.id).maybeSingle(),
          session?.access_token
            ? listPublishedMeetings({ data: { accessToken: session.access_token } })
            : Promise.resolve([]),
        ]);
        const loadedLessons = (ls ?? []) as Lesson[];
        const loadedCompleted = new Set((prog ?? []).map((p) => p.lesson_id as string));
        let loadedCertificate = (cert ?? null) as Certificate | null;

        if (
          !loadedCertificate &&
          session?.access_token &&
          loadedLessons.length > 0 &&
          loadedCompleted.size >= loadedLessons.length
        ) {
          loadedCertificate = (await ensureCurrentUserCertificate({
            data: { accessToken: session.access_token },
          })) as Certificate | null;
        }

        if (cancelled) return;
        setLessons(loadedLessons);
        setCompletedIds(loadedCompleted);
        setHwApproved((hw ?? []).length);
        setCertificate(loadedCertificate);
        setMeetings((publishedMeetings ?? []) as Meeting[]);
        setProfile((profileRow ?? null) as Profile | null);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // Refreshing a Supabase token must not remount the student's dashboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (loading || !user || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  const name =
    profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "друг";
  const totalDays = lessons.length || 14;
  const completedCount = completedIds.size;
  const progressPct = totalDays ? Math.round((completedCount / totalDays) * 100) : 0;
  const isCourseCompleted = completedCount >= totalDays;
  const certificateRevoked = Boolean(certificate?.revoked_at);
  const currentDay = Math.min(completedCount + 1, totalDays);
  const nextLesson = lessons.find((l) => !completedIds.has(l.id)) ?? lessons[0];

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <CompletionConfetti enabled={isCourseCompleted} storageKey={user.id} />
      <header className="border-b border-border bg-background">
        <div className="container-page h-16 flex items-center justify-between">
          <BrandLogo />
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button asChild variant="soft" size="sm">
                <Link to="/admin">
                  <ShieldCheck className="h-4 w-4" /> Админка
                </Link>
              </Button>
            )}
            <Link
              to="/profile"
              aria-label="Открыть личный профиль"
              title="Открыть личный профиль"
              className="inline-flex rounded-full transition hover:ring-4 hover:ring-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
            >
              <Avatar className="h-9 w-9 cursor-pointer border border-primary/10 bg-primary-soft">
                {profile?.avatar_url && (
                  <AvatarImage src={profile.avatar_url} alt={name} className="object-cover" />
                )}
                <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">
                  {name[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="container-page py-10 space-y-8">
        {/* Greeting */}
        <section
          className="rounded-3xl p-8 md:p-10 text-primary-foreground shadow-[var(--shadow-glow)] relative overflow-hidden"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />
          <div className="relative z-10 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider">
                <Flame className="h-3.5 w-3.5" />{" "}
                {isCourseCompleted ? "Курс завершён" : `День ${currentDay} из ${totalDays}`}
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl font-extrabold tracking-tight">
                {isCourseCompleted ? `Поздравляем, ${name}` : `Привет, ${name} 👋`}
              </h1>
              <p className="mt-2 opacity-90">
                {isCourseCompleted
                  ? "Ты успешно завершил(а) курс. Материалы останутся в кабинете навсегда: можно возвращаться к урокам, пересматривать видео и повторять темы в своём темпе."
                  : "Каждый день помогает лучше понимать QA и увереннее разбираться в материалах курса."}
              </p>

              <div className="mt-6">
                <div className="flex justify-between text-sm mb-2 opacity-90">
                  <span>Прогресс курса</span>
                  <span>{progressPct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-white/20 overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {isCourseCompleted && (
              <div
                className={`rounded-2xl border p-5 backdrop-blur lg:w-[330px] ${
                  certificateRevoked
                    ? "border-red-200 bg-red-500/95 text-white shadow-[0_20px_45px_rgba(220,38,38,0.28)]"
                    : "border-white/25 bg-white/12"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                      certificateRevoked ? "bg-white/20 text-white" : "bg-white/20 text-white"
                    }`}
                  >
                    {certificateRevoked ? (
                      <TriangleAlert className="h-5 w-5" />
                    ) : (
                      <Award className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-semibold uppercase tracking-wide opacity-80">
                      {certificateRevoked ? "Сертификат аннулирован" : "Цифровой сертификат"}
                    </div>
                    {certificate ? (
                      <p className="mt-1 text-sm leading-relaxed opacity-90">
                        {certificateRevoked
                          ? `Сертификат ${certificate.certificate_number} аннулирован. Он больше не подтверждает прохождение курса.`
                          : `Сертификат ${certificate.certificate_number} уже доступен для просмотра, скачивания и проверки подлинности.`}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm leading-relaxed opacity-90">
                        Сертификат появится здесь после принятия последнего домашнего задания.
                      </p>
                    )}
                  </div>
                </div>
                {certificate && (
                  <Button
                    asChild
                    className={`mt-5 w-full bg-white hover:bg-white/90 ${
                      certificateRevoked ? "text-red-600" : "text-primary"
                    }`}
                  >
                    <Link to="/certificates/$code" params={{ code: certificate.verification_code }}>
                      {certificateRevoked ? "Посмотреть статус" : "Открыть сертификат"}{" "}
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </section>

        {meetings.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Онлайн-встречи
                </div>
                <h2 className="mt-2 text-2xl font-extrabold tracking-tight">
                  Ссылки на встречи курса
                </h2>
              </div>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {meetings.map((meeting) => (
                <div key={meeting.id} className="rounded-xl border border-border bg-background p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                      <CalendarDays className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Встреча {meeting.position}
                      </div>
                      <h3 className="mt-1 font-display text-lg font-bold leading-tight">
                        {meeting.title}
                      </h3>
                      <p className="mt-1 text-sm font-medium text-primary">
                        {formatMeetingDate(meeting.starts_at)}
                      </p>
                    </div>
                  </div>
                  {meeting.description && (
                    <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                      {meeting.description}
                    </p>
                  )}
                  {meeting.meeting_url && (
                    <Button asChild variant="hero" className="mt-5">
                      <a href={meeting.meeting_url} target="_blank" rel="noreferrer">
                        <Video className="h-4 w-4" /> Перейти на встречу
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Course focus */}
          {(isCourseCompleted || nextLesson) && (
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {isCourseCompleted
                    ? "Материалы курса"
                    : completedCount === 0
                      ? "Первый урок"
                      : "Следующий урок"}
                </div>
                {!isCourseCompleted && nextLesson && (
                  <div className="text-xs text-primary font-semibold">
                    День {nextLesson.day_number}
                  </div>
                )}
              </div>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                {isCourseCompleted ? "Выбери урок для повторения" : nextLesson?.title}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {isCourseCompleted
                  ? "Ниже собраны все темы курса. Открой любой урок, чтобы пересмотреть видео или конспект."
                  : nextLesson?.description}
              </p>
              <div className="mt-6 flex items-center gap-3">
                <Button asChild variant="hero" size="lg">
                  {isCourseCompleted ? (
                    <a href="#all-lessons">
                      <BookOpen className="h-5 w-5" /> Перейти к урокам
                    </a>
                  ) : (
                    <Link to="/lessons/$day" params={{ day: String(nextLesson!.day_number) }}>
                      <PlayCircle className="h-5 w-5" />{" "}
                      {completedCount === 0 ? "Начать урок" : "Продолжить"}
                    </Link>
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <StatCard
              icon={BookOpen}
              label="Уроков пройдено"
              value={`${completedCount} / ${totalDays}`}
            />
            <StatCard
              icon={CheckCircle2}
              label="ДЗ принято"
              value={`${hwApproved} / ${totalDays}`}
            />
            <StatCard icon={Trophy} label="Прогресс" value={`${progressPct}%`} />
          </div>
        </div>

        {/* All lessons */}
        <section
          id="all-lessons"
          className="rounded-2xl border border-border bg-card p-7 shadow-[var(--shadow-soft)]"
        >
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
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      День {l.day_number}
                    </span>
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

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BookOpen;
  label: string;
  value: string;
}) {
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

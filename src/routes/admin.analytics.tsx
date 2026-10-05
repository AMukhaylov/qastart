import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  GraduationCap,
  Loader2,
  RefreshCw,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { getAdminCourseAnalytics } from "@/server/analytics.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/analytics")({ component: AdminAnalytics });

type Analytics = Awaited<ReturnType<typeof getAdminCourseAnalytics>>;

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatHours(value: number | null) {
  if (value === null) return "—";
  if (value < 24) return `${Math.round(value)} ч`;
  const days = value / 24;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} дн.`;
}

function MetricCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: typeof Users;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </section>
  );
}

function ProgressRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">
          {value}{" "}
          <span className="text-muted-foreground">
            / {total} · {percent}%
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function AdminAnalytics() {
  const { session, isAdmin } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      setAnalytics(await getAdminCourseAnalytics({ data: { accessToken: session.access_token } }));
    } catch (error) {
      console.error("Не удалось загрузить аналитику курса", error);
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить аналитику");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const filteredStudents = useMemo(() => {
    if (!analytics) return [];
    const query = search.trim().toLocaleLowerCase("ru");
    if (!query) return analytics.students;
    return analytics.students.filter((student) =>
      `${student.name} ${student.login}`.toLocaleLowerCase("ru").includes(query),
    );
  }, [analytics, search]);

  if (loading && !analytics) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Загружаем аналитику курса…
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center">
        <p className="font-semibold">Не удалось получить аналитику курса</p>
        <Button className="mt-4" variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Повторить
        </Button>
      </div>
    );
  }

  const { totals } = analytics;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Аналитика курса</h1>
          <p className="mt-1 text-muted-foreground">
            Прохождение, активность, домашние задания, вопросы уроков и итоговый тест.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Обновлено {new Date(analytics.generatedAt).toLocaleString("ru-RU")}
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Обновить
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Учеников"
          value={totals.students}
          hint={`${totals.started} начали курс`}
          icon={Users}
        />
        <MetricCard
          label="Завершили курс"
          value={`${totals.completed} · ${totals.completionPercent}%`}
          hint="Успешно сдали итоговый тест"
          icon={GraduationCap}
        />
        <MetricCard
          label="Активны за 7 дней"
          value={totals.activeLast7Days}
          hint={`${totals.inactiveAtLeast7Days} без активности 7+ дней`}
          icon={Activity}
        />
        <MetricCard
          label="Итоговые тесты"
          value={totals.finalQuizAttempts}
          hint={`Медиана попытки: ${totals.medianFinalQuizMinutes === null ? "—" : `${totals.medianFinalQuizMinutes} мин`}`}
          icon={CheckCircle2}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="text-lg font-bold">Воронка прохождения</h2>
            <p className="mt-1 text-sm text-muted-foreground">Этапы курса и итогового теста</p>
          </div>
          <ProgressRow label="Начали обучение" value={totals.started} total={totals.students} />
          <ProgressRow
            label="Прошли не менее половины уроков"
            value={totals.reachedHalf}
            total={totals.students}
          />
          <ProgressRow
            label="Завершили уроки 1–13"
            value={totals.completedLessons1To13}
            total={totals.students}
          />
          <ProgressRow
            label="Сдали итоговый тест и завершили курс"
            value={totals.completed}
            total={totals.students}
          />
        </section>

        <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div>
            <h2 className="text-lg font-bold">Домашние задания и темп</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              По последней отправке каждого ученика на урок
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm text-muted-foreground">Приняты вручную</p>
              <p className="mt-1 text-2xl font-bold">{totals.manualHomeworkApproved}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm text-muted-foreground">Ждут проверки</p>
              <p className="mt-1 text-2xl font-bold">{totals.manualHomeworkPending}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm text-muted-foreground">На доработке</p>
              <p className="mt-1 text-2xl font-bold">{totals.manualHomeworkRejected}</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-4">
              <p className="text-sm text-muted-foreground">SQL-практика завершена</p>
              <p className="mt-1 text-2xl font-bold">{totals.sqlHomeworkCompleted}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Медиана до сдачи ДЗ</p>
              <p className="mt-1 font-semibold">
                {formatHours(totals.medianHoursToSubmitHomework)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                От первого сохранённого действия в уроке
              </p>
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="text-sm text-muted-foreground">Медиана проверки наставником</p>
              <p className="mt-1 font-semibold">{formatHours(totals.medianMentorReviewHours)}</p>
              <p className="mt-1 text-xs text-muted-foreground">От отправки до решения</p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              {analytics.homeworkTimingNote} Метрики задержки показывают отсутствие активности 7/14
              дней после последнего сохранённого действия.
            </p>
          </div>
        </section>
      </div>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Сложные вопросы итогового теста</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Доля правильных ответов и самый частый неверный вариант
            </p>
          </div>
          <span className="text-sm text-muted-foreground">Аналитика ответов итогового теста</span>
        </div>
        {analytics.questionStats.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Тема / вопрос</th>
                  <th className="px-3 py-3 font-medium">Ответов</th>
                  <th className="px-3 py-3 font-medium">Верно</th>
                  <th className="px-3 py-3 font-medium">Частый неверный ответ</th>
                </tr>
              </thead>
              <tbody>
                {analytics.questionStats.slice(0, 12).map((question) => (
                  <tr key={question.id} className="border-b last:border-0">
                    <td className="py-3 pr-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {question.topic}
                      </p>
                      <p className="mt-1 max-w-xl">{question.text}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {question.answered} / {question.seen}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`font-bold ${question.accuracyPercent < 50 ? "text-destructive" : "text-foreground"}`}
                      >
                        {question.accuracyPercent}%
                      </span>
                    </td>
                    <td className="max-w-64 px-3 py-3 text-muted-foreground">
                      {question.topWrongOption ?? "Нет неверных ответов"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Пока нет завершённых попыток с сохранёнными ответами.
          </p>
        )}
        {analytics.topicStats.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            {analytics.topicStats.map((topic) => (
              <span key={topic.topic} className="rounded-full bg-muted px-3 py-1.5 text-xs">
                {topic.topic}: <strong>{topic.accuracyPercent}%</strong> ({topic.seen})
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div>
          <h2 className="text-lg font-bold">Ответы на вопросы в уроках</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Сохраняется первый отправленный ответ каждого ученика; показаны только агрегаты без
            привязки к именам.
          </p>
        </div>
        {analytics.lessonQuestionStats.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="py-3 pr-4 font-medium">Урок / вопрос</th>
                  <th className="px-3 py-3 font-medium">Ответили</th>
                  <th className="px-3 py-3 font-medium">Верно</th>
                  <th className="px-3 py-3 font-medium">Распределение ответов</th>
                </tr>
              </thead>
              <tbody>
                {analytics.lessonQuestionStats.slice(0, 30).map((question) => (
                  <tr key={question.id} className="border-b align-top last:border-0">
                    <td className="py-3 pr-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                        {question.lessonDay ? `Урок ${question.lessonDay}` : question.lessonTitle}
                      </p>
                      <p className="mt-1 max-w-md">{question.text}</p>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{question.answered}</td>
                    <td className="px-3 py-3">
                      <span
                        className={`font-bold ${question.accuracyPercent < 50 ? "text-destructive" : "text-foreground"}`}
                      >
                        {question.accuracyPercent}%
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({question.correct}/{question.answered})
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-xl flex-wrap gap-1.5">
                        {question.options.map((option, index) => (
                          <span
                            key={`${question.id}-${index}`}
                            className={`rounded-full px-2.5 py-1 text-xs ${
                              question.correctIndexes?.includes(index)
                                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {option.text}: <strong>{option.count}</strong>
                          </span>
                        ))}
                      </div>
                      {question.topWrongOption && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          Частая ошибка: {question.topWrongOption}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analytics.lessonQuestionStats.length > 30 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Показаны 30 вопросов с наибольшей долей ошибок.
              </p>
            )}
          </div>
        ) : (
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            Ответы начнут появляться здесь после того, как ученики отправят ответы на вопросы в
            уроках.
          </p>
        )}
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Активность учеников</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Прогресс, тест, ДЗ и давность последнего сохранённого действия
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Найти ученика"
              className="pl-9"
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-3 pr-4 font-medium">Ученик</th>
                <th className="px-3 py-3 font-medium">Уроки</th>
                <th className="px-3 py-3 font-medium">Итоговый тест</th>
                <th className="px-3 py-3 font-medium">ДЗ принято / ждёт</th>
                <th className="px-3 py-3 font-medium">Нет активности</th>
                <th className="px-3 py-3 font-medium">Путь до результата</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student.id} className="border-b last:border-0">
                  <td className="py-3 pr-4">
                    <p className="font-semibold">{student.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {student.login || "Логин не указан"}
                    </p>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {student.completedLessons} / {student.totalLessons}
                  </td>
                  <td className="px-3 py-3">
                    {student.passedCourse ? (
                      <span className="text-emerald-700 dark:text-emerald-400">
                        Сдан · {student.bestQuizPercent}%
                      </span>
                    ) : student.quizAttempts ? (
                      `Попыток: ${student.quizAttempts}`
                    ) : (
                      "Не начинал"
                    )}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {student.approvedHomework} / {student.pendingHomework}
                    {student.rejectedHomework ? ` · на доработке: ${student.rejectedHomework}` : ""}
                  </td>
                  <td className="px-3 py-3">
                    {student.idleDays === null
                      ? "Нет событий"
                      : student.idleDays === 0
                        ? "Сегодня"
                        : `${student.idleDays} дн.`}
                  </td>
                  <td className="px-3 py-3">
                    {student.elapsedDays === null ? "—" : `${student.elapsedDays} дн.`}
                  </td>
                </tr>
              ))}
              {!filteredStudents.length && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    Ничего не найдено
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Время «путь до результата» — календарный интервал между первым сохранённым действием и
          завершением (или последним действием), это не активное время за экраном.
        </p>
      </section>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <BookOpen className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Неактивны 7+ дней</p>
            <p className="text-sm text-muted-foreground">{totals.inactiveAtLeast7Days} учеников</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <Clock3 className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Неактивны 14+ дней</p>
            <p className="text-sm text-muted-foreground">
              {totals.inactiveAtLeast14Days} учеников без сданного теста
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
          <ClipboardCheck className="h-5 w-5 text-primary" />
          <div>
            <p className="font-semibold">Сроки домашних заданий</p>
            <p className="text-sm text-muted-foreground">
              Нужно задать дедлайны для точного отчёта
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

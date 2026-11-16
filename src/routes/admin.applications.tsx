import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Filter, Loader2, RefreshCw, Search, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/application-validation";
import {
  listCourseApplications,
  updateCourseApplicationStatus,
} from "@/server/applications.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/applications")({ component: AdminApplications });

type Application = Awaited<ReturnType<typeof listCourseApplications>>[number];
const statusLabels: Record<ApplicationStatus, string> = {
  new: "Новая",
  contacted: "Связались",
  confirmed: "Подтверждена",
  declined: "Отклонена",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function AdminApplications() {
  const { session, isAdmin } = useAuth();
  const [rows, setRows] = useState<Application[]>([]);
  const [status, setStatus] = useState<"all" | ApplicationStatus>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin || !session?.access_token) return;
    setLoading(true);
    setError(false);
    try {
      const result = await listCourseApplications({
        data: {
          accessToken: session.access_token,
          ...(status === "all" ? {} : { status }),
        },
      });
      setRows(result);
    } catch (loadError) {
      setError(true);
      toast.error(loadError instanceof Error ? loadError.message : "Не удалось загрузить заявки");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, session?.access_token, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("ru");
    return rows.filter(
      (row) => !needle || `${row.name} ${row.contact}`.toLocaleLowerCase("ru").includes(needle),
    );
  }, [rows, search]);

  async function changeStatus(row: Application, nextStatus: ApplicationStatus) {
    if (!session?.access_token || nextStatus === row.status) return;
    setUpdatingId(row.id);
    try {
      await updateCourseApplicationStatus({
        data: { accessToken: session.access_token, id: row.id, status: nextStatus },
      });
      setRows((current) =>
        status !== "all"
          ? current.filter((item) => item.id !== row.id)
          : current.map((item) => (item.id === row.id ? { ...item, status: nextStatus } : item)),
      );
      toast.success("Статус заявки обновлён");
    } catch (updateError) {
      toast.error(
        updateError instanceof Error ? updateError.message : "Не удалось изменить статус",
      );
    } finally {
      setUpdatingId(null);
    }
  }

  if (!isAdmin) {
    return <p className="text-muted-foreground">Проверяем доступ…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">Бесплатный Поток 0</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Заявки</h1>
          <p className="mt-2 text-muted-foreground">
            Контакты и источник перехода. Всего показано: {visibleRows.length}
            {rows.length === 500 ? " (последние 500)" : ""}.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          Обновить
        </Button>
      </div>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:grid-cols-[minmax(0,1fr)_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Поиск по имени или контакту"
            className="pl-9"
            aria-label="Поиск по имени или контакту"
          />
        </label>
        <label className="relative block">
          <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | ApplicationStatus)}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Фильтр по статусу"
          >
            <option value="all">Все статусы</option>
            {APPLICATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Загружаем заявки…
        </div>
      ) : error ? (
        <section className="rounded-2xl border border-destructive/30 bg-card p-6 text-center">
          <p>Не получилось загрузить заявки.</p>
          <Button className="mt-4" variant="outline" onClick={() => void load()}>
            Повторить
          </Button>
        </section>
      ) : visibleRows.length === 0 ? (
        <section className="rounded-2xl border border-border bg-card px-5 py-14 text-center">
          <UserRoundPlus className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">Заявок пока нет</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Новые записи появятся здесь после отправки формы.
          </p>
        </section>
      ) : (
        <div className="grid gap-3">
          {visibleRows.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h2 className="text-lg font-bold">{row.name}</h2>
                    <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
                      {statusLabels[row.status]}
                    </span>
                  </div>
                  <p className="mt-2 break-all text-sm">
                    <span className="font-medium">
                      {row.contact_type === "telegram" ? "Telegram" : "ВКонтакте"}:
                    </span>{" "}
                    {row.contact}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Получена: {formatDate(row.created_at)}
                  </p>
                  <dl className="mt-4 grid gap-x-5 gap-y-2 text-sm sm:grid-cols-2 xl:grid-cols-3">
                    {[
                      ["Источник", row.utm_source],
                      ["Канал", row.utm_medium],
                      ["Кампания", row.utm_campaign],
                      ["Объявление", row.utm_content],
                      ["Ключевая метка", row.utm_term],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-0.5 break-words">{value || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <label className="w-full shrink-0 text-sm font-medium lg:w-52">
                  Статус
                  <select
                    value={row.status}
                    disabled={updatingId === row.id}
                    onChange={(event) =>
                      void changeStatus(row, event.target.value as ApplicationStatus)
                    }
                    className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
                    aria-label={`Статус заявки ${row.name}`}
                  >
                    {APPLICATION_STATUSES.map((value) => (
                      <option key={value} value={value}>
                        {statusLabels[value]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

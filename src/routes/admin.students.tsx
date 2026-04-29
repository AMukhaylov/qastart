import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, User, CheckCircle2, ClipboardCheck, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/admin-diagnostics";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/students")({
  component: AdminStudents,
});

type Profile = { id: string; full_name: string | null; created_at: string };
type Row = Profile & { completed: number; approved: number; pending: number };

function AdminStudents() {
  const { isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [totalLessons, setTotalLessons] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin]);

  async function load() {
    setLoading(true);
    setError(null);
    const [profilesRes, lessonsRes, progressRes, hwRes] = await Promise.all([
      withRetry("profiles.list", () => supabase.from("profiles").select("id,full_name,created_at").order("created_at", { ascending: false })),
      withRetry("lessons.count", () => supabase.from("lessons").select("id")),
      withRetry("lesson_progress.completed", () => supabase.from("lesson_progress").select("user_id,completed").eq("completed", true)),
      withRetry("homework.byStatus", () => supabase.from("homework_submissions").select("user_id,status")),
    ]);

    if (profilesRes.error || lessonsRes.error || progressRes.error || hwRes.error) {
      setError("Не удалось загрузить данные. Повторим автоматически…");
      setLoading(false);
      window.setTimeout(() => void load(), 2500);
      return;
    }

    const profiles = (profilesRes.data ?? []) as Profile[];
    const lessons = (lessonsRes.data ?? []) as { id: string }[];
    const progress = (progressRes.data ?? []) as { user_id: string }[];
    const hw = (hwRes.data ?? []) as { user_id: string; status: string }[];

    setTotalLessons(lessons.length || 14);
    const completedMap = new Map<string, number>();
    progress.forEach((p) => completedMap.set(p.user_id, (completedMap.get(p.user_id) ?? 0) + 1));
    const approvedMap = new Map<string, number>();
    const pendingMap = new Map<string, number>();
    hw.forEach((h) => {
      const m = h.status === "approved" ? approvedMap : h.status === "pending" ? pendingMap : null;
      if (m) m.set(h.user_id, (m.get(h.user_id) ?? 0) + 1);
    });

    setRows(profiles.map((p) => ({
      ...p,
      completed: completedMap.get(p.id) ?? 0,
      approved: approvedMap.get(p.id) ?? 0,
      pending: pendingMap.get(p.id) ?? 0,
    })));
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">Студенты</h1>
          <p className="text-muted-foreground mt-1">Прогресс по курсу и статус домашних заданий.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Обновить
        </Button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-700 dark:text-amber-400 inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold">Студент</th>
                  <th className="text-left px-5 py-3 font-semibold">Регистрация</th>
                  <th className="text-left px-5 py-3 font-semibold">Прогресс</th>
                  <th className="text-left px-5 py-3 font-semibold">ДЗ принято</th>
                  <th className="text-left px-5 py-3 font-semibold">На проверке</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = Math.round((r.completed / totalLessons) * 100);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-primary-soft text-primary text-xs font-semibold flex items-center justify-center">
                            {(r.full_name ?? "?")[0]?.toUpperCase()}
                          </div>
                          <span className="font-medium">{r.full_name ?? <span className="text-muted-foreground inline-flex items-center gap-1"><User className="h-3.5 w-3.5" /> Без имени</span>}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ru-RU")}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2 min-w-[160px]">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">{r.completed}/{totalLessons}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-primary"><CheckCircle2 className="h-4 w-4" /> {r.approved}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center gap-1 text-muted-foreground"><ClipboardCheck className="h-4 w-4" /> {r.pending}</span>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-muted-foreground">Студентов пока нет</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}


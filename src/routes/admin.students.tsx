import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Award,
  Ban,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/admin-diagnostics";
import { Button } from "@/components/ui/button";
import {
  deleteAdminCertificate,
  listAdminCertificates,
  revokeAdminCertificate,
  restoreAdminCertificate,
} from "@/server/certificates.functions";
import {
  deleteAdminStudent,
  listAdminStudentsAuth,
  setAdminStudentBlocked,
  updateAdminStudent,
} from "@/server/students.functions";

export const Route = createFileRoute("/admin/students")({
  component: AdminStudents,
});

type Profile = { id: string; full_name: string | null; created_at: string };
type Certificate = {
  id: string;
  user_id: string;
  certificate_number: string;
  verification_code: string;
  issued_at: string;
  revoked_at: string | null;
};
type AuthStudent = {
  id: string;
  email: string;
  banned_until: string | null;
  full_name: string | null;
};
type Row = Profile & {
  email: string;
  blocked: boolean;
  completed: number;
  approved: number;
  pending: number;
  certificate: Certificate | null;
};
type EditState = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

function splitFullName(fullName: string | null) {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function AdminStudents() {
  const { session, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [totalLessons, setTotalLessons] = useState(14);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCertificateId, setSavingCertificateId] = useState<string | null>(null);
  const [savingStudentId, setSavingStudentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditState | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    setError(null);
    const [profilesRes, lessonsRes, progressRes, hwRes, certificates, authStudents] =
      await Promise.all([
        withRetry("profiles.list", () =>
          supabase
            .from("profiles")
            .select("id,full_name,created_at")
            .order("created_at", { ascending: false }),
        ),
        withRetry("lessons.count", () => supabase.from("lessons").select("id")),
        withRetry("lesson_progress.completed", () =>
          supabase.from("lesson_progress").select("user_id,completed").eq("completed", true),
        ),
        withRetry("homework.byStatus", () =>
          supabase.from("homework_submissions").select("user_id,status"),
        ),
        listAdminCertificates({ data: { accessToken: session.access_token } }),
        listAdminStudentsAuth({ data: { accessToken: session.access_token } }),
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
    const authById = new Map(
      ((authStudents ?? []) as AuthStudent[]).map((student) => [student.id, student]),
    );
    const certificatesByUser = new Map<string, Certificate>();
    ((certificates ?? []) as Certificate[]).forEach((certificate) => {
      const existing = certificatesByUser.get(certificate.user_id);
      if (!existing) {
        certificatesByUser.set(certificate.user_id, certificate);
        return;
      }
      if (existing.revoked_at && !certificate.revoked_at) {
        certificatesByUser.set(certificate.user_id, certificate);
      }
    });

    setTotalLessons(lessons.length || 14);
    const completedMap = new Map<string, number>();
    progress.forEach((p) => completedMap.set(p.user_id, (completedMap.get(p.user_id) ?? 0) + 1));
    const approvedMap = new Map<string, number>();
    const pendingMap = new Map<string, number>();
    hw.forEach((h) => {
      const m = h.status === "approved" ? approvedMap : h.status === "pending" ? pendingMap : null;
      if (m) m.set(h.user_id, (m.get(h.user_id) ?? 0) + 1);
    });

    setRows(
      profiles.map((p) => ({
        ...p,
        email: authById.get(p.id)?.email ?? "",
        blocked: Boolean(authById.get(p.id)?.banned_until),
        full_name: p.full_name ?? authById.get(p.id)?.full_name ?? null,
        completed: completedMap.get(p.id) ?? 0,
        approved: approvedMap.get(p.id) ?? 0,
        pending: pendingMap.get(p.id) ?? 0,
        certificate: certificatesByUser.get(p.id) ?? null,
      })),
    );
    setLoading(false);
  }, [session?.access_token]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  async function revokeCertificate(certificate: Certificate) {
    if (!session?.access_token) return;
    const confirmed = window.confirm(
      `Аннулировать сертификат ${certificate.certificate_number}? На странице сертификата появится статус «Аннулирован».`,
    );
    if (!confirmed) return;

    setSavingCertificateId(certificate.id);
    try {
      await revokeAdminCertificate({
        data: { accessToken: session.access_token, certificateId: certificate.id },
      });
      toast.success("Сертификат аннулирован");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось аннулировать сертификат");
    } finally {
      setSavingCertificateId(null);
    }
  }

  async function deleteCertificate(certificate: Certificate) {
    if (!session?.access_token) return;
    const confirmed = window.confirm(
      `Удалить сертификат ${certificate.certificate_number}? Это действие нельзя отменить.`,
    );
    if (!confirmed) return;

    setSavingCertificateId(certificate.id);
    try {
      await deleteAdminCertificate({
        data: { accessToken: session.access_token, certificateId: certificate.id },
      });
      toast.success("Сертификат удалён");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить сертификат");
    } finally {
      setSavingCertificateId(null);
    }
  }

  async function restoreCertificate(certificate: Certificate) {
    if (!session?.access_token) return;
    const confirmed = window.confirm(
      `Возобновить сертификат ${certificate.certificate_number}? Он снова станет действительным.`,
    );
    if (!confirmed) return;

    setSavingCertificateId(certificate.id);
    try {
      await restoreAdminCertificate({
        data: { accessToken: session.access_token, certificateId: certificate.id },
      });
      toast.success("Сертификат возобновлён");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось возобновить сертификат");
    } finally {
      setSavingCertificateId(null);
    }
  }

  async function saveStudent() {
    if (!session?.access_token || !editing) return;
    const fullName = `${editing.firstName.trim()} ${editing.lastName.trim()}`.trim();
    setSavingStudentId(editing.userId);
    try {
      await updateAdminStudent({
        data: {
          accessToken: session.access_token,
          userId: editing.userId,
          fullName,
          email: editing.email,
          password: editing.password,
        },
      });
      toast.success("Данные студента обновлены");
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить студента");
    } finally {
      setSavingStudentId(null);
    }
  }

  async function toggleBlocked(row: Row) {
    if (!session?.access_token) return;
    const nextBlocked = !row.blocked;
    const confirmed = window.confirm(
      nextBlocked
        ? `Заблокировать вход для ${row.full_name ?? row.email}?`
        : `Разблокировать вход для ${row.full_name ?? row.email}?`,
    );
    if (!confirmed) return;

    setSavingStudentId(row.id);
    try {
      await setAdminStudentBlocked({
        data: { accessToken: session.access_token, userId: row.id, blocked: nextBlocked },
      });
      toast.success(nextBlocked ? "Студент заблокирован" : "Студент разблокирован");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить блокировку");
    } finally {
      setSavingStudentId(null);
    }
  }

  async function removeStudent(row: Row) {
    if (!session?.access_token) return;
    const confirmed = window.confirm(
      `Удалить студента ${row.full_name ?? row.email}? Будут удалены его профиль и связанные данные.`,
    );
    if (!confirmed) return;

    setSavingStudentId(row.id);
    try {
      await deleteAdminStudent({
        data: { accessToken: session.access_token, userId: row.id },
      });
      toast.success("Студент удалён");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить студента");
    } finally {
      setSavingStudentId(null);
    }
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

      {editing && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight">Редактирование студента</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Можно изменить имя, email и задать новый пароль.
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" /> Закрыть
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <label className="space-y-1.5 text-sm font-medium">
              Имя
              <input
                value={editing.firstName}
                onChange={(event) => setEditing({ ...editing, firstName: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Фамилия
              <input
                value={editing.lastName}
                onChange={(event) => setEditing({ ...editing, lastName: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Email
              <input
                type="email"
                value={editing.email}
                onChange={(event) => setEditing({ ...editing, email: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
              />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              Новый пароль
              <input
                type="password"
                value={editing.password}
                onChange={(event) => setEditing({ ...editing, password: event.target.value })}
                placeholder="Оставьте пустым"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
              />
            </label>
          </div>
          <div className="mt-4">
            <Button
              variant="hero"
              size="sm"
              onClick={saveStudent}
              disabled={savingStudentId !== null}
            >
              {savingStudentId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Сохранить
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead className="bg-muted/60 text-muted-foreground text-xs uppercase tracking-wider">
                <tr>
                  <th className="w-[25%] px-3 py-3 text-left font-semibold">Студент</th>
                  <th className="w-[9%] px-3 py-3 text-left font-semibold">Действия</th>
                  <th className="w-[10%] px-3 py-3 text-left font-semibold">Статус</th>
                  <th className="w-[10%] px-3 py-3 text-left font-semibold">Регистрация</th>
                  <th className="w-[15%] px-3 py-3 text-left font-semibold">Прогресс</th>
                  <th className="w-[8%] px-3 py-3 text-left font-semibold">ДЗ</th>
                  <th className="w-[9%] px-3 py-3 text-left font-semibold">Проверка</th>
                  <th className="w-[14%] px-3 py-3 text-left font-semibold">Сертификат</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const pct = Math.round((r.completed / totalLessons) * 100);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
                            {(r.full_name ?? "?")[0]?.toUpperCase()}
                          </div>
                          <span className="truncate font-medium">
                            {r.full_name ?? (
                              <span className="text-muted-foreground inline-flex items-center gap-1">
                                <User className="h-3.5 w-3.5" /> Без имени
                              </span>
                            )}
                          </span>
                        </div>
                        {r.email && (
                          <div className="mt-1 truncate pl-9 text-xs text-muted-foreground">
                            {r.email}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <StudentActions
                          row={r}
                          saving={savingStudentId === r.id}
                          onEdit={() => {
                            const { firstName, lastName } = splitFullName(r.full_name);
                            setEditing({
                              userId: r.id,
                              firstName,
                              lastName,
                              email: r.email,
                              password: "",
                            });
                          }}
                          onToggleBlocked={() => toggleBlocked(r)}
                          onDelete={() => removeStudent(r)}
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-xs font-medium ${
                            r.blocked
                              ? "bg-destructive/10 text-destructive"
                              : "bg-primary-soft text-primary"
                          }`}
                        >
                          {r.blocked ? "Заблокирован" : "Активен"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("ru-RU")}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {r.completed}/{totalLessons}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-primary">
                          <CheckCircle2 className="h-4 w-4" /> {r.approved}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <ClipboardCheck className="h-4 w-4" /> {r.pending}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <CertificateActions
                          certificate={r.certificate}
                          saving={savingCertificateId === r.certificate?.id}
                          onRevoke={revokeCertificate}
                          onRestore={restoreCertificate}
                          onDelete={deleteCertificate}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted-foreground">
                      Студентов пока нет
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StudentActions({
  row,
  saving,
  onEdit,
  onToggleBlocked,
  onDelete,
}: {
  row: Row;
  saving: boolean;
  onEdit: () => void;
  onToggleBlocked: () => void;
  onDelete: () => void;
}) {
  const blockTitle = row.blocked ? "Разблокировать студента" : "Заблокировать студента";

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={saving}
        onClick={onEdit}
        title="Изменить студента"
        aria-label="Изменить студента"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={saving}
        onClick={onToggleBlocked}
        title={blockTitle}
        aria-label={blockTitle}
      >
        {saving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : row.blocked ? (
          <Unlock className="h-3.5 w-3.5" />
        ) : (
          <Ban className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        disabled={saving}
        onClick={onDelete}
        title="Удалить студента"
        aria-label="Удалить студента"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function CertificateActions({
  certificate,
  saving,
  onRevoke,
  onRestore,
  onDelete,
}: {
  certificate: Certificate | null;
  saving: boolean;
  onRevoke: (certificate: Certificate) => void;
  onRestore: (certificate: Certificate) => void;
  onDelete: (certificate: Certificate) => void;
}) {
  if (!certificate) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Award className="h-3.5 w-3.5" /> Нет
      </span>
    );
  }

  const revoked = Boolean(certificate.revoked_at);

  return (
    <div className="space-y-1.5">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
          revoked ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-700"
        }`}
      >
        {revoked ? "Аннулирован" : "Действителен"}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          asChild
          variant="outline"
          size="icon"
          className="h-8 w-8"
          title="Открыть сертификат"
          aria-label="Открыть сертификат"
        >
          <Link
            to="/certificates/$code"
            params={{ code: certificate.verification_code }}
            aria-label="Открыть сертификат"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
        {!revoked ? (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={saving}
            onClick={() => onRevoke(certificate)}
            title="Аннулировать сертификат"
            aria-label="Аннулировать сертификат"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Ban className="h-3.5 w-3.5" />
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={saving}
            onClick={() => onRestore(certificate)}
            title="Возобновить сертификат"
            aria-label="Возобновить сертификат"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={saving}
          onClick={() => onDelete(certificate)}
          title="Удалить сертификат"
          aria-label="Удалить сертификат"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

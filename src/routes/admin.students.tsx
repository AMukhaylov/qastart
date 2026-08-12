import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Award,
  Ban,
  Check,
  ClipboardCheck,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/admin-diagnostics";
import {
  createAdminStudent,
  deleteAdminStudent,
  generateAdminStudentCredentials,
  listAdminStudentsAuth,
  resetAdminStudentPassword,
  setAdminStudentBlocked,
  updateAdminStudent,
} from "@/server/students.functions";
import {
  deleteAdminCertificate,
  listAdminCertificates,
  restoreAdminCertificate,
  revokeAdminCertificate,
} from "@/server/certificates.functions";

export const Route = createFileRoute("/admin/students")({ component: AdminStudents });

type Row = {
  id: string;
  full_name: string | null;
  login: string;
  created_at: string;
  blocked: boolean;
  completed: number;
  approved: number;
  pending: number;
  certificate: Certificate | null;
};
type Certificate = {
  id: string;
  user_id: string;
  certificate_number: string;
  verification_code: string;
  revoked_at: string | null;
};
type AuthStudent = {
  id: string;
  login: string;
  banned_until: string | null;
  full_name: string | null;
};
type FormState = {
  userId?: string;
  firstName: string;
  lastName: string;
  login: string;
  password: string;
};
type Credentials = { fullName: string; login: string; password: string };
const blankForm: FormState = { firstName: "", lastName: "", login: "", password: "" };

function splitName(value: string | null) {
  const parts = (value ?? "").trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}
function credentialsText(item: Credentials) {
  return `Данные для входа в QA Start\n\nЛогин: ${item.login}\nПароль: ${item.password}`;
}

function AdminStudents() {
  const { session, isAdmin } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [totalLessons, setTotalLessons] = useState(14);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCertificateId, setSavingCertificateId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [issued, setIssued] = useState<Credentials | null>(null);
  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    const [profilesRes, lessonsRes, progressRes, homeworkRes, certificates, authRows] =
      await Promise.all([
        withRetry("profiles.list", () =>
          supabase
            .from("profiles")
            .select("id,full_name,login,created_at")
            .order("created_at", { ascending: false }),
        ),
        supabase.from("lessons").select("id"),
        supabase.from("lesson_progress").select("user_id,completed").eq("completed", true),
        supabase.from("homework_submissions").select("user_id,status"),
        listAdminCertificates({ data: { accessToken: session.access_token } }),
        listAdminStudentsAuth({ data: { accessToken: session.access_token } }),
      ]);
    if (profilesRes.error || lessonsRes.error || progressRes.error || homeworkRes.error) {
      toast.error("Не удалось загрузить учеников");
      setLoading(false);
      return;
    }
    const students = (authRows as AuthStudent[]) ?? [];
    const profilesById = new Map((profilesRes.data ?? []).map((profile) => [profile.id, profile]));
    const certificatesByUser = new Map<string, Certificate>();
    ((certificates as Certificate[]) ?? []).forEach((certificate) => {
      const current = certificatesByUser.get(certificate.user_id);
      if (!current || (current.revoked_at && !certificate.revoked_at)) {
        certificatesByUser.set(certificate.user_id, certificate);
      }
    });
    const completed = new Map<string, number>();
    (progressRes.data ?? []).forEach((item) =>
      completed.set(item.user_id, (completed.get(item.user_id) ?? 0) + 1),
    );
    const approved = new Map<string, number>();
    const pending = new Map<string, number>();
    (homeworkRes.data ?? []).forEach((item) => {
      const map =
        item.status === "approved" ? approved : item.status === "pending" ? pending : null;
      if (map) map.set(item.user_id, (map.get(item.user_id) ?? 0) + 1);
    });
    setTotalLessons((lessonsRes.data ?? []).length || 14);
    setRows(
      students.map((student) => {
        const profile = profilesById.get(student.id);
        return {
          id: student.id,
          full_name: profile?.full_name ?? student.full_name,
          login: student.login,
          created_at: profile?.created_at ?? "",
          blocked: Boolean(student.banned_until),
          completed: completed.get(student.id) ?? 0,
          approved: approved.get(student.id) ?? 0,
          pending: pending.get(student.id) ?? 0,
          certificate: certificatesByUser.get(student.id) ?? null,
        };
      }),
    );
    setLoading(false);
  }, [session?.access_token]);
  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);
  async function generate() {
    if (!session?.access_token) return;
    try {
      const data = await generateAdminStudentCredentials({
        data: { accessToken: session.access_token },
      });
      setForm((current) => ({
        ...(current ?? blankForm),
        login: data.login,
        password: data.password,
      }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сгенерировать данные");
    }
  }
  function openCreate() {
    setForm(blankForm);
    void generate();
  }
  async function save() {
    if (!session?.access_token || !form) return;
    setSaving(true);
    try {
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      if (form.userId) {
        await updateAdminStudent({
          data: {
            accessToken: session.access_token,
            userId: form.userId,
            firstName: form.firstName,
            lastName: form.lastName,
            login: form.login,
            password: form.password,
          },
        });
        toast.success("Данные ученика обновлены");
      } else {
        const data = await createAdminStudent({
          data: {
            accessToken: session.access_token,
            firstName: form.firstName,
            lastName: form.lastName,
            login: form.login,
            password: form.password,
          },
        });
        setIssued({ fullName: data.fullName, login: data.login, password: data.password });
        toast.success("Ученик создан");
      }
      setForm(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить ученика");
    } finally {
      setSaving(false);
    }
  }
  async function resetPassword(row: Row) {
    if (!session?.access_token) return;
    if (
      !window.confirm(
        `Сгенерировать новый пароль для ${row.full_name ?? row.login}? Старый пароль перестанет работать.`,
      )
    )
      return;
    setSaving(true);
    try {
      const { password } = await resetAdminStudentPassword({
        data: { accessToken: session.access_token, userId: row.id },
      });
      setIssued({ fullName: row.full_name ?? "Ученик", login: row.login, password });
      toast.success("Новый пароль создан");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сбросить пароль");
    } finally {
      setSaving(false);
    }
  }
  async function resetPasswordForForm() {
    if (!form?.userId) return;
    await resetPassword({
      id: form.userId,
      full_name: `${form.firstName} ${form.lastName}`.trim(),
      login: form.login,
      created_at: "",
      blocked: false,
      completed: 0,
      approved: 0,
      pending: 0,
      certificate: null,
    });
  }
  async function toggleBlocked(row: Row) {
    if (!session?.access_token) return;
    const next = !row.blocked;
    if (
      !window.confirm(
        `${next ? "Заблокировать" : "Разблокировать"} вход для ${row.full_name ?? row.login}?`,
      )
    )
      return;
    setSaving(true);
    try {
      await setAdminStudentBlocked({
        data: { accessToken: session.access_token, userId: row.id, blocked: next },
      });
      toast.success(next ? "Ученик заблокирован" : "Ученик разблокирован");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус");
    } finally {
      setSaving(false);
    }
  }
  async function deleteStudent(row: Row) {
    if (!session?.access_token) return;
    if (
      !window.confirm(
        `Полностью удалить ученика ${row.full_name ?? row.login}? Его доступ, прогресс и данные аккаунта будут удалены без возможности восстановления.`,
      )
    )
      return;
    setSaving(true);
    try {
      await deleteAdminStudent({
        data: { accessToken: session.access_token, userId: row.id },
      });
      toast.success("Ученик полностью удалён");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось удалить ученика");
    } finally {
      setSaving(false);
    }
  }
  async function revokeCertificate(certificate: Certificate) {
    if (!session?.access_token) return;
    if (!window.confirm(`Аннулировать сертификат ${certificate.certificate_number}?`)) return;
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
  async function restoreCertificate(certificate: Certificate) {
    if (!session?.access_token) return;
    if (!window.confirm(`Возобновить сертификат ${certificate.certificate_number}?`)) return;
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
  async function deleteCertificate(certificate: Certificate) {
    if (!session?.access_token) return;
    if (
      !window.confirm(
        `Удалить сертификат ${certificate.certificate_number}? Это действие нельзя отменить.`,
      )
    )
      return;
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
  async function copyIssued() {
    if (!issued) return;
    await navigator.clipboard.writeText(credentialsText(issued));
    toast.success("Данные для входа скопированы");
  }
  if (!isAdmin) return null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Ученики</h1>
          <p className="mt-1 text-muted-foreground">
            Создание доступов, прогресс и статусы обучения.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Обновить
          </Button>
          <Button variant="hero" size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> Создать ученика
          </Button>
        </div>
      </div>
      {form && (
        <StudentForm
          form={form}
          saving={saving}
          onChange={setForm}
          onGenerate={() => void generate()}
          onClose={() => setForm(null)}
          onSave={() => void save()}
          onResetPassword={form.userId ? () => void resetPasswordForForm() : undefined}
        />
      )}
      {issued && (
        <CredentialsPanel
          item={issued}
          onCopy={() => void copyIssued()}
          onClose={() => setIssued(null)}
        />
      )}
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Ученик</th>
                <th className="px-4 py-3">Логин</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Прогресс</th>
                <th className="px-4 py-3">ДЗ</th>
                <th className="px-4 py-3">Сертификат</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-soft text-primary">
                        {(row.full_name ?? "?")[0]}
                      </span>
                      {row.full_name ?? "Без имени"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{row.login}</td>
                  <td className="px-4 py-3">
                    <span className={row.blocked ? "text-destructive" : "text-primary"}>
                      {row.blocked ? "Заблокирован" : "Активен"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {row.completed}/{totalLessons}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1">
                      <ClipboardCheck className="h-4 w-4" />
                      {row.approved} / {row.pending}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <CertificateStatus certificate={row.certificate} />
                  </td>
                  <td className="px-4 py-3">
                    <StudentActions
                      row={row}
                      saving={saving || savingCertificateId === row.certificate?.id}
                      onEdit={() => {
                        const name = splitName(row.full_name);
                        setForm({ userId: row.id, ...name, login: row.login, password: "" });
                      }}
                      onToggleBlocked={() => void toggleBlocked(row)}
                      onDeleteStudent={() => void deleteStudent(row)}
                      onRevoke={() => row.certificate && void revokeCertificate(row.certificate)}
                      onRestore={() => row.certificate && void restoreCertificate(row.certificate)}
                      onDelete={() => row.certificate && void deleteCertificate(row.certificate)}
                    />
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Учеников пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
function CertificateStatus({ certificate }: { certificate: Certificate | null }) {
  if (!certificate) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Award className="h-3.5 w-3.5" /> Нет
      </span>
    );
  }
  return (
    <span
      className={certificate.revoked_at ? "text-xs text-destructive" : "text-xs text-emerald-700"}
    >
      {certificate.revoked_at ? "Аннулирован" : "Действителен"}
    </span>
  );
}
function StudentActions({
  row,
  saving,
  onEdit,
  onToggleBlocked,
  onDeleteStudent,
  onRevoke,
  onRestore,
  onDelete,
}: {
  row: Row;
  saving: boolean;
  onEdit: () => void;
  onToggleBlocked: () => void;
  onDeleteStudent: () => void;
  onRevoke: () => void;
  onRestore: () => void;
  onDelete: () => void;
}) {
  const certificate = row.certificate;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          aria-label="Действия ученика"
          title="Действия ученика"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-56">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil /> Изменить данные
        </DropdownMenuItem>
        <DropdownMenuItem disabled={saving} onSelect={onToggleBlocked}>
          {row.blocked ? <Unlock /> : <Ban />} {row.blocked ? "Разблокировать" : "Заблокировать"}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={saving}
          onSelect={onDeleteStudent}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 /> Удалить ученика
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Сертификат</DropdownMenuLabel>
        {certificate ? (
          <>
            <DropdownMenuItem
              onSelect={() =>
                window.open(
                  `/certificates/${certificate.verification_code}`,
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <ExternalLink /> Открыть сертификат
            </DropdownMenuItem>
            {certificate.revoked_at ? (
              <DropdownMenuItem disabled={saving} onSelect={onRestore}>
                <RotateCcw /> Возобновить
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem disabled={saving} onSelect={onRevoke}>
                <Ban /> Аннулировать
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={saving}
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 /> Удалить сертификат
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem disabled>
            <Award /> Сертификат ещё не выдан
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function StudentForm({
  form,
  saving,
  onChange,
  onGenerate,
  onClose,
  onSave,
  onResetPassword,
}: {
  form: FormState;
  saving: boolean;
  onChange: (form: FormState) => void;
  onGenerate: () => void;
  onClose: () => void;
  onSave: () => void;
  onResetPassword?: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const field = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [key]: e.target.value });
  return (
    <section className="max-w-5xl rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
      <div className="flex justify-between gap-3">
        <div>
          <h2 className="font-extrabold">
            {form.userId ? "Редактирование ученика" : "Новый ученик"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Email не используется. Данные для входа выдаёт администратор.
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FormInput label="Имя" value={form.firstName} onChange={field("firstName")} />
        <FormInput label="Фамилия" value={form.lastName} onChange={field("lastName")} />
        <FormInput label="Логин" value={form.login} onChange={field("login")} />
        <PasswordInput
          label={form.userId ? "Новый пароль (необязательно)" : "Пароль"}
          type={showPassword ? "text" : "password"}
          value={form.password}
          onChange={field("password")}
          placeholder={form.userId ? "Введите, чтобы заменить текущий" : "Не менее 10 символов"}
          visible={showPassword}
          onToggle={() => setShowPassword((current) => !current)}
        />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onGenerate}>
          Сгенерировать логин и пароль
        </Button>
        {form.userId && onResetPassword && (
          <Button variant="outline" size="sm" onClick={onResetPassword} disabled={saving}>
            <KeyRound className="h-4 w-4" /> Сбросить пароль
          </Button>
        )}
        <Button variant="hero" size="sm" onClick={onSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          Сохранить
        </Button>
      </div>
    </section>
  );
}
function FormInput({
  label,
  ...props
}: {
  label: string;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      {label}
      <input
        {...props}
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/25"
      />
    </label>
  );
}
function PasswordInput({
  label,
  visible,
  onToggle,
  ...props
}: {
  label: string;
  visible: boolean;
  onToggle: () => void;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  type: "text" | "password";
  placeholder: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-medium">
      {label}
      <span className="relative block">
        <input
          {...props}
          className="h-10 w-full rounded-md border border-input bg-background px-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring/25"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          title={visible ? "Скрыть пароль" : "Показать пароль"}
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}
function CredentialsPanel({
  item,
  onCopy,
  onClose,
}: {
  item: Credentials;
  onCopy: () => void;
  onClose: () => void;
}) {
  return (
    <section className="rounded-2xl border border-primary/30 bg-primary-soft p-5 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h2 className="font-extrabold text-primary">Ученик создан</h2>
          <p className="mt-3 text-sm">
            Имя: <strong>{item.fullName}</strong>
          </p>
          <p className="text-sm">
            Логин: <strong className="font-mono">{item.login}</strong>
          </p>
          <p className="text-sm">
            Пароль: <strong className="font-mono">{item.password}</strong>
          </p>
        </div>
        <div className="flex h-fit gap-2">
          <Button variant="hero" size="sm" onClick={onCopy}>
            <Copy className="h-4 w-4" /> Скопировать данные для входа
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Check className="h-4 w-4" /> Готово
          </Button>
        </div>
      </div>
    </section>
  );
}

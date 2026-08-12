import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Ban,
  Check,
  ClipboardCheck,
  Copy,
  KeyRound,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Unlock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { withRetry } from "@/lib/admin-diagnostics";
import {
  createAdminStudent,
  generateAdminStudentCredentials,
  listAdminStudentsAuth,
  resetAdminStudentPassword,
  setAdminStudentBlocked,
  updateAdminStudent,
} from "@/server/students.functions";

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
  const [form, setForm] = useState<FormState | null>(null);
  const [issued, setIssued] = useState<Credentials | null>(null);
  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    const [profilesRes, lessonsRes, progressRes, homeworkRes, authRows] = await Promise.all([
      withRetry("profiles.list", () =>
        supabase
          .from("profiles")
          .select("id,full_name,login,created_at")
          .order("created_at", { ascending: false }),
      ),
      supabase.from("lessons").select("id"),
      supabase.from("lesson_progress").select("user_id,completed").eq("completed", true),
      supabase.from("homework_submissions").select("user_id,status"),
      listAdminStudentsAuth({ data: { accessToken: session.access_token } }),
    ]);
    if (profilesRes.error || lessonsRes.error || progressRes.error || homeworkRes.error) {
      toast.error("Не удалось загрузить учеников");
      setLoading(false);
      return;
    }
    const authById = new Map(
      (authRows as { id: string; login: string; banned_until: string | null }[]).map((item) => [
        item.id,
        item,
      ]),
    );
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
      (
        (profilesRes.data ?? []) as {
          id: string;
          full_name: string | null;
          login: string;
          created_at: string;
        }[]
      ).map((profile) => ({
        ...profile,
        login: authById.get(profile.id)?.login ?? profile.login,
        blocked: Boolean(authById.get(profile.id)?.banned_until),
        completed: completed.get(profile.id) ?? 0,
        approved: approved.get(profile.id) ?? 0,
        pending: pending.get(profile.id) ?? 0,
      })),
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
                    <div className="flex gap-1">
                      <IconButton
                        title="Изменить"
                        onClick={() => {
                          const name = splitName(row.full_name);
                          setForm({ userId: row.id, ...name, login: row.login, password: "" });
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton title="Сбросить пароль" onClick={() => void resetPassword(row)}>
                        <KeyRound className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        title={row.blocked ? "Разблокировать" : "Заблокировать"}
                        onClick={() => void toggleBlocked(row)}
                      >
                        {row.blocked ? <Unlock className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
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
function IconButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8"
      title={title}
      aria-label={title}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
function StudentForm({
  form,
  saving,
  onChange,
  onGenerate,
  onClose,
  onSave,
}: {
  form: FormState;
  saving: boolean;
  onChange: (form: FormState) => void;
  onGenerate: () => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const field = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [key]: e.target.value });
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
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
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <FormInput label="Имя" value={form.firstName} onChange={field("firstName")} />
        <FormInput label="Фамилия" value={form.lastName} onChange={field("lastName")} />
        <FormInput label="Логин" value={form.login} onChange={field("login")} />
        <FormInput
          label={form.userId ? "Новый пароль" : "Пароль"}
          type="text"
          value={form.password}
          onChange={field("password")}
          placeholder={form.userId ? "Оставьте пустым" : "Не менее 10 символов"}
        />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onGenerate}>
          Сгенерировать логин и пароль
        </Button>
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

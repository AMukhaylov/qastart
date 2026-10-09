import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Award,
  Ban,
  BookOpen,
  CalendarDays,
  Check,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  RefreshCw,
  RotateCcw,
  Search,
  Save,
  Trash2,
  Unlock,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/use-auth";
import { courseDate, formatCourseDateTime } from "@/lib/course-schedule";
import {
  createAdminStudent,
  deleteAdminStudent,
  generateAdminStudentCredentials,
  listAdminStudentsOverview,
  resetAdminStudentPassword,
  setAdminStudentBlocked,
  updateAdminStudent,
} from "@/server/students.functions";
import {
  deleteAdminCertificate,
  restoreAdminCertificate,
  revokeAdminCertificate,
} from "@/server/certificates.functions";
import { grantAdditionalFinalQuizAttempt } from "@/server/final-quiz.functions";
import {
  deleteAdminStudentGroup,
  listAdminStudentGroups,
  saveAdminStudentGroup,
  setAdminStudentGroupMembers,
} from "@/server/student-groups.functions";

export const Route = createFileRoute("/admin/students")({ component: AdminStudents });

type Row = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  login: string;
  created_at: string;
  course_start_at: string | null;
  currentDay: number;
  currentAvailableLesson: number;
  courseStatus: string;
  homeworkCounts: { assigned: number; submitted: number; notSubmitted: number };
  blocked: boolean;
  completed: number;
  approved: number;
  pending: number;
  canGrantQuizAttempt: boolean;
  certificate: Certificate | null;
  groups: Array<{ id: string; name: string }>;
};
type Certificate = {
  id: string;
  user_id: string;
  certificate_number: string;
  verification_code: string;
  revoked_at: string | null;
};
type FormState = {
  userId?: string;
  firstName: string;
  lastName: string;
  login: string;
  password: string;
  courseStartDate: string;
};
type Credentials = { fullName: string; login: string; password: string };
type Group = Awaited<ReturnType<typeof listAdminStudentGroups>>[number];
const blankForm: FormState = {
  firstName: "",
  lastName: "",
  login: "",
  password: "",
  courseStartDate: "",
};

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
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingCertificateId, setSavingCertificateId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [issued, setIssued] = useState<Credentials | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupFilter, setGroupFilter] = useState("all");
  const [showGroups, setShowGroups] = useState(false);
  const [groupDraft, setGroupDraft] = useState({ name: "", description: "" });
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [groupEditDraft, setGroupEditDraft] = useState({
    name: "",
    description: "",
    studentIds: [] as string[],
  });
  const [groupSearch, setGroupSearch] = useState("");
  const [studentGroupsStudent, setStudentGroupsStudent] = useState<Row | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Row | null>(null);
  const [studentGroupSelection, setStudentGroupSelection] = useState<string[]>([]);
  const load = useCallback(
    async (showSpinner = true) => {
      if (!session?.access_token) return;
      if (showSpinner) setLoading(true);
      if (showSpinner) setLoadError(false);
      try {
        const overview = await listAdminStudentsOverview({
          data: { accessToken: session.access_token },
        });
        const students = overview.students;
        const groupData = overview.groups as Group[];
        setGroups(groupData);
        const groupsByStudent = new Map<string, Array<{ id: string; name: string }>>();
        for (const group of groupData) {
          for (const studentId of group.studentIds) {
            const studentGroups = groupsByStudent.get(studentId) ?? [];
            studentGroups.push({ id: group.id, name: group.name });
            groupsByStudent.set(studentId, studentGroups);
          }
        }
        setTotalLessons(overview.totalLessons);
        setRows(
          students.map((student) => {
            return {
              id: student.id,
              full_name: student.full_name,
              avatar_url: student.avatar_url,
              login: student.login,
              created_at: student.created_at,
              course_start_at: student.course_start_at,
              currentDay: student.currentDay,
              currentAvailableLesson: student.currentAvailableLesson,
              courseStatus: student.courseStatus,
              homeworkCounts: student.homeworkCounts,
              blocked: Boolean(student.banned_until),
              completed: student.completed,
              approved: student.approved,
              pending: student.pending,
              canGrantQuizAttempt: Boolean(overview.quizEligibility?.[student.id]),
              certificate: (student.certificate as Certificate | null) ?? null,
              groups: groupsByStudent.get(student.id) ?? [],
            };
          }),
        );
      } catch (error) {
        console.error("Не удалось загрузить учеников", error);
        if (showSpinner) setLoadError(true);
        toast.error(showSpinner ? "Не удалось загрузить учеников" : "Список не удалось обновить");
      } finally {
        if (showSpinner) setLoading(false);
      }
    },
    [session?.access_token],
  );
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
            courseStartDate: form.courseStartDate || null,
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
            courseStartDate: form.courseStartDate || null,
          },
        });
        setIssued({ fullName: data.fullName, login: data.login, password: data.password });
        toast.success("Ученик создан");
      }
      setForm(null);
      // Don't keep the save/create dialog waiting for a full course-wide
      // overview refresh; reconcile the list in the background instead.
      void load(false);
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
      avatar_url: null,
      login: form.login,
      created_at: "",
      course_start_at: null,
      currentDay: 0,
      currentAvailableLesson: 0,
      courseStatus: "not_scheduled",
      homeworkCounts: { assigned: 0, submitted: 0, notSubmitted: 0 },
      blocked: false,
      completed: 0,
      approved: 0,
      pending: 0,
      canGrantQuizAttempt: false,
      certificate: null,
      groups: [],
    });
  }
  async function grantQuizAttempt(row: Row) {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const result = await grantAdditionalFinalQuizAttempt({
        data: { accessToken: session.access_token, userId: row.id },
      });
      toast.success(
        `Дополнительная попытка добавлена. Новых попыток доступно: ${result.availableAttempts} из ${result.maxAttempts}`,
      );
      void load(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" &&
              error &&
              "message" in error &&
              typeof error.message === "string"
            ? error.message
            : "Не удалось добавить попытку";
      toast.error(message);
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
      setRows((current) =>
        current.map((item) => (item.id === row.id ? { ...item, blocked: next } : item)),
      );
      toast.success(next ? "Ученик заблокирован" : "Ученик разблокирован");
      void load(false);
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
      setRows((current) => current.filter((item) => item.id !== row.id));
      void load(false);
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
      void load(false);
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
      void load(false);
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
      void load(false);
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
  function openGroupEditor(group: Group) {
    setEditingGroup(group);
    setGroupEditDraft({
      name: group.name,
      description: group.description,
      studentIds: [...group.studentIds],
    });
    setGroupSearch("");
  }
  function openStudentGroups(row: Row) {
    setStudentGroupsStudent(row);
    setStudentGroupSelection(row.groups.map((group) => group.id));
  }
  async function saveStudentGroups() {
    if (!session?.access_token || !studentGroupsStudent) return;
    try {
      await Promise.all(
        groups.map((group) => {
          const hasStudent = group.studentIds.includes(studentGroupsStudent.id);
          const shouldHaveStudent = studentGroupSelection.includes(group.id);
          if (hasStudent === shouldHaveStudent) return Promise.resolve();
          const studentIds = shouldHaveStudent
            ? [...group.studentIds, studentGroupsStudent.id]
            : group.studentIds.filter((id) => id !== studentGroupsStudent.id);
          return setAdminStudentGroupMembers({
            data: { accessToken: session.access_token, groupId: group.id, studentIds },
          });
        }),
      );
      setStudentGroupsStudent(null);
      void load(false);
      toast.success("Группы ученика обновлены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить группы ученика");
    }
  }
  async function saveGroupEditor() {
    if (!session?.access_token || !editingGroup || !groupEditDraft.name.trim()) return;
    try {
      await saveAdminStudentGroup({
        data: {
          accessToken: session.access_token,
          id: editingGroup.id,
          name: groupEditDraft.name,
          description: groupEditDraft.description,
        },
      });
      await setAdminStudentGroupMembers({
        data: {
          accessToken: session.access_token,
          groupId: editingGroup.id,
          studentIds: groupEditDraft.studentIds,
        },
      });
      setEditingGroup(null);
      void load(false);
      toast.success("Группа обновлена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить группу");
    }
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
          <Button variant="outline" size="sm" onClick={() => setShowGroups((value) => !value)}>
            <span className="text-base">◎</span> Группы
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
          courseStarted={Boolean(
            form.userId && rows.find((row) => row.id === form.userId)?.currentDay,
          )}
        />
      )}
      {issued && (
        <CredentialsPanel
          item={issued}
          onCopy={() => void copyIssued()}
          onClose={() => setIssued(null)}
        />
      )}
      {loadError && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span>Не удалось получить список учеников. Проверь соединение и попробуй ещё раз.</span>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Повторить
          </Button>
        </div>
      )}
      {showGroups && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-wrap items-end gap-3">
            <label className="min-w-52 flex-1 space-y-1 text-sm font-medium">
              Название группы
              <input
                value={groupDraft.name}
                onChange={(event) =>
                  setGroupDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3"
                placeholder="QA Start, группа 1"
              />
            </label>
            <label className="min-w-52 flex-1 space-y-1 text-sm font-medium">
              Описание
              <input
                value={groupDraft.description}
                onChange={(event) =>
                  setGroupDraft((draft) => ({ ...draft, description: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
            <Button
              variant="hero"
              onClick={async () => {
                if (!session?.access_token || !groupDraft.name.trim()) return;
                await saveAdminStudentGroup({
                  data: {
                    accessToken: session.access_token,
                    name: groupDraft.name,
                    description: groupDraft.description,
                  },
                });
                setGroupDraft({ name: "", description: "" });
                void load(false);
              }}
            >
              Создать группу
            </Button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {groups.map((group) => (
              <div key={group.id} className="rounded-xl border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.description || "Без описания"} · {group.studentIds.length} учеников
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openGroupEditor(group)}>
                      Изменить
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={async () => {
                        if (
                          !session?.access_token ||
                          !window.confirm("Удалить группу? Ученики не будут удалены.")
                        )
                          return;
                        await deleteAdminStudentGroup({
                          data: { accessToken: session.access_token, id: group.id },
                        });
                        void load(false);
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex max-h-32 flex-wrap gap-1 overflow-auto">
                  {group.studentIds.length ? (
                    group.studentIds.map((studentId) => {
                      const row = rows.find((item) => item.id === studentId);
                      return (
                        <span
                          key={studentId}
                          className="rounded-full border border-primary bg-primary-soft px-2 py-1 text-xs text-primary"
                        >
                          {row?.full_name ?? row?.login ?? "Ученик"}
                        </span>
                      );
                    })
                  ) : (
                    <span className="text-xs text-muted-foreground">Группа пока пустая</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      <Dialog
        open={Boolean(studentGroupsStudent)}
        onOpenChange={(open) => !open && setStudentGroupsStudent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Группы ученика</DialogTitle>
            <DialogDescription>
              {studentGroupsStudent?.full_name ?? studentGroupsStudent?.login ?? "Ученик"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {groups.length ? (
              groups.map((group) => (
                <label
                  key={group.id}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={studentGroupSelection.includes(group.id)}
                    onChange={(event) =>
                      setStudentGroupSelection((current) =>
                        event.target.checked
                          ? [...current, group.id]
                          : current.filter((id) => id !== group.id),
                      )
                    }
                    className="h-4 w-4 accent-primary"
                  />
                  <span>{group.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {group.studentIds.length} уч.
                  </span>
                </label>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">Групп пока нет</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentGroupsStudent(null)}>
              Отмена
            </Button>
            <Button variant="hero" onClick={() => void saveStudentGroups()}>
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(selectedStudent)}
        onOpenChange={(open) => !open && setSelectedStudent(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto p-4 sm:p-6">
          <DialogHeader className="relative overflow-hidden rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-indigo-50 p-5 pr-12 text-left">
            <div className="absolute -right-5 -top-8 text-blue-100/80" aria-hidden="true">
              <BookOpen className="h-36 w-36 -rotate-12" strokeWidth={1.1} />
            </div>
            {selectedStudent && (
              <div className="relative flex items-center gap-4">
                <Avatar className="h-14 w-14 shrink-0 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-xl font-bold text-white shadow-lg shadow-blue-200">
                  {selectedStudent.avatar_url && (
                    <AvatarImage
                      src={selectedStudent.avatar_url}
                      alt={selectedStudent.full_name ?? selectedStudent.login}
                      className="rounded-2xl object-cover"
                    />
                  )}
                  <AvatarFallback className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">
                    {(selectedStudent.full_name ?? selectedStudent.login)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <DialogTitle className="truncate text-xl">
                    {selectedStudent.full_name ?? "Ученик"}
                  </DialogTitle>
                  <DialogDescription className="mt-1">
                    Профиль ученика · {selectedStudent.login}
                  </DialogDescription>
                </div>
              </div>
            )}
            {selectedStudent && <StudentStatusBadge row={selectedStudent} />}
          </DialogHeader>
          {selectedStudent && (
            <div className="grid gap-3 sm:grid-cols-2">
              <StudentDetail
                icon={UserRound}
                label="Логин"
                value={selectedStudent.login}
                tone="blue"
              />
              <StudentDetail
                icon={CalendarDays}
                label="Регистрация"
                value={formatCourseDateTime(selectedStudent.created_at)}
                tone="violet"
              />
              <StudentDetail
                icon={Rocket}
                label="Начало обучения"
                value={
                  selectedStudent.course_start_at
                    ? formatCourseDateTime(selectedStudent.course_start_at)
                    : "Не назначено"
                }
                tone="blue"
              />
              <StudentDetail
                icon={BookOpen}
                label="Текущий день / доступ"
                value={
                  selectedStudent.currentDay
                    ? `День ${selectedStudent.currentDay} · доступны уроки 1–${selectedStudent.currentAvailableLesson}`
                    : "Обучение ещё не началось"
                }
                tone="indigo"
              />
              <StudentDetail
                icon={UsersRound}
                label="Группа"
                value={
                  selectedStudent.groups.length
                    ? selectedStudent.groups.map((group) => group.name).join(", ")
                    : "Без группы"
                }
                tone="cyan"
              />
              <StudentDetail
                icon={Activity}
                label="Статус"
                value={
                  selectedStudent.blocked
                    ? "Заблокирован"
                    : selectedStudent.courseStatus === "completed"
                      ? "Завершил курс"
                      : selectedStudent.courseStatus === "in_progress"
                        ? "Обучается"
                        : selectedStudent.courseStatus === "upcoming"
                          ? "Ожидает старта"
                          : "Без даты старта"
                }
                tone={selectedStudent.blocked ? "rose" : "green"}
              />
              <StudentDetail
                icon={BookOpen}
                label="Прогресс уроков"
                value={`${selectedStudent.completed} из ${totalLessons} пройдено`}
                tone="indigo"
              />
              <StudentDetail
                icon={ClipboardList}
                label="Домашние задания"
                value={`${selectedStudent.homeworkCounts.submitted} отправлено · ${selectedStudent.homeworkCounts.notSubmitted} не отправлено · ${selectedStudent.homeworkCounts.assigned} всего`}
                tone="cyan"
              />
              <StudentDetail
                icon={Award}
                label="Сертификат"
                value={
                  !selectedStudent.certificate
                    ? "Не выдан"
                    : selectedStudent.certificate.revoked_at
                      ? "Аннулирован"
                      : "Действителен"
                }
                tone={
                  selectedStudent.certificate && !selectedStudent.certificate.revoked_at
                    ? "green"
                    : "amber"
                }
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedStudent(null)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(editingGroup)} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Редактирование группы</DialogTitle>
            <DialogDescription>Измените данные и состав группы.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium">
              Название группы
              <input
                value={groupEditDraft.name}
                onChange={(event) =>
                  setGroupEditDraft((draft) => ({ ...draft, name: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              Описание
              <input
                value={groupEditDraft.description}
                onChange={(event) =>
                  setGroupEditDraft((draft) => ({ ...draft, description: event.target.value }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3"
              />
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm font-medium">
                <span>Участники</span>
                <span className="text-primary">Участников: {groupEditDraft.studentIds.length}</span>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  value={groupSearch}
                  onChange={(event) => setGroupSearch(event.target.value)}
                  placeholder="Поиск по имени или логину"
                  className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm"
                />
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {rows
                  .filter((row) => {
                    const query = groupSearch.trim().toLowerCase();
                    return (
                      !query ||
                      (row.full_name ?? "").toLowerCase().includes(query) ||
                      row.login.toLowerCase().includes(query)
                    );
                  })
                  .map((row) => (
                    <label
                      key={row.id}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-muted/50"
                    >
                      <input
                        type="checkbox"
                        checked={groupEditDraft.studentIds.includes(row.id)}
                        onChange={(event) =>
                          setGroupEditDraft((draft) => ({
                            ...draft,
                            studentIds: event.target.checked
                              ? [...draft.studentIds, row.id]
                              : draft.studentIds.filter((id) => id !== row.id),
                          }))
                        }
                        className="h-4 w-4 accent-primary"
                      />
                      <span>{row.full_name ?? "Без имени"}</span>
                      <span className="ml-auto font-mono text-xs text-muted-foreground">
                        {row.login}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingGroup(null)}>
              Отмена
            </Button>
            <Button
              variant="hero"
              disabled={!groupEditDraft.name.trim()}
              onClick={() => void saveGroupEditor()}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">
          Группа{" "}
          <select
            value={groupFilter}
            onChange={(event) => setGroupFilter(event.target.value)}
            className="ml-2 h-9 rounded-md border border-input bg-background px-2"
          >
            <option value="all">Все группы</option>
            <option value="none">Без группы</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Ученик</th>
                <th className="px-4 py-3">Группа</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Прогресс</th>
                <th className="px-4 py-3">ДЗ</th>
                <th className="px-4 py-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .filter(
                  (row) =>
                    groupFilter === "all" ||
                    (groupFilter === "none"
                      ? row.groups.length === 0
                      : row.groups.some((group) => group.id === groupFilter)),
                )
                .map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedStudent(row)}
                        className="inline-flex max-w-64 items-center gap-2 text-left font-medium hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Подробная информация: ${row.full_name ?? row.login}`}
                      >
                        <Avatar className="h-7 w-7 bg-primary-soft text-primary">
                          {row.avatar_url && (
                            <AvatarImage src={row.avatar_url} alt="" className="object-cover" />
                          )}
                          <AvatarFallback className="bg-primary-soft text-primary">
                            {(row.full_name ?? "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="min-w-0">
                          <span className="block truncate">{row.full_name ?? "Без имени"}</span>
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {row.login}
                          </span>
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {row.groups.length ? (
                          row.groups.map((group) => (
                            <button
                              key={group.id}
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openStudentGroups(row);
                              }}
                              title="Изменить группы ученика"
                              className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary"
                            >
                              {group.name}
                            </button>
                          ))
                        ) : (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openStudentGroups(row);
                            }}
                            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          >
                            Без группы
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={row.blocked ? "text-destructive" : "text-primary"}>
                        {row.blocked
                          ? "Заблокирован"
                          : row.courseStatus === "completed"
                            ? "Завершил"
                            : row.courseStatus === "in_progress"
                              ? "Обучается"
                              : row.courseStatus === "upcoming"
                                ? "Ожидает старта"
                                : "Без даты старта"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.completed}/{totalLessons}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1 whitespace-nowrap"
                        title={`${row.homeworkCounts.submitted} отправлено, ${row.homeworkCounts.notSubmitted} не отправлено`}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                        {row.homeworkCounts.submitted}/{row.homeworkCounts.assigned} сдано
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StudentActions
                        row={row}
                        saving={saving || savingCertificateId === row.certificate?.id}
                        onEdit={() => {
                          const name = splitName(row.full_name);
                          setForm({
                            userId: row.id,
                            ...name,
                            login: row.login,
                            password: "",
                            courseStartDate: row.course_start_at
                              ? courseDate(row.course_start_at)
                              : "",
                          });
                        }}
                        onToggleBlocked={() => void toggleBlocked(row)}
                        onGrantQuizAttempt={() => void grantQuizAttempt(row)}
                        onDeleteStudent={() => void deleteStudent(row)}
                        onRevoke={() => row.certificate && void revokeCertificate(row.certificate)}
                        onRestore={() =>
                          row.certificate && void restoreCertificate(row.certificate)
                        }
                        onDelete={() => row.certificate && void deleteCertificate(row.certificate)}
                        onManageGroups={() => setShowGroups(true)}
                      />
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
function StudentDetail({
  icon: Icon,
  label,
  value,
  tone = "blue",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone?: "blue" | "violet" | "indigo" | "cyan" | "green" | "rose" | "amber";
}) {
  const tones = {
    blue: "bg-blue-100 text-blue-700",
    violet: "bg-violet-100 text-violet-700",
    indigo: "bg-indigo-100 text-indigo-700",
    cyan: "bg-cyan-100 text-cyan-700",
    green: "bg-emerald-100 text-emerald-700",
    rose: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-700",
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-xl border border-blue-100 bg-white p-3 shadow-sm transition-colors hover:border-blue-200 hover:bg-blue-50/40">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 break-words text-sm font-semibold text-foreground">{value}</div>
      </div>
    </div>
  );
}

function StudentStatusBadge({ row }: { row: Row }) {
  const { label, color } = row.blocked
    ? { label: "Заблокирован", color: "border-rose-200 bg-rose-50 text-rose-700" }
    : row.courseStatus === "completed"
      ? { label: "Курс завершён", color: "border-emerald-200 bg-emerald-50 text-emerald-700" }
      : row.courseStatus === "in_progress"
        ? { label: "Обучается", color: "border-blue-200 bg-blue-50 text-blue-700" }
        : row.courseStatus === "upcoming"
          ? { label: "Ожидает старта", color: "border-amber-200 bg-amber-50 text-amber-700" }
          : { label: "Без даты старта", color: "border-slate-200 bg-slate-50 text-slate-600" };

  return (
    <div
      className={`relative mt-4 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${color}`}
    >
      <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" />
      {label}
    </div>
  );
}
function StudentActions({
  row,
  saving,
  onEdit,
  onToggleBlocked,
  onGrantQuizAttempt,
  onDeleteStudent,
  onRevoke,
  onRestore,
  onDelete,
  onManageGroups,
}: {
  row: Row;
  saving: boolean;
  onEdit: () => void;
  onToggleBlocked: () => void;
  onGrantQuizAttempt: () => void;
  onDeleteStudent: () => void;
  onRevoke: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onManageGroups: () => void;
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
        <DropdownMenuItem onSelect={onManageGroups}>Управление группами</DropdownMenuItem>
        {row.canGrantQuizAttempt && (
          <DropdownMenuItem disabled={saving} onSelect={onGrantQuizAttempt}>
            <RotateCcw /> Добавить попытку теста
          </DropdownMenuItem>
        )}
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
  courseStarted,
}: {
  form: FormState;
  saving: boolean;
  onChange: (form: FormState) => void;
  onGenerate: () => void;
  onClose: () => void;
  onSave: () => void;
  onResetPassword?: () => void;
  courseStarted: boolean;
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
      <div className="mt-4 max-w-xs">
        <FormInput
          label="Дата начала обучения"
          type="date"
          value={form.courseStartDate}
          onChange={field("courseStartDate")}
          disabled={courseStarted}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          {courseStarted
            ? "После начала курса дату нельзя изменить обычным редактированием."
            : "Ученик может войти в кабинет до этой даты; первый урок откроется в 00:00 по времени курса."}
        </p>
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
  disabled?: boolean;
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

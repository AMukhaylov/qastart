/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Loader2, RefreshCw, Save, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { listAdminMeetings, updateAdminMeeting } from "@/server/meetings.functions";
import { listAdminStudentGroups } from "@/server/student-groups.functions";
import { listAdminStudentsAuth } from "@/server/students.functions";

export const Route = createFileRoute("/admin/meetings")({
  component: AdminMeetings,
});

type Meeting = Awaited<ReturnType<typeof listAdminMeetings>>[number];
type Group = Awaited<ReturnType<typeof listAdminStudentGroups>>[number];
type Student = { id: string; full_name: string | null; login: string };

function toDatetimeLocal(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fromDatetimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function formatMeetingDate(value: string | null) {
  if (!value) return "Дата не указана";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminMeetings() {
  const { session, isAdmin } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [students, setStudents] = useState<Student[]>([]);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const [data, groupData, studentData] = await Promise.all([
        listAdminMeetings({ data: { accessToken: session.access_token } }),
        listAdminStudentGroups({ data: { accessToken: session.access_token } }),
        listAdminStudentsAuth({ data: { accessToken: session.access_token } }),
      ]);
      const activeStudents = studentData.filter((student) => !student.banned_until);
      const activeStudentIds = new Set(activeStudents.map((student) => student.id));
      setMeetings(
        (data as Meeting[]).map((meeting) => ({
          ...meeting,
          studentLinks: (meeting.studentLinks ?? []).filter((link: any) =>
            activeStudentIds.has(link.student_id),
          ),
        })),
      );
      setGroups(groupData);
      setStudents(activeStudents);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить встречи");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  function update<K extends keyof Meeting>(id: string, key: K, value: Meeting[K]) {
    setMeetings((prev) =>
      prev.map((meeting) => (meeting.id === id ? { ...meeting, [key]: value } : meeting)),
    );
  }

  async function save(meeting: Meeting) {
    if (!session?.access_token) return;
    setSavingId(meeting.id);
    try {
      const updated = await updateAdminMeeting({
        data: {
          accessToken: session.access_token,
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          meetingUrl: meeting.meeting_url,
          startsAt: meeting.starts_at,
          isPublished: meeting.is_published,
          groupIds: (meeting.groupLinks ?? []).map((row: any) => row.group_id),
          studentIds: (meeting.studentLinks ?? []).map((row: any) => row.student_id),
        },
      });
      setMeetings((prev) =>
        prev.map((item) =>
          item.id === meeting.id
            ? { ...updated, groupLinks: meeting.groupLinks, studentLinks: meeting.studentLinks }
            : item,
        ),
      );
      toast.success("Встреча сохранена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить встречу");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Встречи</h1>
          <p className="mt-1 text-muted-foreground">
            Настрой две онлайн-встречи курса и открой ссылки ученикам, когда они будут готовы.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          Обновить
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {meetings.map((meeting) => (
            <section
              key={meeting.id}
              className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <Video className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Встреча {meeting.position}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {formatMeetingDate(meeting.starts_at)}
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={meeting.is_published}
                    onChange={(event) => update(meeting.id, "is_published", event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Показать
                </label>
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label>Название</Label>
                  <Input
                    value={meeting.title}
                    onChange={(event) => update(meeting.id, "title", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Дата и время</Label>
                  <Input
                    type="datetime-local"
                    value={toDatetimeLocal(meeting.starts_at)}
                    onChange={(event) =>
                      update(meeting.id, "starts_at", fromDatetimeLocal(event.target.value))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ссылка на встречу</Label>
                  <Input
                    placeholder="https://vk.com/call/..."
                    value={meeting.meeting_url}
                    onChange={(event) => update(meeting.id, "meeting_url", event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Описание для учеников</Label>
                  <Textarea
                    rows={4}
                    value={meeting.description}
                    onChange={(event) => update(meeting.id, "description", event.target.value)}
                  />
                </div>
                <div className="rounded-xl border border-border p-4">
                  <Label>Участники</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Можно выбрать группы и отдельных учеников. Состав группы для будущей встречи
                    остаётся динамическим.
                  </p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <label className="space-y-1 text-sm font-medium">
                      Группы
                      <select
                        multiple
                        value={(meeting.groupLinks ?? []).map((row: any) => row.group_id)}
                        onChange={(event) => {
                          const selected = Array.from(
                            event.currentTarget.selectedOptions,
                            (option) => option.value,
                          );
                          update(
                            meeting.id,
                            "groupLinks" as keyof Meeting,
                            selected.map((groupId) => ({
                              meeting_id: meeting.id,
                              group_id: groupId,
                            })) as any,
                          );
                        }}
                        className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm"
                      >
                        {groups.map((group) => (
                          <option key={group.id} value={group.id}>
                            {group.name} ({group.studentIds.length})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1 text-sm font-medium">
                      Отдельные ученики
                      <select
                        multiple
                        value={(meeting.studentLinks ?? []).map((row: any) => row.student_id)}
                        onChange={(event) => {
                          const selected = Array.from(
                            event.currentTarget.selectedOptions,
                            (option) => option.value,
                          );
                          update(
                            meeting.id,
                            "studentLinks" as keyof Meeting,
                            selected.map((studentId) => ({
                              meeting_id: meeting.id,
                              student_id: studentId,
                            })) as any,
                          );
                        }}
                        className="min-h-24 w-full rounded-md border border-input bg-background p-2 text-sm"
                      >
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.full_name ?? student.login} ({student.login})
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-primary">
                    Участников:{" "}
                    {
                      new Set([
                        ...(meeting.groupLinks ?? []).flatMap(
                          (row: any) =>
                            groups.find((group) => group.id === row.group_id)?.studentIds ?? [],
                        ),
                        ...(meeting.studentLinks ?? []).map((row: any) => row.student_id),
                      ]).size
                    }
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(meeting.groupLinks ?? []).map((row: any) => {
                      const group = groups.find((item) => item.id === row.group_id);
                      return group ? (
                        <span
                          key={group.id}
                          className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary"
                        >
                          Группа: {group.name}
                        </span>
                      ) : null;
                    })}
                    {(meeting.studentLinks ?? []).map((row: any) => {
                      const student = students.find((item) => item.id === row.student_id);
                      return student ? (
                        <span
                          key={student.id}
                          className="rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          Индивидуально: {student.full_name ?? student.login}
                        </span>
                      ) : null;
                    })}
                  </div>
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Показать итоговый список</summary>
                    <div className="mt-2 space-y-1">
                      {Array.from(
                        new Set([
                          ...(meeting.groupLinks ?? []).flatMap(
                            (row: any) =>
                              groups.find((group) => group.id === row.group_id)?.studentIds ?? [],
                          ),
                          ...(meeting.studentLinks ?? []).map((row: any) => row.student_id),
                        ]),
                      ).map((studentId) => {
                        const student = students.find((item) => item.id === studentId);
                        const sources = [
                          ...(meeting.groupLinks ?? []).flatMap((row: any) => {
                            const group = groups.find((item) => item.id === row.group_id);
                            return group?.studentIds.includes(studentId)
                              ? [`через группу «${group.name}»`]
                              : [];
                          }),
                          ...((meeting.studentLinks ?? []).some(
                            (row: any) => row.student_id === studentId,
                          )
                            ? ["индивидуально"]
                            : []),
                        ];
                        return (
                          <div key={studentId}>
                            {student?.full_name ?? student?.login ?? "Ученик"} —{" "}
                            {sources.join(", ")}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Button
                  variant="hero"
                  onClick={() => void save(meeting)}
                  disabled={Boolean(savingId)}
                >
                  {savingId === meeting.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить
                </Button>
                {meeting.meeting_url && (
                  <Button asChild variant="outline">
                    <a href={meeting.meeting_url} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4" /> Открыть ссылку
                    </a>
                  </Button>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-primary/15 bg-primary-soft/60 p-4 text-sm text-muted-foreground">
        <CalendarDays className="mr-2 inline h-4 w-4 text-primary" />
        Ученики увидят только встречи с включённым переключателем “Показать”.
      </div>
    </div>
  );
}

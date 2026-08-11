import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, ExternalLink, Loader2, Save, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { listAdminMeetings, updateAdminMeeting } from "@/server/meetings.functions";

export const Route = createFileRoute("/admin/meetings")({
  component: AdminMeetings,
});

type Meeting = Awaited<ReturnType<typeof listAdminMeetings>>[number];

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

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await listAdminMeetings({ data: { accessToken: session.access_token } });
      setMeetings(data as Meeting[]);
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
        },
      });
      setMeetings((prev) => prev.map((item) => (item.id === meeting.id ? updated : item)));
      toast.success("Встреча сохранена");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить встречу");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Встречи</h1>
        <p className="mt-1 text-muted-foreground">
          Настрой две онлайн-встречи курса и открой ссылки ученикам, когда они будут готовы.
        </p>
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

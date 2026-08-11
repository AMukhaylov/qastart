import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Ban, CalendarClock, Copy, KeyRound, Link2, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { createAdminInvite, listAdminInvites, revokeAdminInvite } from "@/server/invites.functions";

export const Route = createFileRoute("/admin/invites")({
  component: AdminInvites,
});

type Invite = Awaited<ReturnType<typeof listAdminInvites>>[number];

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

function formatDate(value: string | null) {
  if (!value) return "Без срока";
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function defaultExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return toDatetimeLocal(date.toISOString());
}

function inviteStatus(invite: Invite) {
  if (invite.status === "used" || invite.used_at) return { label: "Использована", tone: "muted" };
  if (invite.status === "revoked") return { label: "Отозвана", tone: "danger" };
  if (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now()) {
    return { label: "Истекла", tone: "danger" };
  }
  return { label: "Активна", tone: "success" };
}

function AdminInvites() {
  const { session, isAdmin } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [expiresAt, setExpiresAt] = useState(defaultExpiresAt);
  const [lastUrl, setLastUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const data = await listAdminInvites({ data: { accessToken: session.access_token } });
      setInvites(data as Invite[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить приглашения");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Ссылка скопирована");
  }

  async function createInvite(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const result = await createAdminInvite({
        data: {
          accessToken: session.access_token,
          email,
          expiresAt: fromDatetimeLocal(expiresAt),
          origin: window.location.origin,
        },
      });
      setLastUrl(result.inviteUrl);
      setEmail("");
      toast.success("Ссылка доступа создана");
      await copy(result.inviteUrl);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось создать ссылку");
    } finally {
      setSaving(false);
    }
  }

  async function revoke(invite: Invite) {
    if (!session?.access_token) return;
    const confirmed = window.confirm("Отозвать эту ссылку доступа?");
    if (!confirmed) return;
    setSaving(true);
    try {
      await revokeAdminInvite({
        data: { accessToken: session.access_token, inviteId: invite.id },
      });
      toast.success("Ссылка отозвана");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось отозвать ссылку");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">Доступы</h1>
          <p className="mt-1 text-muted-foreground">
            Создавай персональные ссылки для учеников после оплаты курса.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Обновить
        </Button>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
        <form onSubmit={createInvite} className="grid gap-4 lg:grid-cols-[1fr_240px_auto]">
          <label className="space-y-2">
            <Label>Email ученика</Label>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Можно оставить пустым"
            />
          </label>
          <label className="space-y-2">
            <Label>Срок действия</Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(event) => setExpiresAt(event.target.value)}
            />
          </label>
          <div className="flex items-end">
            <Button variant="hero" className="w-full" disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" />
              )}
              Создать
            </Button>
          </div>
        </form>
        {lastUrl && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary-soft/60 p-3 text-sm">
            <Link2 className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate">{lastUrl}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => void copy(lastUrl)}
              title="Скопировать ссылку"
              aria-label="Скопировать ссылку"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-soft)]">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <table className="w-full table-fixed text-sm">
            <thead className="bg-muted/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="w-[34%] px-4 py-3 text-left font-semibold">Email</th>
                <th className="w-[14%] px-4 py-3 text-left font-semibold">Статус</th>
                <th className="w-[20%] px-4 py-3 text-left font-semibold">Создана</th>
                <th className="w-[22%] px-4 py-3 text-left font-semibold">Действует до</th>
                <th className="w-[10%] px-4 py-3 text-left font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody>
              {invites.map((invite) => {
                const status = inviteStatus(invite);
                return (
                  <tr key={invite.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <div className="truncate font-medium">{invite.email || "Без привязки"}</div>
                      {invite.used_at && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          Использована: {formatDate(invite.used_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          status.tone === "success"
                            ? "bg-emerald-100 text-emerald-700"
                            : status.tone === "danger"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(invite.created_at)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" /> {formatDate(invite.expires_at)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        disabled={saving || status.label !== "Активна"}
                        onClick={() => void revoke(invite)}
                        title="Отозвать ссылку"
                        aria-label="Отозвать ссылку"
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {invites.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                    Ссылок доступа пока нет
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

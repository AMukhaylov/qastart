import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AVATAR_PRESETS, type AvatarPreset } from "@/lib/avatar-presets";
import { cn } from "@/lib/utils";
import { updatePresetAvatarForCurrentUser } from "@/server/profile.functions";

export const Route = createFileRoute("/profile")({ component: ProfilePage });
type Profile = { full_name: string | null; avatar_url: string | null; login: string };

function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);
  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);
  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name,avatar_url,login")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) toast.error("Не удалось загрузить профиль");
        else setProfile(data as Profile | null);
      });
  }, [user]);
  const [firstName, lastName] = useMemo(
    () => splitFullName(profile?.full_name ?? ""),
    [profile?.full_name],
  );
  const initial = (profile?.full_name ?? profile?.login ?? "?")[0]?.toUpperCase();
  async function selectAvatar(preset: AvatarPreset) {
    if (!user || profile?.avatar_url === preset.dataUrl) return;
    setAvatarSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Нужно войти заново");
      const result = await updatePresetAvatarForCurrentUser({
        data: { accessToken: session.access_token, presetId: preset.id },
      });
      setProfile((current) => (current ? { ...current, avatar_url: result.avatar_url } : current));
      toast.success("Аватар обновлён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить аватар");
    } finally {
      setAvatarSaving(false);
    }
  }
  if (loading || !user)
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка...
      </div>
    );
  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="border-b border-border bg-background">
        <div className="container-page flex h-16 items-center justify-between">
          <BrandLogo />
          <Button variant="ghost" size="sm" onClick={signOut}>
            Выйти
          </Button>
        </div>
      </header>
      <main className="container-page py-8">
        <Button asChild variant="ghost" className="mb-5 px-0">
          <Link to="/dashboard">
            <ArrowLeft className="h-4 w-4" /> Вернуться к урокам
          </Link>
        </Button>
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-32 w-32 border border-primary/10 bg-primary-soft shadow-[var(--shadow-soft)]">
                {profile?.avatar_url && (
                  <AvatarImage
                    src={profile.avatar_url}
                    alt={profile.full_name ?? "Аватар"}
                    className="object-cover"
                  />
                )}
                <AvatarFallback className="bg-primary-soft text-4xl font-bold text-primary">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight">Профиль</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Выберите готовый аватар для личного кабинета.
              </p>
              <div className="mt-5 grid grid-cols-5 gap-3">
                {AVATAR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => void selectAvatar(preset)}
                    disabled={avatarSaving}
                    className={cn(
                      "h-14 w-14 rounded-full border bg-background p-1 transition hover:-translate-y-0.5 hover:border-primary disabled:cursor-not-allowed disabled:opacity-70",
                      profile?.avatar_url === preset.dataUrl
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-border",
                    )}
                    title={preset.label}
                  >
                    <img
                      src={preset.dataUrl}
                      alt={preset.label}
                      className="h-full w-full rounded-full object-cover"
                    />
                  </button>
                ))}
              </div>
              {avatarSaving && (
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Сохраняем аватар...
                </div>
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
            <h2 className="font-display text-2xl font-extrabold tracking-tight">Данные аккаунта</h2>
            <p className="mt-2 text-muted-foreground">
              Данные для входа выдаёт администратор. Для смены пароля обратитесь к нему.
            </p>
            <dl className="mt-6 grid gap-5 sm:grid-cols-2">
              <DataRow label="Имя" value={firstName || "Не указано"} />
              <DataRow label="Фамилия" value={lastName || "Не указано"} />
              <DataRow label="Логин" value={profile?.login ?? "Загрузка..."} mono />
            </dl>
          </section>
        </div>
      </main>
    </div>
  );
}
function DataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={cn("mt-1 text-lg font-semibold", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}

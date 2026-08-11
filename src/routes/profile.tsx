import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, Save, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AVATAR_PRESETS, type AvatarPreset } from "@/lib/avatar-presets";
import { cn } from "@/lib/utils";
import { updatePresetAvatarForCurrentUser } from "@/server/profile.functions";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

type Profile = {
  full_name: string | null;
  avatar_url: string | null;
};

function ProfilePage() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, navigate, user]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    void (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        toast.error("Не удалось загрузить профиль");
        return;
      }

      setProfile((data ?? null) as Profile | null);
    })();
  }, [user]);

  const fullName =
    profile?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "";

  const [firstName, lastName] = useMemo(() => splitFullName(fullName), [fullName]);
  const initial = fullName[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || "?";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      toast.error("Введите корректный email");
      return;
    }

    if (newPassword || repeatPassword) {
      if (newPassword.length < 6) {
        toast.error("Пароль должен быть не короче 6 символов");
        return;
      }
      if (newPassword !== repeatPassword) {
        toast.error("Пароли не совпадают");
        return;
      }
    }

    setSaving(true);
    try {
      if (trimmedEmail !== user.email) {
        const { error } = await supabase.auth.updateUser({ email: trimmedEmail });
        if (error) throw error;
        toast.success("Письмо для подтверждения нового email отправлено");
      }

      if (newPassword) {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        setNewPassword("");
        setRepeatPassword("");
        toast.success("Пароль обновлён");
      }

      if (trimmedEmail === user.email && !newPassword) {
        toast.info("Изменений пока нет");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить изменения");
    } finally {
      setSaving(false);
    }
  }

  async function handlePresetAvatarSelect(preset: AvatarPreset) {
    if (!user || profile?.avatar_url === preset.dataUrl) return;

    setAvatarSaving(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError || !session?.access_token) {
        throw sessionError ?? new Error("Нужно войти заново");
      }

      const result = await updatePresetAvatarForCurrentUser({
        data: { accessToken: session.access_token, presetId: preset.id },
      });

      setProfile((current) => ({
        full_name: current?.full_name ?? profile?.full_name ?? null,
        avatar_url: result.avatar_url,
      }));
      toast.success("Аватар обновлён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось обновить аватар");
    } finally {
      setAvatarSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

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
                  <AvatarImage src={profile.avatar_url} alt={fullName} className="object-cover" />
                )}
                <AvatarFallback className="bg-primary-soft text-4xl font-bold text-primary">
                  {initial}
                </AvatarFallback>
              </Avatar>

              <h1 className="mt-5 font-display text-2xl font-extrabold tracking-tight">Профиль</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Выберите готовый аватар. Он будет отображаться в шапке.
              </p>

              <div className="mt-5 grid grid-cols-5 gap-3">
                {AVATAR_PRESETS.map((preset) => {
                  const selected = profile?.avatar_url === preset.dataUrl;

                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => void handlePresetAvatarSelect(preset)}
                      disabled={avatarSaving}
                      className={cn(
                        "h-14 w-14 rounded-full border bg-background p-1 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-[var(--shadow-card)] disabled:cursor-not-allowed disabled:opacity-70",
                        selected ? "border-primary ring-2 ring-primary/20" : "border-border",
                      )}
                      aria-label={`Выбрать ${preset.label}`}
                      title={preset.label}
                    >
                      <img
                        src={preset.dataUrl}
                        alt={preset.label}
                        className="h-full w-full rounded-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>

              {avatarSaving && (
                <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Сохраняем аватар...
                </div>
              )}
            </div>
          </section>

          <form
            onSubmit={handleSave}
            className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
          >
            <div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight">
                Данные аккаунта
              </h2>
              <p className="mt-2 text-muted-foreground">
                Имя и фамилия зафиксированы после регистрации. Здесь можно сменить email для входа и
                пароль.
              </p>
            </div>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <LockedField label="Имя" value={firstName} />
              <LockedField label="Фамилия" value={lastName} />
            </div>

            <div className="mt-5 space-y-2">
              <Label htmlFor="email">Email для входа</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="h-12 pl-10"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <PasswordField
                id="new-password"
                label="Новый пароль"
                value={newPassword}
                onChange={setNewPassword}
                show={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />
              <PasswordField
                id="repeat-password"
                label="Повторите пароль"
                value={repeatPassword}
                onChange={setRepeatPassword}
                show={showPassword}
                onToggle={() => setShowPassword((current) => !current)}
              />
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button type="submit" variant="hero" disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Сохранить
              </Button>
              <Button asChild type="button" variant="outline">
                <Link to="/dashboard">Отмена</Link>
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

function LockedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="relative">
        <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={value || "Не указано"} className="h-12 pl-10 pr-10" disabled readOnly />
        <Lock className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 pl-10 pr-11"
          autoComplete="new-password"
          placeholder="Оставьте пустым, если не меняете"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={show ? "Скрыть пароль" : "Показать пароль"}
          title={show ? "Скрыть пароль" : "Показать пароль"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts.slice(1).join(" ")];
}

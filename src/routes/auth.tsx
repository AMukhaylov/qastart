import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Eye, EyeOff, GraduationCap, Loader2, Lock, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { loginWithUsername } from "@/server/login.functions";

export const Route = createFileRoute("/auth")({ component: AuthPage });

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [loading, user, navigate]);
  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const session = await loginWithUsername({ data: { login, password } });
      const { error } = await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
      if (error) throw error;
      toast.success("С возвращением!");
      navigate({ to: "/dashboard" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось войти");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden overflow-hidden text-primary-foreground lg:flex"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div className="flex w-full flex-col justify-between p-12">
          <Link to="/" className="inline-flex w-fit items-center gap-2 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> На главную
          </Link>
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-bold">QA школа</div>
                <div className="text-sm opacity-80">Тестирование • Курс</div>
              </div>
            </div>
            <h1 className="text-4xl font-extrabold leading-tight xl:text-5xl">
              Разберись в QA за
              <br />
              14 дней
            </h1>
            <p className="mt-4 max-w-md text-lg opacity-90">
              Видеоуроки, домашние задания, обратная связь наставника и сертификат после завершения.
            </p>
          </div>
          <div className="text-sm opacity-70">© {new Date().getFullYear()} QA школа</div>
        </div>
      </div>
      <main className="flex items-center justify-center p-6 md:p-12">
        <form onSubmit={handleLogin} className="w-full max-w-md space-y-5">
          <Link
            to="/"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground lg:hidden"
          >
            <ArrowLeft className="h-4 w-4" /> На главную
          </Link>
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">С возвращением</h1>
            <p className="mt-2 text-muted-foreground">
              Войди в личный кабинет по данным от администратора.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="login">Логин</Label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="login"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                className="h-12 pl-10"
                autoComplete="username"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Пароль</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 pl-10 pr-11"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-label="Показать пароль"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <Button type="submit" variant="hero" size="xl" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Войти
          </Button>
        </form>
      </main>
    </div>
  );
}

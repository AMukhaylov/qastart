import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Provider } from "@supabase/supabase-js";
import { z } from "zod";
import { toast } from "sonner";
import { GraduationCap, Mail, Lock, ArrowLeft, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Некорректный email").max(255);
const passwordSchema = z.string().min(6, "Минимум 6 символов").max(72);
const nameSchema = z.string().trim().min(2, "Минимум 2 символа").max(80);
const vkAuthProvider = (import.meta.env.VITE_SUPABASE_VK_PROVIDER || "custom:vk") as Provider;

function AuthPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      nameSchema.parse(fullName);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + "/dashboard",
        data: { full_name: fullName.trim() },
      },
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Добро пожаловать в QA школу!");
    navigate({ to: "/dashboard" });
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) return toast.error(getLoginErrorMessage(error));
    toast.success("С возвращением!");
    navigate({ to: "/dashboard" });
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    try {
      emailSchema.parse(email);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
    }
    setSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/reset-password",
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Письмо для сброса отправлено");
    setMode("login");
  }

  async function handleVk() {
    setSubmitting(true);
    const redirectUrl = new URL("/auth/callback", window.location.origin);
    redirectUrl.searchParams.set("next", "/dashboard");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: vkAuthProvider,
      options: {
        redirectTo: redirectUrl.toString(),
      },
    });
    if (error) {
      toast.error(
        mode === "signup" ? "Не удалось зарегистрироваться через VK" : "Не удалось войти через VK",
      );
    }
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div
        className="hidden lg:flex relative overflow-hidden text-primary-foreground"
        style={{ background: "var(--gradient-hero)" }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)",
            backgroundSize: "40px 40px, 60px 60px",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium opacity-90 hover:opacity-100 w-fit"
          >
            <ArrowLeft className="h-4 w-4" /> На главную
          </Link>
          <div>
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-md">
                <GraduationCap className="h-6 w-6" />
              </div>
              <div>
                <div className="text-xl font-bold">QA школа</div>
                <div className="text-sm opacity-80">Тестирование • Курс</div>
              </div>
            </div>
            <h2 className="text-4xl xl:text-5xl font-extrabold leading-tight tracking-tight">
              Разберись в QA за <br />
              14 дней
            </h2>
            <p className="mt-4 text-lg opacity-90 max-w-md">
              Видеоуроки, домашние задания, обратная связь наставника и сертификат после завершения.
            </p>
          </div>
          <div className="text-sm opacity-70">© {new Date().getFullYear()} QA школа</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="lg:hidden inline-flex items-center gap-2 text-sm text-muted-foreground mb-6"
          >
            <ArrowLeft className="h-4 w-4" /> Назад
          </Link>

          {mode === "reset" ? (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Восстановление</h1>
                <p className="mt-2 text-muted-foreground">
                  Введите email — мы пришлём ссылку для сброса.
                </p>
              </div>
              <Field
                id="email"
                label="Email"
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="you@example.com"
              />
              <Button
                type="submit"
                variant="hero"
                size="xl"
                className="w-full"
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Отправить
              </Button>
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-sm text-primary hover:underline"
              >
                ← Вернуться ко входу
              </button>
            </form>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold tracking-tight">
                {mode === "login" ? "С возвращением" : "Добро пожаловать"}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {mode === "login" ? "Войди в личный кабинет" : "Создай аккаунт и начни обучение"}
              </p>

              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as "login" | "signup")}
                className="mt-6"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="login">Вход</TabsTrigger>
                  <TabsTrigger value="signup">Регистрация</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <Field
                      id="login-email"
                      label="Email"
                      icon={Mail}
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@example.com"
                    />
                    <Field
                      id="login-password"
                      label="Пароль"
                      icon={Lock}
                      type="password"
                      value={password}
                      onChange={setPassword}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setMode("reset")}
                      className="text-sm text-primary hover:underline"
                    >
                      Забыли пароль?
                    </button>
                    <Button
                      type="submit"
                      variant="hero"
                      size="xl"
                      className="w-full"
                      disabled={submitting}
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Войти
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <Field
                      id="signup-name"
                      label="Имя"
                      value={fullName}
                      onChange={setFullName}
                      placeholder="Как к вам обращаться"
                    />
                    <Field
                      id="signup-email"
                      label="Email"
                      icon={Mail}
                      type="email"
                      value={email}
                      onChange={setEmail}
                      placeholder="you@example.com"
                    />
                    <Field
                      id="signup-password"
                      label="Пароль"
                      icon={Lock}
                      type="password"
                      value={password}
                      onChange={setPassword}
                      placeholder="Минимум 6 символов"
                    />
                    <Button
                      type="submit"
                      variant="hero"
                      size="xl"
                      className="w-full"
                      disabled={submitting}
                    >
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Создать аккаунт
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> или{" "}
                <div className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                size="xl"
                className="w-full"
                onClick={handleVk}
                disabled={submitting}
              >
                <VkIcon /> {mode === "signup" ? "Зарегистрироваться через VK" : "Войти через VK"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function getLoginErrorMessage(error: { message?: string; status?: number }) {
  const message = error.message ?? "";
  if (/invalid login credentials/i.test(message)) return "Неверный email или пароль";
  if (/email not confirmed/i.test(message)) return "Подтвердите email перед входом";
  if (error.status && error.status >= 500) {
    return "Сервис авторизации временно недоступен. Попробуйте ещё раз через пару минут.";
  }
  if (/failed to fetch|network|fetch/i.test(message)) {
    return "Не удалось подключиться к сервису авторизации. Попробуйте ещё раз.";
  }

  return message || "Не удалось войти";
}

function Field({
  id,
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  placeholder,
  disabled = false,
}: {
  id: string;
  label: string;
  icon?: typeof Mail;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword && showPassword ? "text" : type;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        )}
        <Input
          id={id}
          type={inputType}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={`h-12 ${Icon ? "pl-10" : ""} ${isPassword ? "pr-11" : ""}`}
          required
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((current) => !current)}
            className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            title={showPassword ? "Скрыть пароль" : "Показать пароль"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

function VkIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#0077FF" />
      <path
        fill="#fff"
        d="M12.66 17.25c-5.13 0-8.05-3.52-8.17-9.38h2.57c.08 4.3 1.98 6.12 3.48 6.5v-6.5h2.42v3.71c1.48-.16 3.04-1.86 3.57-3.71h2.42a7.15 7.15 0 0 1-3.29 4.67 7.4 7.4 0 0 1 3.86 4.71h-2.66c-.58-1.77-2-3.14-3.9-3.33v3.33h-.3Z"
      />
    </svg>
  );
}

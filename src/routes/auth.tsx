import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { GraduationCap, Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

const emailSchema = z.string().trim().email("Некорректный email").max(255);
const passwordSchema = z.string().min(6, "Минимум 6 символов").max(72);
const nameSchema = z.string().trim().min(2, "Минимум 2 символа").max(80);

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
        data: { full_name: fullName },
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
    if (error) return toast.error("Неверный email или пароль");
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

  async function handleGoogle() {
    setSubmitting(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      setSubmitting(false);
      toast.error("Не удалось войти через Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard" });
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left visual */}
      <div className="hidden lg:flex relative overflow-hidden text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px, 60px 60px" }} />
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium opacity-90 hover:opacity-100 w-fit">
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
              Войди в IT за <br />14 дней
            </h2>
            <p className="mt-4 text-lg opacity-90 max-w-md">
              Личное наставничество, реальные задачи и сертификат после прохождения.
            </p>
          </div>
          <div className="text-sm opacity-70">© {new Date().getFullYear()} QA школа</div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Link>

          {mode === "reset" ? (
            <form onSubmit={handleReset} className="space-y-5">
              <div>
                <h1 className="text-3xl font-extrabold tracking-tight">Восстановление</h1>
                <p className="mt-2 text-muted-foreground">Введите email — мы пришлём ссылку для сброса.</p>
              </div>
              <Field id="email" label="Email" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <Button type="submit" variant="hero" size="xl" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Отправить
              </Button>
              <button type="button" onClick={() => setMode("login")} className="text-sm text-primary hover:underline">
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

              <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")} className="mt-6">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="login">Вход</TabsTrigger>
                  <TabsTrigger value="signup">Регистрация</TabsTrigger>
                </TabsList>

                <TabsContent value="login" className="mt-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    <Field id="login-email" label="Email" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                    <Field id="login-password" label="Пароль" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                    <button type="button" onClick={() => setMode("reset")} className="text-sm text-primary hover:underline">
                      Забыли пароль?
                    </button>
                    <Button type="submit" variant="hero" size="xl" className="w-full" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Войти
                    </Button>
                  </form>
                </TabsContent>

                <TabsContent value="signup" className="mt-6">
                  <form onSubmit={handleSignup} className="space-y-4">
                    <Field id="signup-name" label="Имя" value={fullName} onChange={setFullName} placeholder="Как к вам обращаться" />
                    <Field id="signup-email" label="Email" icon={Mail} type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                    <Field id="signup-password" label="Пароль" icon={Lock} type="password" value={password} onChange={setPassword} placeholder="Минимум 6 символов" />
                    <Button type="submit" variant="hero" size="xl" className="w-full" disabled={submitting}>
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Создать аккаунт
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" /> или <div className="h-px flex-1 bg-border" />
              </div>

              <Button type="button" variant="outline" size="xl" className="w-full" onClick={handleGoogle} disabled={submitting}>
                <GoogleIcon /> Продолжить через Google
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  id, label, icon: Icon, type = "text", value, onChange, placeholder,
}: {
  id: string; label: string; icon?: typeof Mail; type?: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`h-12 ${Icon ? "pl-10" : ""}`}
          required
        />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}

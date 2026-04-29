import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ShieldCheck, Mail, Lock, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { fetchUserRoles } from "@/lib/auth-roles";

export const Route = createFileRoute("/admin/login")({
  component: AdminLoginPage,
});

const emailSchema = z.string().trim().email("Некорректный email").max(255);
const passwordSchema = z.string().min(6, "Минимум 6 символов").max(72);

function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, isAdmin, loading, rolesLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (user && isAdmin) navigate({ to: "/admin/homework" });
  }, [user, isAdmin, loading, rolesLoading, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) return toast.error(err.issues[0].message);
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setSubmitting(false);
      return toast.error("Неверный email или пароль");
    }

    let hasAdmin = false;
    try {
      const roles = await fetchUserRoles(data.user.id, 5, data.session?.access_token);
      hasAdmin = roles.includes("admin");
    } catch {
      setSubmitting(false);
      return toast.error("Не удалось проверить права администратора. Попробуйте ещё раз через несколько секунд");
    }

    setSubmitting(false);

    if (!hasAdmin) {
      await supabase.auth.signOut();
      return toast.error("Доступ запрещён: эта учётная запись не имеет прав администратора");
    }

    toast.success("Добро пожаловать в админ-панель");
    navigate({ to: "/admin/homework" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--gradient-soft)]">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> На главную
        </Link>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight">Админ-панель</h1>
              <p className="text-sm text-muted-foreground">Вход только для наставников</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="h-12 pl-10"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Пароль</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-12 pl-10"
                  required
                />
              </div>
            </div>
            <Button type="submit" variant="hero" size="xl" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Войти в админку
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-border text-center text-sm text-muted-foreground">
            Студентам сюда:{" "}
            <Link to="/auth" className="text-primary hover:underline font-medium">
              вход для учеников
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
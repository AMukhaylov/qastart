import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, ClipboardCheck, BookOpen, Users, ArrowLeft, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/auth" });
    else if (!isAdmin) navigate({ to: "/dashboard" });
  }, [user, isAdmin, loading, navigate]);

  if (loading || !user || !isAdmin) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Загрузка…</div>;
  }

  const tabs = [
    { to: "/admin/homework", label: "Проверка ДЗ", icon: ClipboardCheck },
    { to: "/admin/lessons", label: "Уроки", icon: BookOpen },
    { to: "/admin/students", label: "Студенты", icon: Users },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="border-b border-border bg-background sticky top-0 z-30">
        <div className="container-page h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <div className="font-display font-bold flex items-center gap-1.5">QA школа <ShieldCheck className="h-4 w-4 text-primary" /></div>
              <div className="text-[11px] text-muted-foreground">Админ-панель</div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard"><ArrowLeft className="h-4 w-4" /> В кабинет</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>Выйти</Button>
          </div>
        </div>
        <div className="container-page flex gap-1 overflow-x-auto pb-px">
          {tabs.map((t) => {
            const active = location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
                  active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </div>
      </header>

      <main className="container-page py-8">
        <Outlet />
      </main>
    </div>
  );
}

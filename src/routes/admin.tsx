import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ClipboardCheck, BookOpen, Users, ArrowLeft, CalendarDays } from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { AdminDiagnosticsPanel } from "@/components/admin-diagnostics-panel";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading, rolesLoading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [login, setLogin] = useState<string | null>(null);

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (location.pathname === "/admin/login") return;
    if (!user || !isAdmin) navigate({ to: "/admin/login" });
  }, [user, isAdmin, loading, rolesLoading, location.pathname, navigate]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    void supabase
      .from("profiles")
      .select("login")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setLogin(data?.login ?? null));
  }, [user, isAdmin]);

  if (location.pathname === "/admin/login") {
    return <Outlet />;
  }

  if (loading || (rolesLoading && !isAdmin)) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Переходим ко входу…
      </div>
    );
  }

  const tabs = [
    { to: "/admin/homework", label: "Проверка ДЗ", icon: ClipboardCheck },
    { to: "/admin/lessons", label: "Уроки", icon: BookOpen },
    { to: "/admin/meetings", label: "Встречи", icon: CalendarDays },
    { to: "/admin/students", label: "Студенты", icon: Users },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)]">
      <header className="border-b border-border bg-background sticky top-0 z-30">
        <div className="container-page h-16 flex items-center justify-between gap-4">
          <BrandLogo subtitle="Админ-панель" admin />
          <div className="flex items-center gap-2">
            {login && (
              <span className="hidden text-sm text-muted-foreground md:inline">Логин: {login}</span>
            )}
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" /> В кабинет
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Выйти
            </Button>
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
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
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
      <AdminDiagnosticsPanel />
    </div>
  );
}

import { createFileRoute, Link, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import {
  ClipboardCheck,
  BookOpen,
  Users,
  ArrowLeft,
  CalendarDays,
  ChartNoAxesCombined,
  Bot,
} from "lucide-react";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { AdminDiagnosticsPanel } from "@/components/admin-diagnostics-panel";
import { NotificationBell } from "@/components/notification-bell";

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading, rolesLoading, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (location.pathname === "/admin/login") return;
    if (!user || !isAdmin) navigate({ to: "/admin/login" });
  }, [user, isAdmin, loading, rolesLoading, location.pathname, navigate]);

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
    { to: "/admin/analytics", label: "Аналитика", icon: ChartNoAxesCombined },
    { to: "/admin/archie", label: "Арчи", icon: Bot },
  ] as const;

  return (
    <div className="min-h-screen bg-[var(--gradient-soft)] [--admin-header-height:7rem]">
      <header className="border-b border-border bg-background sticky top-0 z-30">
        <div className="container-page h-16 flex items-center justify-between gap-4">
          <BrandLogo subtitle="Админ-панель" admin />
          <div className="flex items-center gap-2">
            <NotificationBell />
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
        <div className="container-page flex h-12 gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = location.pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`flex h-12 items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm font-medium transition-colors ${
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

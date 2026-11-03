import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin/")({
  component: AdminIndexRedirect,
});

function AdminIndexRedirect() {
  const { user, loading, rolesLoading, isAdmin } = useAuth();

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Проверяем доступ…
      </div>
    );
  }

  const destination = user && isAdmin ? "/admin/homework" : "/admin/login";
  const label = destination === "/admin/login" ? "Открыть страницу входа" : "Открыть проверку ДЗ";

  return (
    <>
      <Navigate to={destination} replace />
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <a className="text-primary underline" href={destination}>
          {label}
        </a>
      </div>
    </>
  );
}

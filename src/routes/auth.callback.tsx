import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let redirected = false;

    const params = new URLSearchParams(window.location.search);
    const nextPath = getSafeNextPath(params.get("next"));
    const cleanupUrl = () => window.history.replaceState(null, "", "/auth/callback");
    const redirectToNext = () => {
      if (redirected) return;
      redirected = true;
      cleanupUrl();
      window.location.replace(nextPath);
    };

    async function completeOAuth() {
      const authError = params.get("error_description") ?? params.get("error");
      const code = params.get("code");

      if (authError) {
        if (active) setError("VK не подтвердил вход. Попробуй ещё раз.");
        return;
      }

      try {
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        }

        const session = await waitForSession();
        if (!session) throw new Error("Сессия не найдена");

        redirectToNext();
      } catch {
        if (active) setError("Не удалось завершить вход через VK. Попробуй ещё раз.");
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active && session) redirectToNext();
    });

    void completeOAuth();

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
        {error ? (
          <>
            <h1 className="text-2xl font-extrabold tracking-tight">Вход не завершён</h1>
            <p className="mt-3 text-muted-foreground">{error}</p>
            <Button asChild variant="hero" className="mt-6">
              <Link to="/auth">Вернуться ко входу</Link>
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Завершаем вход</h1>
            <p className="mt-3 text-muted-foreground">Сейчас откроем личный кабинет.</p>
          </>
        )}
      </div>
    </div>
  );
}

async function waitForSession() {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (data.session) return data.session;
    await new Promise((resolve) => window.setTimeout(resolve, 250));
  }

  return null;
}

function getSafeNextPath(value: string | null) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

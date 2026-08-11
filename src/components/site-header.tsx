import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export function SiteHeader() {
  const { user, signOut, isAdmin } = useAuth();
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name,avatar_url")
        .eq("id", user.id)
        .maybeSingle();

      setProfile((data ?? null) as { full_name: string | null; avatar_url: string | null } | null);
    })();
  }, [user]);

  const displayName =
    profile?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string | undefined)?.trim() ||
    user?.email?.split("@")[0] ||
    "Ученик";
  const initial = displayName[0]?.toUpperCase() || "У";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <BrandLogo />

        {!user && (
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#how" className="hover:text-foreground transition-colors">
              Что внутри
            </a>
            <a href="#program" className="hover:text-foreground transition-colors">
              Маршрут обучения
            </a>
          </nav>
        )}

        <div className="flex items-center gap-2">
          {user ? (
            <>
              {isAdmin && (
                <Button asChild variant="ghost" size="sm">
                  <Link to="/admin">
                    <ShieldCheck className="h-4 w-4" /> Админка
                  </Link>
                </Button>
              )}
              <Link
                to="/profile"
                aria-label="Открыть личный профиль"
                title="Открыть личный профиль"
                className="inline-flex rounded-full transition hover:ring-4 hover:ring-primary/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              >
                <Avatar className="h-9 w-9 cursor-pointer border border-primary/10 bg-primary-soft">
                  {profile?.avatar_url && (
                    <AvatarImage
                      src={profile.avatar_url}
                      alt={displayName}
                      className="object-cover"
                    />
                  )}
                  <AvatarFallback className="bg-primary-soft text-sm font-semibold text-primary">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </Link>
              <Button variant="ghost" size="sm" onClick={signOut}>
                Выйти
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}

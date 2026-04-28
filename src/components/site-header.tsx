import { Link } from "@tanstack/react-router";
import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

export function SiteHeader() {
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="container-page flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)] transition-transform group-hover:scale-105">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-bold tracking-tight">QA школа</div>
            <div className="text-[11px] text-muted-foreground">Тестирование • Курс</div>
          </div>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#how" className="hover:text-foreground transition-colors">Как проходит обучение</a>
          <a href="#program" className="hover:text-foreground transition-colors">Программа</a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Button asChild variant="soft" size="sm">
                <Link to="/dashboard">Кабинет</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut}>Выйти</Button>
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Войти</Link>
              </Button>
              <Button asChild variant="hero" size="sm">
                <Link to="/auth">Начать обучение</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
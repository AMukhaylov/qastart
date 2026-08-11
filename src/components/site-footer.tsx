import { Link } from "@tanstack/react-router";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container-page py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} QA школа. Все права защищены.</div>
        <div className="flex items-center gap-6">
          <Link to="/privacy" className="hover:text-foreground transition-colors">
            Политика
          </Link>
          <Link to="/offer" className="hover:text-foreground transition-colors">
            Оферта
          </Link>
          <Link to="/contacts" className="hover:text-foreground transition-colors">
            Контакты
          </Link>
        </div>
      </div>
    </footer>
  );
}

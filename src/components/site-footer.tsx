export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="container-page py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <div>© {new Date().getFullYear()} QA школа. Все права защищены.</div>
        <div className="flex items-center gap-6">
          <a href="#" className="hover:text-foreground transition-colors">Политика</a>
          <a href="#" className="hover:text-foreground transition-colors">Оферта</a>
          <a href="#" className="hover:text-foreground transition-colors">Контакты</a>
        </div>
      </div>
    </footer>
  );
}
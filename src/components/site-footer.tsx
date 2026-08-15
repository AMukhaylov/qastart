import { Link } from "@tanstack/react-router";
import { FaVk } from "react-icons/fa6";

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
          <a
            href="https://vk.ru/qa_school"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="QA Start в VK"
            title="QA Start в VK"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border text-[#0077ff] transition-colors hover:border-[#0077ff]/30 hover:bg-[#0077ff]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0077ff]/30"
          >
            <FaVk className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}

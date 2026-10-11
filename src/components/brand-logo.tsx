import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export function BrandLogo({
  subtitle = "Тестирование • Курс",
  admin = false,
  className,
}: {
  subtitle?: string;
  admin?: boolean;
  className?: string;
}) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)}>
      <img
        src="/favicon.png?v=8"
        alt="Логотип QA START"
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 transition-transform group-hover:scale-105"
      />
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 font-display text-base font-extrabold tracking-tight text-foreground">
          QA школа {admin && <ShieldCheck className="h-4 w-4 text-primary" />}
        </div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  );
}

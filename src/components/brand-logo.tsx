import { Link } from "@tanstack/react-router";
import { GraduationCap, ShieldCheck } from "lucide-react";
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
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-[var(--shadow-glow)] transition-transform group-hover:scale-105">
        <GraduationCap className="h-5 w-5" />
      </div>
      <div className="leading-tight">
        <div className="flex items-center gap-1.5 font-display text-base font-extrabold tracking-tight text-foreground">
          QA школа {admin && <ShieldCheck className="h-4 w-4 text-primary" />}
        </div>
        <div className="mt-0.5 text-xs font-medium text-muted-foreground">{subtitle}</div>
      </div>
    </Link>
  );
}

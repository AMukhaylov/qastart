import type { ReactNode } from "react";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export function LegalPage({ eyebrow, title, description, children }: LegalPageProps) {
  return (
    <main className="min-h-[calc(100vh-9rem)] bg-background">
      <section className="container-page py-16 md:py-20">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <div className="mb-3 text-sm font-semibold uppercase text-primary">{eyebrow}</div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-foreground md:text-5xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-muted-foreground">{description}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-sm md:p-8">
            <div className="space-y-8 text-base leading-7 text-muted-foreground">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="[&_a]:text-primary [&_a]:underline-offset-4 hover:[&_a]:underline">
      <h2 className="mb-2 font-display text-xl font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

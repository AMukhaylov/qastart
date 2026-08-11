import { createFileRoute } from "@tanstack/react-router";
import { Mail, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage
        eyebrow="Связь"
        title="Контакты"
        description="Куда писать по доступу, обучению и техническим вопросам."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">Поддержка</h2>
            <p className="mt-2 text-muted-foreground">
              По вопросам входа, оплаты, домашних заданий и доступа к урокам.
            </p>
            <a
              href="mailto:arthurcloud@yandex.ru"
              className="mt-4 inline-flex font-medium text-primary hover:text-primary/80"
            >
              arthurcloud@yandex.ru
            </a>
          </div>
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">Документы</h2>
            <p className="mt-2 text-muted-foreground">
              Вопросы по политике конфиденциальности, оферте и обработке данных.
            </p>
            <a
              href="mailto:arthurcloud@yandex.ru"
              className="mt-4 inline-flex font-medium text-primary hover:text-primary/80"
            >
              Написать по документам
            </a>
          </div>
        </div>
      </LegalPage>
      <SiteFooter />
    </>
  );
}

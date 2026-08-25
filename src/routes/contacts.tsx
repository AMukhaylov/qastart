import { createFileRoute } from "@tanstack/react-router";
import { Mail, MessageCircle, ShieldCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LegalPage } from "@/components/legal-page";

export const Route = createFileRoute("/contacts")({
  component: ContactsPage,
});

function ContactsPage() {
  const supportEmail = "qastart.school@yandex.ru";
  const vkGroupUrl = "https://vk.ru/qa_school";

  return (
    <>
      <SiteHeader />
      <LegalPage
        eyebrow="Связь"
        title="Контакты"
        description="Куда писать по доступу, обучению и техническим вопросам."
      >
        <div className="grid gap-4 md:grid-cols-2 md:items-stretch">
          <div className="flex flex-col rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">Поддержка</h2>
            <p className="mt-2 text-muted-foreground">
              По вопросам входа, оплаты, домашних заданий и доступа к урокам. Исполнитель:
              самозанятый Мухайлов Артур Рашитович, ИНН 595703525241.
            </p>
            <div className="mt-auto pt-6">
              <a
                href={vkGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <MessageCircle className="h-4 w-4" />
                Написать в VK
              </a>
            </div>
          </div>
          <div className="flex flex-col rounded-lg border border-border bg-card p-6">
            <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">Документы</h2>
            <p className="mt-2 text-muted-foreground">
              Вопросы по политике конфиденциальности, оферте, возвратам и обработке данных.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Для заявлений и претензий:{" "}
              <a
                className="font-medium text-primary hover:text-primary/80"
                href={`mailto:${supportEmail}`}
              >
                {supportEmail}
              </a>
              .
            </p>
            <div className="mt-auto pt-6">
              <a
                href={vkGroupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                <MessageCircle className="h-4 w-4" />
                Написать в VK по документам
              </a>
            </div>
          </div>
        </div>
      </LegalPage>
      <SiteFooter />
    </>
  );
}

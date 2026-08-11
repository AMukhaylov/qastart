import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Award, Printer, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { verifyCertificate } from "@/server/certificates.functions";

export const Route = createFileRoute("/certificates/$code")({
  component: CertificatePage,
});

type Certificate = Awaited<ReturnType<typeof verifyCertificate>>;

function CertificatePage() {
  const { code } = Route.useParams();
  const [certificate, setCertificate] = useState<Certificate>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const result = await verifyCertificate({ data: { code } });
        if (!cancelled) setCertificate(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [code]);

  return (
    <>
      <style>{`
        .certificate-sheet {
          font-family:
            "SF Pro Display",
            "SF Pro Text",
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            Arial,
            sans-serif;
        }
        @media print {
          .certificate-sheet {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .certificate-brand-mark {
            background: #351cff !important;
            color: #ffffff !important;
            border-color: #351cff !important;
          }
          .certificate-watermark {
            display: block !important;
            color: rgba(53, 28, 255, 0.11) !important;
          }
          @page {
            margin: 12mm;
          }
        }
      `}</style>
      <div className="print:hidden">
        <SiteHeader />
      </div>
      <main className="container-page py-10 print:py-0">
        {loading ? (
          <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
            Проверяем сертификат...
          </div>
        ) : certificate ? (
          <div className="mx-auto max-w-5xl space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
              <Button asChild variant="ghost" className="px-0">
                <Link to="/dashboard">
                  <ArrowLeft className="h-4 w-4" /> В кабинет
                </Link>
              </Button>
              <Button variant="hero" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Скачать / распечатать PDF
              </Button>
            </div>

            {certificate.revoked_at && (
              <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4 text-sm text-destructive print:hidden">
                Этот сертификат аннулирован{" "}
                {new Date(certificate.revoked_at).toLocaleDateString("ru-RU")}. Он больше не
                подтверждает прохождение курса.
              </div>
            )}

            <section
              className={`certificate-sheet relative overflow-hidden rounded-[28px] border bg-white shadow-[0_28px_80px_rgba(49,35,255,0.18)] print:rounded-none print:border print:shadow-none ${
                certificate.revoked_at
                  ? "border-destructive/35 print:border-destructive/30"
                  : "border-primary/25 print:border-primary/20"
              }`}
            >
              <div
                className={
                  certificate.revoked_at
                    ? "h-3 bg-[linear-gradient(90deg,#ef4444_0%,#f97316_50%,#64748b_100%)]"
                    : "h-3 bg-[linear-gradient(90deg,#351cff_0%,#04befe_42%,#10b981_70%,#f59e0b_100%)]"
                }
              />
              <div className="absolute inset-x-0 top-3 h-28 bg-[linear-gradient(180deg,rgba(53,28,255,0.10),rgba(255,255,255,0))]" />
              <div className="certificate-watermark absolute right-8 top-20 hidden text-primary/10 md:block print:right-12 print:top-24">
                <Award className="h-44 w-44" />
              </div>

              <div className="relative p-7 md:p-11 print:p-8">
                <div className="mb-12 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-center print:mb-10 print:grid-cols-[1fr_auto] print:items-center">
                  <div className="flex min-h-20 items-center gap-4">
                    <div className="certificate-brand-mark flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary bg-primary text-primary-foreground shadow-[0_16px_35px_rgba(53,28,255,0.28)] print:shadow-none">
                      <Award className="h-7 w-7" />
                    </div>
                    <div>
                      <div className="text-xl font-semibold tracking-tight text-foreground">
                        QA школа
                      </div>
                      <div className="mt-1 text-base text-muted-foreground">
                        Цифровой сертификат
                      </div>
                    </div>
                  </div>
                  <div className="flex min-h-20 w-full flex-col justify-center rounded-2xl border border-primary/15 bg-primary-soft px-5 py-4 text-primary sm:w-[290px] print:w-[265px] print:bg-white print:px-5 print:py-3">
                    <div className="text-xs font-semibold uppercase tracking-wide">Номер</div>
                    <div className="mt-1 text-xl font-semibold leading-tight tracking-tight print:text-lg">
                      {certificate.certificate_number}
                    </div>
                  </div>
                </div>

                <div className="max-w-4xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                    Настоящим подтверждается, что
                  </p>
                  <h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-tight text-foreground md:text-6xl print:text-5xl">
                    {certificate.student_name}
                  </h1>
                  <p className="mt-6 text-xl leading-relaxed text-muted-foreground md:text-2xl print:text-xl">
                    успешно завершил(а) 2-недельный интерактивный курс
                  </p>
                  <h2 className="mt-2 max-w-4xl text-4xl font-semibold leading-tight tracking-tight text-primary md:text-5xl print:text-4xl">
                    {certificate.course_title}
                  </h2>
                </div>

                <div className="mt-12 grid gap-4 rounded-2xl border border-border bg-slate-50 p-5 sm:grid-cols-2 print:bg-white">
                  <InfoItem
                    label="Дата выдачи"
                    value={new Date(certificate.issued_at).toLocaleDateString("ru-RU")}
                  />
                  <InfoItem
                    label="Статус"
                    value={
                      certificate.revoked_at
                        ? `Аннулирован ${new Date(certificate.revoked_at).toLocaleDateString("ru-RU")}`
                        : "Действителен"
                    }
                  />
                </div>

                <div
                  className={`mt-8 flex items-center gap-2 rounded-2xl border p-4 text-sm print:bg-white ${
                    certificate.revoked_at
                      ? "border-destructive/20 bg-destructive/10 text-destructive"
                      : "border-primary/15 bg-primary-soft/60 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      className={`h-4 w-4 ${certificate.revoked_at ? "text-destructive" : "text-primary"}`}
                    />
                    {certificate.revoked_at
                      ? "Проверка подлинности: сертификат аннулирован."
                      : `Проверка подлинности: startqa.ru/certificates/${certificate.verification_code}`}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <h1 className="mt-5 font-display text-3xl font-extrabold">Сертификат не найден</h1>
            <p className="mt-2 text-muted-foreground">
              Проверь ссылку или запроси её заново в личном кабинете.
            </p>
            <Button asChild className="mt-6" variant="hero">
              <Link to="/">На главную</Link>
            </Button>
          </div>
        )}
      </main>
      <div className="print:hidden">
        <SiteFooter />
      </div>
    </>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tracking-tight">{value}</div>
    </div>
  );
}

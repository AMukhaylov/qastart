import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ShieldCheck, UserRoundCheck } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitCourseApplication } from "@/server/applications.functions";

export const Route = createFileRoute("/apply")({ component: ApplyPage });

function ApplyPage() {
  const [name, setName] = useState("");
  const [contactType, setContactType] = useState<"telegram" | "vk">("telegram");
  const [contact, setContact] = useState("");
  const [consent, setConsent] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [utm, setUtm] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtm({
      utmSource: params.get("utm_source") ?? "",
      utmMedium: params.get("utm_medium") ?? "",
      utmCampaign: params.get("utm_campaign") ?? "",
      utmTerm: params.get("utm_term") ?? "",
      utmContent: params.get("utm_content") ?? "",
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await submitCourseApplication({
        data: {
          name,
          contactType,
          contact,
          consent,
          website: honeypot,
          utmSource: utm.utmSource,
          utmMedium: utm.utmMedium,
          utmCampaign: utm.utmCampaign,
          utmTerm: utm.utmTerm,
          utmContent: utm.utmContent,
        },
      });
      setSubmitted(true);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Не удалось отправить заявку. Попробуй ещё раз позже.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showPublicNavigation={false} />
      <main>
        <section className="relative isolate overflow-hidden border-b border-border bg-[var(--gradient-accent)]">
          <div className="absolute -right-24 -top-28 -z-10 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
          <div className="container-page grid gap-10 py-12 sm:py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-14 lg:py-20">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-background/80 px-3 py-1.5 text-sm font-medium text-primary shadow-sm">
                <ShieldCheck className="h-4 w-4" /> Поток 0 · бесплатно
              </span>
              <h1 className="mt-6 max-w-2xl text-4xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
                Попробуй профессию тестировщика бесплатно
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
                За 14 дней познакомишься с основами QA, попробуешь себя на практике и поймёшь,
                подходит ли тебе это направление.
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <UserRoundCheck className="h-4 w-4 text-primary" /> Без телефона и без
                автоматического создания аккаунта
              </div>
            </div>

            <section
              aria-labelledby="application-title"
              className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] sm:p-7"
            >
              {submitted ? (
                <div className="flex min-h-72 flex-col items-start justify-center" role="status">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <h2 id="application-title" className="mt-5 text-2xl font-bold">
                    Заявка принята!
                  </h2>
                  <p className="mt-3 text-muted-foreground">
                    Я лично свяжусь с тобой и расскажу о начале обучения.
                  </p>
                </div>
              ) : (
                <>
                  <h2 id="application-title" className="text-2xl font-bold tracking-tight">
                    Запишись на Поток 0
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Оставь имя и удобный контакт — телефон не нужен.
                  </p>
                  <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                    <div
                      className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
                      aria-hidden="true"
                    >
                      <label htmlFor="application-website">Сайт</label>
                      <input
                        id="application-website"
                        name="website"
                        type="text"
                        tabIndex={-1}
                        autoComplete="off"
                        value={honeypot}
                        onChange={(event) => setHoneypot(event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="application-name" className="text-sm font-semibold">
                        Как тебя зовут?
                      </label>
                      <Input
                        id="application-name"
                        autoComplete="name"
                        maxLength={80}
                        required
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="Имя"
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
                      <div className="space-y-2">
                        <label htmlFor="application-contact-type" className="text-sm font-semibold">
                          Где написать?
                        </label>
                        <select
                          id="application-contact-type"
                          value={contactType}
                          onChange={(event) =>
                            setContactType(event.target.value as "telegram" | "vk")
                          }
                          className="h-12 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <option value="telegram">Telegram</option>
                          <option value="vk">ВКонтакте</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="application-contact" className="text-sm font-semibold">
                          Имя пользователя или ссылка
                        </label>
                        <Input
                          id="application-contact"
                          autoComplete="off"
                          maxLength={160}
                          required
                          value={contact}
                          onChange={(event) => setContact(event.target.value)}
                          placeholder={contactType === "telegram" ? "@username" : "vk.com/username"}
                          className="h-12 rounded-xl"
                        />
                      </div>
                    </div>
                    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/40 p-3 text-sm leading-relaxed">
                      <input
                        type="checkbox"
                        required
                        checked={consent}
                        onChange={(event) => setConsent(event.target.checked)}
                        className="mt-1 h-4 w-4 shrink-0 accent-primary"
                      />
                      <span>
                        Соглашаюсь на обработку персональных данных в соответствии с{" "}
                        <Link
                          to="/privacy"
                          className="font-medium text-primary underline underline-offset-2"
                        >
                          политикой конфиденциальности
                        </Link>
                        .
                      </span>
                    </label>
                    {error && (
                      <p
                        className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
                        role="alert"
                      >
                        {error}
                      </p>
                    )}
                    <Button
                      type="submit"
                      variant="hero"
                      size="xl"
                      disabled={submitting}
                      className="w-full"
                    >
                      {submitting ? "Отправляем…" : "Записаться бесплатно"}
                      {!submitting && <ArrowRight className="h-4 w-4" />}
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      Никаких звонков и спама — только сообщение по поводу обучения.
                    </p>
                  </form>
                </>
              )}
            </section>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Страница не найдена</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Такой страницы нет или она была перенесена.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            На главную
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "QA Start — интерактивный курс по тестированию для начинающих" },
      {
        name: "description",
        content:
          "QA Start — 14 интерактивных уроков по основам тестирования: практика, домашние задания, поддержка наставника и итоговый сертификат.",
      },
      { name: "author", content: "QA школа" },
      { name: "app-version", content: "v0.4.1" },
      {
        property: "og:title",
        content: "QA Start — интерактивный курс по тестированию для начинающих",
      },
      {
        property: "og:description",
        content:
          "14 уроков, практика, домашние задания, поддержка наставника и итоговый сертификат.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://startqa.ru/" },
      { property: "og:site_name", content: "QA Start" },
      { name: "twitter:card", content: "summary" },
      {
        name: "twitter:title",
        content: "QA Start — интерактивный курс по тестированию для начинающих",
      },
      {
        name: "twitter:description",
        content:
          "14 уроков, практика, домашние задания, поддержка наставника и итоговый сертификат.",
      },
    ],
    links: [
      {
        rel: "icon",
        href: "/favicon.svg?v=3",
        type: "image/svg+xml",
      },
      {
        rel: "shortcut icon",
        href: "/favicon.svg?v=3",
        type: "image/svg+xml",
      },
      {
        rel: "canonical",
        href: "https://startqa.ru/",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <AuthProvider>
      <Outlet />
      <Toaster richColors position="top-center" />
    </AuthProvider>
  );
}

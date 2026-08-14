import { createFileRoute } from "@tanstack/react-router";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <LegalPage
        eyebrow="Документы"
        title="Политика конфиденциальности"
        description="Как QA школа обрабатывает данные пользователей курса."
      >
        <LegalSection title="Какие данные мы получаем">
          <p>
            Мы обрабатываем данные, необходимые для обучения: имя, фамилию, логин, пароль в
            защищённом виде, ответы на домашние задания, комментарии, прикреплённые файлы и
            технические данные, необходимые для работы личного кабинета. Доступ ученику создаёт
            администратор.
          </p>
        </LegalSection>
        <LegalSection title="Для чего используются данные">
          <p>
            Данные нужны для доступа к курсу, проверки домашних заданий, обратной связи от
            наставника, восстановления доступа через администратора, технической поддержки и
            улучшения работы сервиса.
          </p>
        </LegalSection>
        <LegalSection title="Хранение и защита">
          <p>
            Авторизация, учебные данные и файлы хранятся в Supabase. Доступ к административным
            разделам ограничен ролями. Файлы домашних заданий хранятся в приватном хранилище и
            выдаются через временные ссылки.
          </p>
        </LegalSection>
        <LegalSection title="Передача третьим лицам">
          <p>
            Мы не продаём персональные данные. Данные могут обрабатываться техническими
            поставщиками, которые обеспечивают работу сайта, базы данных, авторизации и файлового
            хранилища.
          </p>
        </LegalSection>
        <LegalSection title="Запросы пользователя">
          <p>
            Пользователь может запросить уточнение, исправление или удаление данных через email
            поддержки: <a href="mailto:arthurcloud@yandex.ru">arthurcloud@yandex.ru</a>.
          </p>
        </LegalSection>
      </LegalPage>
      <SiteFooter />
    </>
  );
}

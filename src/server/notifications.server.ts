import { supabaseAdmin } from "@/integrations/supabase/client.server";
import webpush from "web-push";

type NotificationType =
  | "homework_approved"
  | "homework_rework"
  | "homework_mentor_comment"
  | "homework_submitted"
  | "homework_resubmitted";

type NotificationInput = {
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string;
  eventKey: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export async function createNotification(input: NotificationInput) {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .upsert(
      {
        recipient_user_id: input.recipientUserId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        metadata: input.metadata ?? {},
        event_key: input.eventKey,
      },
      { onConflict: "event_key", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw error;
  if (!data?.length) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:support@startqa.ru",
    publicKey,
    privateKey,
  );
  const { data: subscriptions } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", input.recipientUserId);
  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: input.title,
            body: input.body,
            link: input.link,
            metadata: input.metadata ?? {},
          }),
        );
      } catch (error) {
        if ([404, 410].includes((error as { statusCode?: number }).statusCode ?? 0)) {
          await supabaseAdmin.from("web_push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }),
  );
}

type HomeworkContext = { submissionId: string; userId: string; lessonId: string };

async function getHomeworkContext(context: HomeworkContext) {
  const [{ data: lesson, error: lessonError }, { data: profile, error: profileError }] =
    await Promise.all([
      supabaseAdmin.from("lessons").select("day_number,title").eq("id", context.lessonId).single(),
      supabaseAdmin.from("profiles").select("full_name").eq("id", context.userId).maybeSingle(),
    ]);
  if (lessonError || !lesson) throw lessonError ?? new Error("Урок не найден");
  if (profileError) throw profileError;
  return { lesson, studentName: profile?.full_name?.trim() || "Ученик" };
}

export async function notifyStudentHomeworkStatus(
  context: HomeworkContext,
  status: "approved" | "rejected",
) {
  const { lesson } = await getHomeworkContext(context);
  const approved = status === "approved";
  await createNotification({
    recipientUserId: context.userId,
    type: approved ? "homework_approved" : "homework_rework",
    title: approved ? "Домашнее задание принято" : "Домашнее задание на доработке",
    body: approved
      ? `День ${lesson.day_number}: «${lesson.title}». Наставник принял вашу работу.`
      : `День ${lesson.day_number}: «${lesson.title}». Откройте урок и посмотрите комментарий наставника.`,
    link: `/lessons/${lesson.day_number}?focus=homework`,
    eventKey: `homework:${context.submissionId}:${approved ? "approved" : "rework"}`,
    metadata: {
      targetType: "homework_submission",
      targetId: context.submissionId,
      lessonDay: lesson.day_number,
      lessonId: context.lessonId,
      studentId: context.userId,
    },
  });
}

export async function notifyAdminsHomeworkSubmitted(
  context: HomeworkContext,
  resubmitted: boolean,
) {
  const [{ lesson, studentName }, { data: admins, error }] = await Promise.all([
    getHomeworkContext(context),
    supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin"),
  ]);
  if (error) throw error;
  await Promise.all(
    (admins ?? []).map((admin) =>
      createNotification({
        recipientUserId: admin.user_id,
        type: resubmitted ? "homework_resubmitted" : "homework_submitted",
        title: resubmitted ? "ДЗ отправлено повторно" : "Новое домашнее задание",
        body: `${studentName} · День ${lesson.day_number}: «${lesson.title}». ${
          resubmitted ? "Работа отправлена после доработки." : "Работа ждёт проверки."
        }`,
        link: `/admin/homework?submission=${context.submissionId}`,
        eventKey: `homework:${context.submissionId}:${resubmitted ? "resubmitted" : "submitted"}:admin:${admin.user_id}`,
        metadata: {
          targetType: "homework_submission",
          targetId: context.submissionId,
          lessonDay: lesson.day_number,
          lessonId: context.lessonId,
          studentId: context.userId,
          studentName,
        },
      }),
    ),
  );
}

export async function notifyStudentMentorComment(context: HomeworkContext, messageId: string) {
  const { lesson } = await getHomeworkContext(context);
  await createNotification({
    recipientUserId: context.userId,
    type: "homework_mentor_comment",
    title: "Новый комментарий наставника",
    body: `День ${lesson.day_number}: «${lesson.title}». Наставник оставил комментарий к домашнему заданию.`,
    link: `/lessons/${lesson.day_number}?focus=homework`,
    eventKey: `homework:${context.submissionId}:mentor-comment:${messageId}`,
    metadata: {
      targetType: "homework_submission",
      targetId: context.submissionId,
      lessonDay: lesson.day_number,
      lessonId: context.lessonId,
      studentId: context.userId,
    },
  });
}

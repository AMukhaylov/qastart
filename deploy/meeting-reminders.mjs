import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

const REMINDER_MINUTES = [60, 15];
const REMINDER_CATCH_UP_MS = 12 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;
const NETWORK_RETRY_DELAYS_MS = [1_000, 2_500];

let schedulerStarted = false;
let checkInProgress = false;
let vapidConfigured = false;

export function getDueMeetingReminders(startsAt, now = Date.now()) {
  const startsAtMs = Date.parse(startsAt);
  if (!Number.isFinite(startsAtMs)) return [];

  return REMINDER_MINUTES.filter((minutes) => {
    const untilStart = startsAtMs - now;
    const reminderAt = minutes * 60 * 1000;
    return untilStart <= reminderAt && untilStart > reminderAt - REMINDER_CATCH_UP_MS;
  });
}

function formatMoscowStart(startsAt) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(startsAt));
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server environment is incomplete");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:support@startqa.ru",
      publicKey,
      privateKey,
    );
    vapidConfigured = true;
  }
  return true;
}

async function sendPushForNotification(client, userId, notification) {
  if (!configureWebPush()) return;
  const { data: subscriptions, error } = await client
    .from("web_push_subscriptions")
    .select("id,endpoint,p256dh,auth")
    .eq("user_id", userId);
  if (error) throw error;

  await Promise.all(
    (subscriptions ?? []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: notification.title,
            body: notification.body,
            link: notification.link,
            tag: notification.event_key,
          }),
        );
      } catch (error) {
        const statusCode = error?.statusCode;
        if ([404, 410].includes(statusCode)) {
          await client.from("web_push_subscriptions").delete().eq("id", subscription.id);
        } else {
          console.error("Meeting reminder push delivery failed", statusCode ?? "unknown");
        }
      }
    }),
  );
}

async function getActiveStudentIds(client) {
  const [{ data: roles, error: rolesError }, { data: users, error: usersError }] =
    await Promise.all([
      client.from("user_roles").select("user_id,role").in("role", ["student", "admin"]),
      client.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
  if (rolesError) throw rolesError;
  if (usersError) throw usersError;

  const adminIds = new Set(
    (roles ?? []).filter((row) => row.role === "admin").map((row) => row.user_id),
  );
  const activeUserIds = new Set(
    (users.users ?? []).filter((user) => !user.banned_until).map((user) => user.id),
  );
  return new Set(
    (roles ?? [])
      .filter(
        (row) =>
          row.role === "student" && !adminIds.has(row.user_id) && activeUserIds.has(row.user_id),
      )
      .map((row) => row.user_id),
  );
}

async function getMeetingRecipients(client, meetingId, activeStudentIds) {
  const [{ data: groups, error: groupsError }, { data: directStudents, error: directError }] =
    await Promise.all([
      client.from("meeting_groups").select("group_id").eq("meeting_id", meetingId),
      client.from("meeting_students").select("student_id").eq("meeting_id", meetingId),
    ]);
  if (groupsError) throw groupsError;
  if (directError) throw directError;

  const groupIds = (groups ?? []).map((row) => row.group_id);
  const directIds = (directStudents ?? []).map((row) => row.student_id);
  if (!groupIds.length && !directIds.length) return [...activeStudentIds];

  const { data: memberships, error } = groupIds.length
    ? await client.from("group_students").select("student_id").in("group_id", groupIds)
    : { data: [], error: null };
  if (error) throw error;

  return [...new Set([...(memberships ?? []).map((row) => row.student_id), ...directIds])].filter(
    (id) => activeStudentIds.has(id),
  );
}

async function sendReminder(client, meeting, studentId, minutes) {
  const notification = {
    recipient_user_id: studentId,
    type: "meeting_reminder",
    title: minutes === 60 ? "Встреча начнётся через час" : "Встреча начнётся через 15 минут",
    body: `${meeting.title}. ${formatMoscowStart(meeting.starts_at)} по Москве.`,
    link: "/dashboard",
    metadata: { targetType: "meeting", targetId: meeting.id, reminderMinutes: minutes },
    event_key: `meeting:${meeting.id}:reminder:${minutes}:${studentId}`,
  };

  const { data, error } = await client
    .from("notifications")
    .upsert(notification, { onConflict: "event_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  if (data?.length) await sendPushForNotification(client, studentId, notification);
}

export async function runMeetingReminderCheck(now = new Date()) {
  const client = getAdminClient();
  const from = new Date(now.getTime() - REMINDER_CATCH_UP_MS).toISOString();
  const to = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const { data: meetings, error } = await client
    .from("course_meetings")
    .select("id,title,starts_at")
    .eq("is_published", true)
    .not("starts_at", "is", null)
    .gte("starts_at", from)
    .lte("starts_at", to);
  if (error) throw error;
  if (!meetings?.length) return 0;

  const activeStudentIds = await getActiveStudentIds(client);
  let delivered = 0;
  for (const meeting of meetings) {
    const dueReminders = getDueMeetingReminders(meeting.starts_at, now.getTime());
    if (!dueReminders.length) continue;
    const recipients = await getMeetingRecipients(client, meeting.id, activeStudentIds);
    for (const minutes of dueReminders) {
      for (const studentId of recipients) {
        await sendReminder(client, meeting, studentId, minutes);
        delivered += 1;
      }
    }
  }
  return delivered;
}

function isTransientNetworkError(error) {
  return error instanceof TypeError && error.message === "fetch failed";
}

async function runMeetingReminderCheckWithRetry() {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await runMeetingReminderCheck();
    } catch (error) {
      const retryDelay = NETWORK_RETRY_DELAYS_MS[attempt];
      if (!retryDelay || !isTransientNetworkError(error)) throw error;
      console.warn(`Meeting reminder network request failed; retrying (${attempt + 1}/2)`);
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }
}

export function startMeetingReminderScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  const check = async () => {
    if (checkInProgress) return;
    checkInProgress = true;
    try {
      const count = await runMeetingReminderCheckWithRetry();
      if (count) console.log(`Meeting reminder notifications processed: ${count}`);
    } catch (error) {
      console.error("Meeting reminder scheduler check failed", error?.message ?? error);
    } finally {
      checkInProgress = false;
    }
  };
  void check();
  setInterval(check, CHECK_INTERVAL_MS);
}

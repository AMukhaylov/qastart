import { createServerFn } from "@tanstack/react-start";
import { assertLessonScheduleAccess } from "./course-schedule.server";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";
import {
  notifyAdminsHomeworkSubmitted,
  notifyStudentHomeworkStatus,
  notifyStudentMentorComment,
} from "./notifications.server";

const HOMEWORK_ATTACHMENTS_BUCKET = "homework-attachments";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const attachmentSchema = z.object({
  name: z.string().min(1).max(180),
  type: z.string().max(120),
  size: z.number().int().min(0).max(1_500_000),
  dataUrl: z.string().startsWith("data:").max(2_100_000),
});

const submitHomeworkInput = z.object({
  accessToken: z.string().min(20),
  lessonId: z.string().uuid(),
  submissionId: z.string().uuid().optional(),
  content: z.string().trim().min(1).max(20_000),
  attachments: z.array(attachmentSchema).max(3).default([]),
});

const listMessagesInput = z.object({
  accessToken: z.string().min(20),
  submissionId: z.string().uuid(),
});

const adminHomeworkListInput = z.object({
  accessToken: z.string().min(20),
  status: z.enum(["pending", "approved", "rejected", "awaiting_mentor"]),
  submissionId: z.string().uuid().optional(),
});

const reviewHomeworkInput = z.object({
  accessToken: z.string().min(20),
  submissionId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  feedback: z.string().trim().max(20_000).default(""),
  attachments: z.array(attachmentSchema).max(3).default([]),
});

const answerHomeworkInput = z.object({
  accessToken: z.string().min(20),
  submissionId: z.string().uuid(),
  feedback: z.string().trim().min(1).max(20_000),
  attachments: z.array(attachmentSchema).max(3).default([]),
});

const editHomeworkMessageInput = z.object({
  accessToken: z.string().min(20),
  messageId: z.string().uuid(),
  body: z.string().trim().min(1).max(20_000),
});

const askHomeworkQuestionInput = z.object({
  accessToken: z.string().min(20),
  submissionId: z.string().uuid(),
  question: z.string().trim().min(1).max(20_000),
  attachments: z.array(attachmentSchema).max(3).default([]),
});

function isMissingMessagesTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const maybeError = error as { code?: string; message?: string };
  return (
    maybeError.code === "42P01" ||
    maybeError.code === "PGRST205" ||
    maybeError.message?.includes("homework_messages")
  );
}

type IncomingAttachment = z.infer<typeof attachmentSchema>;

async function awaitHomeworkRead<T>(query: {
  abortSignal: (signal: AbortSignal) => PromiseLike<T>;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    return await query.abortSignal(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

type StoredAttachment = {
  name: string;
  type: string;
  size: number;
  path?: string;
  dataUrl?: string;
  url?: string;
};

function safeFileName(fileName: string) {
  return (
    fileName
      .normalize("NFKD")
      .replace(/[^\w.-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 120) || "file"
  );
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) throw new Error("Некорректный формат файла");

  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  return isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");
}

async function persistAttachments(
  submissionId: string,
  attachments: IncomingAttachment[],
): Promise<StoredAttachment[]> {
  if (attachments.length === 0) return [];

  const saved: StoredAttachment[] = [];
  for (const attachment of attachments) {
    const buffer = decodeDataUrl(attachment.dataUrl);
    if (buffer.byteLength > 1_500_000) throw new Error(`Файл «${attachment.name}» больше 1.5 МБ`);

    const path = `${submissionId}/${Date.now()}-${randomUUID()}-${safeFileName(attachment.name)}`;
    const { error } = await supabaseAdmin.storage
      .from(HOMEWORK_ATTACHMENTS_BUCKET)
      .upload(path, buffer, {
        contentType: attachment.type || "application/octet-stream",
        upsert: false,
      });

    if (error) throw error;

    saved.push({
      name: attachment.name,
      type: attachment.type || "application/octet-stream",
      size: attachment.size,
      path,
    });
  }

  return saved;
}

async function hydrateAttachmentUrls(attachments: unknown): Promise<StoredAttachment[]> {
  if (!Array.isArray(attachments)) return [];

  return Promise.all(
    attachments.map(async (attachment) => {
      const file = attachment as StoredAttachment;
      if (!file.path) return file;

      const { data, error } = await supabaseAdmin.storage
        .from(HOMEWORK_ATTACHMENTS_BUCKET)
        .createSignedUrl(file.path, SIGNED_URL_TTL_SECONDS);

      return {
        ...file,
        url: error ? undefined : data.signedUrl,
      };
    }),
  );
}

export const submitHomeworkForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator((data) => submitHomeworkInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const [lessonResult, progressResult, blockResult, latestResult] = await Promise.all([
      supabaseAdmin
        .from("lessons")
        .select("id,day_number,homework_md")
        .eq("id", data.lessonId)
        .maybeSingle(),
      supabaseAdmin
        .from("lesson_progress")
        .select("completed,completed_at")
        .eq("user_id", userId)
        .eq("lesson_id", data.lessonId)
        .maybeSingle(),
      supabaseAdmin
        .from("lesson_blocks")
        .select("id")
        .eq("lesson_id", data.lessonId)
        .eq("block_type", "homework")
        .limit(1),
      supabaseAdmin
        .from("homework_submissions")
        .select("id,status")
        .eq("user_id", userId)
        .eq("lesson_id", data.lessonId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    for (const error of [
      lessonResult.error,
      progressResult.error,
      blockResult.error,
      latestResult.error,
    ]) {
      if (error) throw error;
    }
    const lesson = lessonResult.data;
    if (!lesson) throw new Error("Урок не найден");
    await assertLessonScheduleAccess(userId, lesson.day_number);
    if (!progressResult.data?.completed || !progressResult.data.completed_at) {
      throw new Error("Сначала завершите урок, затем отправьте домашнее задание");
    }
    if (!lesson.homework_md.trim() && !blockResult.data?.length) {
      throw new Error("В этом уроке нет домашнего задания");
    }
    if (
      latestResult.data &&
      (latestResult.data.status !== "rejected" || latestResult.data.id !== data.submissionId)
    ) {
      throw new Error("Домашнее задание уже отправлено");
    }
    if (!latestResult.data && data.submissionId) throw new Error("Отправка ДЗ не найдена");

    const submissionPayload = {
      content: data.content.trim(),
      status: "pending" as const,
      feedback: null,
      reviewed_by: null,
      reviewed_at: null,
    };

    const query = data.submissionId
      ? supabaseAdmin
          .from("homework_submissions")
          .update(submissionPayload)
          .eq("id", data.submissionId)
          .eq("user_id", userId)
          .eq("lesson_id", data.lessonId)
          .eq("status", "rejected")
          .select("id,user_id,content,status,feedback,created_at,reviewed_at,reviewed_by")
          .single()
      : supabaseAdmin
          .from("homework_submissions")
          .insert({
            user_id: userId,
            lesson_id: data.lessonId,
            ...submissionPayload,
          })
          .select("id,user_id,content,status,feedback,created_at,reviewed_at,reviewed_by")
          .single();

    const { data: submission, error } = await query;

    if (error || !submission) {
      throw error ?? new Error("Не удалось отправить ДЗ");
    }

    const savedAttachments = await persistAttachments(submission.id, data.attachments);

    const { error: messageError } = await supabaseAdmin.from("homework_messages").insert({
      submission_id: submission.id,
      author_id: userId,
      author_role: "student",
      body: data.content.trim(),
      attachments: savedAttachments,
    });

    if (messageError && !isMissingMessagesTable(messageError)) throw messageError;

    await notifyAdminsHomeworkSubmitted(
      { submissionId: submission.id, userId, lessonId: data.lessonId },
      Boolean(data.submissionId),
    );

    return submission;
  });

export const listHomeworkMessages = createServerFn({ method: "POST" })
  .inputValidator((data) => listMessagesInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);

    const { data: submission, error: submissionError } = await supabaseAdmin
      .from("homework_submissions")
      .select("user_id")
      .eq("id", data.submissionId)
      .single();

    if (submissionError || !submission) {
      throw submissionError ?? new Error("Домашнее задание не найдено");
    }

    if (submission.user_id !== userId) {
      const roles = await getRolesForAccessToken(data.accessToken, 2);
      if (!roles.includes("admin")) throw new Error("Недостаточно прав");
    }

    const { data: messages, error } = await supabaseAdmin
      .from("homework_messages")
      .select("id,author_id,author_role,body,attachments,created_at")
      .eq("submission_id", data.submissionId)
      .order("created_at", { ascending: true });

    if (error && isMissingMessagesTable(error)) return [];
    if (error) throw error;

    return Promise.all(
      (messages ?? []).map(async (message) => ({
        ...message,
        attachments: await hydrateAttachmentUrls(message.attachments),
      })),
    );
  });

/** Load the admin review queue on the server, after verifying the caller's role. */
export const listAdminHomeworkSubmissions = createServerFn({ method: "POST" })
  .inputValidator((data) => adminHomeworkListInput.parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав для просмотра ДЗ");

    let query = supabaseAdmin
      .from("homework_submissions")
      .select(
        "id,user_id,lesson_id,content,status,feedback,created_at,updated_at,reviewed_at,reviewed_by",
      )
      .order("created_at", { ascending: false });

    if (data.submissionId) query = query.eq("id", data.submissionId);
    else query = query.eq("status", data.status).limit(120);

    const { data: submissions, error: submissionsError } = await awaitHomeworkRead(query);
    if (submissionsError) throw submissionsError;

    const rows = submissions ?? [];
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((submission) => [submission.user_id, submission.reviewed_by])
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const lessonIds = Array.from(new Set(rows.map((submission) => submission.lesson_id)));

    const [profilesResult, lessonsResult] = await Promise.all([
      userIds.length
        ? awaitHomeworkRead(
            supabaseAdmin.from("profiles").select("id,full_name,avatar_url").in("id", userIds),
          )
        : Promise.resolve({ data: [], error: null }),
      lessonIds.length
        ? awaitHomeworkRead(
            supabaseAdmin
              .from("lessons")
              .select("id,day_number,title,homework_md")
              .in("id", lessonIds),
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (profilesResult.error) throw profilesResult.error;
    if (lessonsResult.error) throw lessonsResult.error;

    return {
      submissions: rows,
      profiles: profilesResult.data ?? [],
      lessons: lessonsResult.data ?? [],
    };
  });

export const reviewHomeworkSubmission = createServerFn({ method: "POST" })
  .inputValidator((data) => reviewHomeworkInput.parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) {
      throw new Error("Недостаточно прав для проверки ДЗ");
    }

    const adminId = await getUserIdForAccessToken(data.accessToken);

    const feedback = data.feedback.trim();
    if (data.status === "rejected" && !feedback) {
      throw new Error("Комментарий обязателен при возврате на доработку");
    }

    const { data: submission, error: updateError } = await supabaseAdmin
      .from("homework_submissions")
      .update({
        status: data.status,
        feedback: feedback || null,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.submissionId)
      .select("id,user_id,lesson_id")
      .single();

    if (updateError || !submission) {
      throw updateError ?? new Error("Домашнее задание не найдено");
    }

    const savedAttachments = await persistAttachments(submission.id, data.attachments);

    if (feedback || savedAttachments.length > 0) {
      const { error: messageError } = await supabaseAdmin.from("homework_messages").insert({
        submission_id: submission.id,
        author_id: adminId,
        author_role: "mentor",
        body: feedback,
        attachments: savedAttachments,
      });

      if (messageError && !isMissingMessagesTable(messageError)) throw messageError;
    }

    await notifyStudentHomeworkStatus(
      { submissionId: submission.id, userId: submission.user_id, lessonId: submission.lesson_id },
      data.status,
    );

    let certificate = null;
    if (data.status === "approved") {
      const { maybeIssueCertificate } = await import("./certificates.server");
      certificate = await maybeIssueCertificate(submission.user_id);
    }

    return { ok: true, certificate };
  });

export const answerHomeworkQuestion = createServerFn({ method: "POST" })
  .inputValidator((data) => answerHomeworkInput.parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) {
      throw new Error("Недостаточно прав для ответа на ДЗ");
    }

    const adminId = await getUserIdForAccessToken(data.accessToken);

    const feedback = data.feedback.trim();
    const { data: submission, error: updateError } = await supabaseAdmin
      .from("homework_submissions")
      .update({
        status: "rejected",
        feedback,
        reviewed_by: adminId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.submissionId)
      .select("id,user_id,lesson_id")
      .single();

    if (updateError || !submission) {
      throw updateError ?? new Error("Домашнее задание не найдено");
    }

    const savedAttachments = await persistAttachments(submission.id, data.attachments);

    const { error: messageError } = await supabaseAdmin.from("homework_messages").insert({
      submission_id: submission.id,
      author_id: adminId,
      author_role: "mentor",
      body: feedback,
      attachments: savedAttachments,
    });

    if (messageError && !isMissingMessagesTable(messageError)) throw messageError;

    const { data: latestMessage, error: latestMessageError } = await supabaseAdmin
      .from("homework_messages")
      .select("id")
      .eq("submission_id", submission.id)
      .eq("author_id", adminId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (latestMessageError || !latestMessage) {
      throw latestMessageError ?? new Error("Не удалось найти комментарий наставника");
    }
    await notifyStudentMentorComment(
      { submissionId: submission.id, userId: submission.user_id, lessonId: submission.lesson_id },
      latestMessage.id,
    );

    return { ok: true };
  });

export const editHomeworkMessage = createServerFn({ method: "POST" })
  .inputValidator((data) => editHomeworkMessageInput.parse(data))
  .handler(async ({ data }) => {
    const roles = await getRolesForAccessToken(data.accessToken);
    if (!roles.includes("admin")) throw new Error("Недостаточно прав для редактирования сообщения");

    const adminId = await getUserIdForAccessToken(data.accessToken);
    const { data: message, error: messageError } = await supabaseAdmin
      .from("homework_messages")
      .select("id,author_id,author_role")
      .eq("id", data.messageId)
      .single();

    if (messageError || !message) throw messageError ?? new Error("Сообщение не найдено");
    if (message.author_role !== "mentor" || message.author_id !== adminId) {
      throw new Error("Можно редактировать только собственные комментарии");
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("homework_messages")
      .update({ body: data.body.trim() })
      .eq("id", message.id)
      .select("id,body")
      .single();

    if (updateError || !updated) throw updateError ?? new Error("Не удалось сохранить комментарий");
    return updated;
  });

export const askHomeworkQuestion = createServerFn({ method: "POST" })
  .inputValidator((data) => askHomeworkQuestionInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);

    const question = data.question.trim();
    const { data: submission, error: updateError } = await supabaseAdmin
      .from("homework_submissions")
      .update({
        status: "awaiting_mentor",
        feedback: null,
        reviewed_by: null,
        reviewed_at: null,
      })
      .eq("id", data.submissionId)
      .eq("user_id", userId)
      .eq("status", "rejected")
      .select("id,user_id,content,status,feedback,created_at,reviewed_at,reviewed_by")
      .single();

    if (updateError || !submission) {
      throw updateError ?? new Error("Можно задать вопрос только по ДЗ на доработке");
    }

    const savedAttachments = await persistAttachments(submission.id, data.attachments);

    const { error: messageError } = await supabaseAdmin.from("homework_messages").insert({
      submission_id: submission.id,
      author_id: userId,
      author_role: "student",
      body: question,
      attachments: savedAttachments,
    });

    if (messageError && !isMissingMessagesTable(messageError)) throw messageError;

    return submission;
  });

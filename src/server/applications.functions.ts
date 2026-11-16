import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getRequestHeader } from "@tanstack/react-start/server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  isValidApplicationContact,
  normalizeApplicationContact,
  APPLICATION_STATUSES,
  type ApplicationStatus,
} from "@/lib/application-validation";
import { getRolesForAccessToken } from "./admin-auth.server";

const accessTokenSchema = z.string().min(20);
const utmValue = z
  .string()
  .trim()
  .max(200)
  .optional()
  .transform((value) => value || null);

export const submitCourseApplication = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        name: z.string().trim().min(2, "Укажи имя").max(80),
        contactType: z.enum(["telegram", "vk"]),
        contact: z.string().trim().min(2, "Укажи контакт").max(160),
        consent: z.boolean().refine((value) => value, "Нужно согласие на обработку данных"),
        website: z.string().max(200).optional().default(""),
        utmSource: utmValue,
        utmMedium: utmValue,
        utmCampaign: utmValue,
        utmTerm: utmValue,
        utmContent: utmValue,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    // Honeypot: quietly accept bot submissions without storing them.
    if (data.website.trim()) return { accepted: true, duplicate: false };
    if (!isValidApplicationContact(data.contactType, data.contact))
      throw new Error(
        data.contactType === "telegram"
          ? "Укажи имя пользователя Telegram (например, @username)"
          : "Укажи ссылку или имя пользователя ВКонтакте",
      );

    // Nginx overwrites X-Real-IP from the socket address; hash it before storage.
    const trustedIp = getRequestHeader("x-real-ip")?.trim();
    if (trustedIp) {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(trustedIp));
      const ipHash = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
      ).join("");
      const { data: allowed, error: rateLimitError } = await supabaseAdmin.rpc(
        "reserve_course_application_attempt",
        { p_ip_hash: ipHash },
      );
      if (rateLimitError) throw new Error("Не удалось отправить заявку. Попробуй ещё раз позже.");
      if (!allowed)
        throw new Error("Слишком много попыток. Попробуй отправить заявку через 10 минут.");
    }

    const { error } = await supabaseAdmin.from("course_applications").insert({
      name: data.name,
      contact_type: data.contactType,
      contact: data.contact,
      normalized_contact: normalizeApplicationContact(data.contactType, data.contact),
      status: "new",
      utm_source: data.utmSource,
      utm_medium: data.utmMedium,
      utm_campaign: data.utmCampaign,
      utm_term: data.utmTerm,
      utm_content: data.utmContent,
      consent_at: new Date().toISOString(),
      consent_version: "2026-11-16",
    });

    // A unique normalized contact makes double taps and repeated applications idempotent.
    if (error?.code === "23505") return { accepted: true, duplicate: true };
    if (error) throw new Error("Не удалось отправить заявку. Попробуй ещё раз позже.");
    return { accepted: true, duplicate: false };
  });

const adminInput = z.object({ accessToken: accessTokenSchema });
const listInput = adminInput.extend({
  status: z.enum(APPLICATION_STATUSES).optional(),
});
const updateInput = adminInput.extend({
  id: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
});

async function assertApplicationAdmin(accessToken: string) {
  const roles = await getRolesForAccessToken(accessToken);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
}

export const listCourseApplications = createServerFn({ method: "POST" })
  .inputValidator((data) => listInput.parse(data))
  .handler(async ({ data }) => {
    await assertApplicationAdmin(data.accessToken);
    let query = supabaseAdmin
      .from("course_applications")
      .select(
        "id,name,contact_type,contact,status,utm_source,utm_medium,utm_campaign,utm_term,utm_content,consent_at,created_at,updated_at",
      )
      .order("created_at", { ascending: false })
      .limit(500);
    if (data.status) query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error("Не удалось загрузить заявки");
    return (rows ?? []) as Array<{
      id: string;
      name: string;
      contact_type: "telegram" | "vk";
      contact: string;
      status: ApplicationStatus;
      utm_source: string | null;
      utm_medium: string | null;
      utm_campaign: string | null;
      utm_term: string | null;
      utm_content: string | null;
      consent_at: string;
      created_at: string;
      updated_at: string;
    }>;
  });

export const updateCourseApplicationStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => updateInput.parse(data))
  .handler(async ({ data }) => {
    await assertApplicationAdmin(data.accessToken);
    const { data: updated, error } = await supabaseAdmin
      .from("course_applications")
      .update({ status: data.status })
      .eq("id", data.id)
      .select("id,status")
      .maybeSingle();
    if (error) throw new Error("Не удалось изменить статус заявки");
    if (!updated) throw new Error("Заявка не найдена");
    return { id: updated.id as string, status: updated.status as ApplicationStatus };
  });

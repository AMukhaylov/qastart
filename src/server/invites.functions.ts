import { randomBytes, createHash } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";

const INVITE_SELECT = "id,email,status,expires_at,used_at,used_by,created_by,created_at,updated_at";

const accessInput = z.object({
  accessToken: z.string().min(20),
});

const createInviteInput = accessInput.extend({
  email: z.string().trim().email().max(255).optional().or(z.literal("")),
  expiresAt: z.string().trim().max(80).nullable().optional(),
  origin: z.string().trim().url().max(255),
});

const revokeInviteInput = accessInput.extend({
  inviteId: z.string().uuid(),
});

const validateInviteInput = z.object({
  token: z.string().trim().min(32).max(160),
});

const acceptInviteInput = validateInviteInput.extend({
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72),
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
});

const acceptOAuthInviteInput = validateInviteInput.extend({
  accessToken: z.string().min(20),
});

async function assertAdmin(accessToken: string) {
  const roles = await getRolesForAccessToken(accessToken);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
  return await getUserIdForAccessToken(accessToken);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isExpired(expiresAt: string | null) {
  return Boolean(expiresAt && new Date(expiresAt).getTime() <= Date.now());
}

function inviteProblem(invite: {
  status: string;
  expires_at: string | null;
  used_at: string | null;
}) {
  if (invite.status === "revoked") return "Ссылка отозвана администратором";
  if (invite.status === "used" || invite.used_at) return "Ссылка уже использована";
  if (isExpired(invite.expires_at)) return "Срок действия ссылки истёк";
  if (invite.status !== "active") return "Ссылка недоступна";
  return null;
}

export const listAdminInvites = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);

    const { data: invites, error } = await supabaseAdmin
      .from("course_invites")
      .select(INVITE_SELECT)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) throw error;
    return invites ?? [];
  });

export const createAdminInvite = createServerFn({ method: "POST" })
  .inputValidator((data) => createInviteInput.parse(data))
  .handler(async ({ data }) => {
    const adminId = await assertAdmin(data.accessToken);
    const token = randomBytes(32).toString("base64url");
    const email = data.email ? normalizeEmail(data.email) : null;

    const { data: invite, error } = await supabaseAdmin
      .from("course_invites")
      .insert({
        token_hash: hashToken(token),
        email,
        expires_at: data.expiresAt || null,
        created_by: adminId,
      })
      .select(INVITE_SELECT)
      .single();

    if (error) throw error;

    const url = new URL("/auth", data.origin);
    url.searchParams.set("invite", token);

    return { invite, inviteUrl: url.toString() };
  });

export const revokeAdminInvite = createServerFn({ method: "POST" })
  .inputValidator((data) => revokeInviteInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);

    const { error } = await supabaseAdmin
      .from("course_invites")
      .update({ status: "revoked" })
      .eq("id", data.inviteId)
      .eq("status", "active");

    if (error) throw error;
    return { ok: true };
  });

export const validateCourseInvite = createServerFn({ method: "POST" })
  .inputValidator((data) => validateInviteInput.parse(data))
  .handler(async ({ data }) => {
    const { data: invite, error } = await supabaseAdmin
      .from("course_invites")
      .select("email,status,expires_at,used_at")
      .eq("token_hash", hashToken(data.token))
      .maybeSingle();

    if (error) throw error;
    if (!invite) return { valid: false, reason: "Ссылка не найдена", email: null };

    const reason = inviteProblem(invite);
    return { valid: !reason, reason, email: invite.email };
  });

export const getCourseAccessStatus = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const roles = await getRolesForAccessToken(data.accessToken);
    if (roles.includes("admin")) return { allowed: true, reason: null };

    const { data: invite, error } = await supabaseAdmin
      .from("course_invites")
      .select("id")
      .eq("used_by", userId)
      .eq("status", "used")
      .maybeSingle();

    if (error) throw error;
    return {
      allowed: Boolean(invite),
      reason: invite ? null : "Доступ к курсу открывается только по персональной ссылке",
    };
  });

export const acceptCourseInvite = createServerFn({ method: "POST" })
  .inputValidator((data) => acceptInviteInput.parse(data))
  .handler(async ({ data }) => {
    const tokenHash = hashToken(data.token);
    const email = normalizeEmail(data.email);

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("course_invites")
      .select("id,email,status,expires_at,used_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) throw new Error("Ссылка приглашения не найдена");

    const reason = inviteProblem(invite);
    if (reason) throw new Error(reason);
    if (invite.email && normalizeEmail(invite.email) !== email) {
      throw new Error("Эта ссылка выписана на другой email");
    }

    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const fullName = `${firstName} ${lastName}`.trim();

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        first_name: firstName,
        last_name: lastName,
      },
    });

    if (createError) throw createError;
    const userId = created.user?.id;
    if (!userId) throw new Error("Не удалось создать пользователя");

    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from("course_invites")
      .update({ status: "used", used_at: new Date().toISOString(), used_by: userId })
      .eq("id", invite.id)
      .eq("status", "active")
      .is("used_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .select("id")
      .maybeSingle();

    if (consumeError || !consumed) {
      await supabaseAdmin.auth.admin.deleteUser(userId, false);
      throw consumeError ?? new Error("Ссылка уже была использована");
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: userId, full_name: fullName }, { onConflict: "id" });

    if (profileError) throw profileError;

    return { ok: true, email };
  });

export const acceptOAuthCourseInvite = createServerFn({ method: "POST" })
  .inputValidator((data) => acceptOAuthInviteInput.parse(data))
  .handler(async ({ data }) => {
    const tokenHash = hashToken(data.token);
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(data.accessToken);

    if (userError) throw userError;
    const user = userData.user;
    if (!user?.id) throw new Error("Не удалось проверить пользователя");

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from("course_invites")
      .select("id,email,status,expires_at,used_at,used_by")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invite) throw new Error("Ссылка приглашения не найдена");

    if (invite.status === "used" && invite.used_by === user.id) {
      return { ok: true };
    }

    const reason = inviteProblem(invite);
    if (reason) throw new Error(reason);
    if (invite.email && normalizeEmail(invite.email) !== normalizeEmail(user.email ?? "")) {
      throw new Error("Эта ссылка выписана на другой email");
    }

    const { data: consumed, error: consumeError } = await supabaseAdmin
      .from("course_invites")
      .update({ status: "used", used_at: new Date().toISOString(), used_by: user.id })
      .eq("id", invite.id)
      .eq("status", "active")
      .is("used_at", null)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .select("id")
      .maybeSingle();

    if (consumeError || !consumed) {
      throw consumeError ?? new Error("Ссылка уже была использована");
    }

    const metadata = user.user_metadata ?? {};
    const fullName =
      [metadata.first_name, metadata.last_name].filter(Boolean).join(" ").trim() ||
      String(metadata.full_name ?? metadata.name ?? "").trim() ||
      user.email?.split("@")[0] ||
      "Студент";
    const avatarUrl =
      typeof metadata.avatar_url === "string"
        ? metadata.avatar_url
        : typeof metadata.picture === "string"
          ? metadata.picture
          : null;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: user.id, full_name: fullName, avatar_url: avatarUrl }, { onConflict: "id" });

    if (profileError) throw profileError;

    return { ok: true };
  });

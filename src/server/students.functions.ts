import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";

const adminAccessInput = z.object({
  accessToken: z.string().min(20),
});

const studentIdInput = adminAccessInput.extend({
  userId: z.string().uuid(),
});

const updateStudentInput = studentIdInput.extend({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  password: z.string().min(6).max(72).optional().or(z.literal("")),
});

const blockStudentInput = studentIdInput.extend({
  blocked: z.boolean(),
});

async function assertAdmin(accessToken: string) {
  const roles = await getRolesForAccessToken(accessToken);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
  return await getUserIdForAccessToken(accessToken);
}

export const listAdminStudentsAuth = createServerFn({ method: "POST" })
  .inputValidator((data) => adminAccessInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw error;

    return users.users.map((user) => ({
      id: user.id,
      email: user.email ?? "",
      banned_until: user.banned_until ?? null,
      full_name:
        typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
    }));
  });

export const updateAdminStudent = createServerFn({ method: "POST" })
  .inputValidator((data) => updateStudentInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);

    const fullName = data.fullName.trim();
    const email = data.email.trim();
    const { data: currentUser, error: currentUserError } =
      await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (currentUserError) throw currentUserError;

    const authPayload: Parameters<typeof supabaseAdmin.auth.admin.updateUserById>[1] = {};
    if (currentUser.user.email !== email) authPayload.email = email;
    if (data.password) authPayload.password = data.password;

    if (Object.keys(authPayload).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
        data.userId,
        authPayload,
      );
      if (authError) throw authError;
    }

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert({ id: data.userId, full_name: fullName }, { onConflict: "id" });
    if (profileError) throw profileError;

    return { ok: true };
  });

export const setAdminStudentBlocked = createServerFn({ method: "POST" })
  .inputValidator((data) => blockStudentInput.parse(data))
  .handler(async ({ data }) => {
    const adminId = await assertAdmin(data.accessToken);
    if (adminId === data.userId && data.blocked) {
      throw new Error("Нельзя заблокировать самого себя");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876600h" : "none",
    });
    if (error) throw error;

    return { ok: true };
  });

export const deleteAdminStudent = createServerFn({ method: "POST" })
  .inputValidator((data) => studentIdInput.parse(data))
  .handler(async ({ data }) => {
    const adminId = await assertAdmin(data.accessToken);
    if (adminId === data.userId) throw new Error("Нельзя удалить самого себя");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId, false);
    if (error) throw error;

    return { ok: true };
  });

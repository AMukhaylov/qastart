import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";

const adminAccessInput = z.object({ accessToken: z.string().min(20) });
const studentIdInput = adminAccessInput.extend({ userId: z.string().uuid() });
const loginSchema = z
  .string()
  .trim()
  .min(3, "Логин должен содержать минимум 3 символа")
  .max(40)
  .regex(/^[a-zA-Z0-9_]+$/, "Используйте латинские буквы, цифры и _");
const passwordSchema = z.string().min(10, "Пароль должен содержать минимум 10 символов").max(72);
const nameSchema = z.string().trim().min(1, "Введите имя").max(60);

const createStudentInput = adminAccessInput.extend({
  firstName: nameSchema,
  lastName: nameSchema,
  login: loginSchema,
  password: passwordSchema,
});
const updateStudentInput = studentIdInput.extend({
  firstName: nameSchema,
  lastName: nameSchema,
  login: loginSchema,
  password: passwordSchema.optional().or(z.literal("")),
});
const blockStudentInput = studentIdInput.extend({ blocked: z.boolean() });

const UPPERCASE = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWERCASE = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const LOGIN_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function sample(chars: string) {
  return chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
}

function randomHex(bytes: number) {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function generateStudentPassword() {
  const chars = [sample(UPPERCASE), sample(LOWERCASE), sample(DIGITS)];
  const all = UPPERCASE + LOWERCASE + DIGITS;
  while (chars.length < 12) chars.push(sample(all));
  for (let index = chars.length - 1; index > 0; index -= 1) {
    const other = crypto.getRandomValues(new Uint32Array(1))[0] % (index + 1);
    [chars[index], chars[other]] = [chars[other], chars[index]];
  }
  return chars.join("");
}

async function makeUniqueStudentLogin(seed = "qastart") {
  const normalized =
    seed
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "")
      .slice(0, 22) || "qastart";
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidate = `${normalized}_${Array.from({ length: 4 }, () => sample(DIGITS)).join("")}`;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("login", candidate)
      .maybeSingle();
    if (error) throw error;
    if (!data) return candidate;
  }
  return `${normalized}_${randomHex(4)}`;
}

async function assertAdmin(accessToken: string) {
  const roles = await getRolesForAccessToken(accessToken);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
  return getUserIdForAccessToken(accessToken);
}

async function assertAvailableLogin(login: string, exceptUserId?: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("login", login)
    .maybeSingle();
  if (error) throw error;
  if (data && data.id !== exceptUserId) throw new Error("Этот логин уже занят");
}

export const generateAdminStudentCredentials = createServerFn({ method: "POST" })
  .inputValidator((data) => adminAccessInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    return { login: await makeUniqueStudentLogin(), password: generateStudentPassword() };
  });

export const listAdminStudentsAuth = createServerFn({ method: "POST" })
  .inputValidator((data) => adminAccessInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const [
      { data: profiles, error: profilesError },
      { data: users, error: usersError },
      { data: roles, error: rolesError },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,login,full_name"),
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("user_roles").select("user_id,role"),
    ]);
    if (profilesError) throw profilesError;
    if (usersError) throw usersError;
    if (rolesError) throw rolesError;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const admins = new Set(
      (roles ?? []).filter((role) => role.role === "admin").map((role) => role.user_id),
    );
    return users.users
      .filter((user) => !admins.has(user.id))
      .map((user) => {
        const profile = profileById.get(user.id);
        return {
          id: user.id,
          login: profile?.login ?? "",
          banned_until: user.banned_until ?? null,
          full_name: profile?.full_name ?? null,
        };
      });
  });

export const createAdminStudent = createServerFn({ method: "POST" })
  .inputValidator((data) => createStudentInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const login = data.login.toLowerCase();
    await assertAvailableLogin(login);
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    const technicalEmail = `${login}.${randomHex(8)}@students.startqa.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: technicalEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: fullName, login },
    });
    if (error || !created.user) throw error ?? new Error("Не удалось создать ученика");
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: fullName, login })
      .eq("id", created.user.id);
    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id, false);
      throw profileError;
    }
    return { id: created.user.id, fullName, login, password: data.password };
  });

export const updateAdminStudent = createServerFn({ method: "POST" })
  .inputValidator((data) => updateStudentInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const login = data.login.toLowerCase();
    await assertAvailableLogin(login, data.userId);
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.password,
      });
      if (error) throw error;
    }
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ full_name: fullName, login })
      .eq("id", data.userId);
    if (profileError) throw profileError;
    return { ok: true };
  });

export const resetAdminStudentPassword = createServerFn({ method: "POST" })
  .inputValidator((data) => studentIdInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const password = generateStudentPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password });
    if (error) throw error;
    return { password };
  });

export const setAdminStudentBlocked = createServerFn({ method: "POST" })
  .inputValidator((data) => blockStudentInput.parse(data))
  .handler(async ({ data }) => {
    const adminId = await assertAdmin(data.accessToken);
    if (adminId === data.userId && data.blocked)
      throw new Error("Нельзя заблокировать самого себя");
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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getRolesForAccessToken,
  getUserIdForAccessToken,
  listAllAuthUsers,
} from "./admin-auth.server";
import { courseDate, courseDay, courseStartFromDate } from "@/lib/course-schedule";
import { buildHomeworkSnapshots, countHomeworkTimings } from "@/lib/course-homework";

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
  courseStartDate: z.string().nullable().optional(),
});
const updateStudentInput = studentIdInput.extend({
  firstName: nameSchema,
  lastName: nameSchema,
  login: loginSchema,
  password: passwordSchema.optional().or(z.literal("")),
  courseStartDate: z.string().nullable().optional(),
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
    const [{ data: profiles, error: profilesError }, users, { data: roles, error: rolesError }] =
      await Promise.all([
        supabaseAdmin.from("profiles").select("id,login,full_name"),
        listAllAuthUsers(),
        supabaseAdmin.from("user_roles").select("user_id,role"),
      ]);
    if (profilesError) throw profilesError;
    if (rolesError) throw rolesError;
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const admins = new Set(
      (roles ?? []).filter((role) => role.role === "admin").map((role) => role.user_id),
    );
    return users
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

export const listAdminStudentsOverview = createServerFn({ method: "POST" })
  .inputValidator((data) => adminAccessInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const [
      { data: profiles, error: profilesError },
      users,
      { data: roles, error: rolesError },
      { data: lessons, error: lessonsError },
      { data: progress, error: progressError },
      { data: homework, error: homeworkError },
      { data: groups, error: groupsError },
      { data: memberships, error: membershipsError },
      { data: homeworkBlocks, error: homeworkBlocksError },
      { data: sqlAttempts, error: sqlAttemptsError },
      { data: quizAttempts, error: quizAttemptsError },
    ] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,login,full_name,created_at,course_start_at"),
      listAllAuthUsers(),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("lessons").select("id,day_number,homework_md"),
      supabaseAdmin
        .from("lesson_progress")
        .select("user_id,lesson_id,completed,completed_at")
        .eq("completed", true),
      supabaseAdmin.from("homework_submissions").select("id,user_id,lesson_id,status,created_at"),
      supabaseAdmin
        .from("student_groups" as any)
        .select("id,name,description,created_at,updated_at")
        .order("name"),
      supabaseAdmin.from("group_students" as any).select("group_id,student_id"),
      supabaseAdmin
        .from("lesson_blocks")
        .select("id,lesson_id,content")
        .eq("block_type", "homework"),
      supabaseAdmin
        .from("sql_sandbox_attempts")
        .select("user_id,block_id,task_id,passed,passed_at"),
      supabaseAdmin.from("quiz_attempts").select("user_id,passed").eq("passed", true),
    ]);
    for (const error of [
      profilesError,
      rolesError,
      lessonsError,
      progressError,
      homeworkError,
      groupsError,
      membershipsError,
      homeworkBlocksError,
      sqlAttemptsError,
      quizAttemptsError,
    ]) {
      if (error) throw error;
    }
    const admins = new Set(
      (roles ?? []).filter((role) => role.role === "admin").map((role) => role.user_id),
    );
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const completed = new Map<string, number>();
    (progress ?? []).forEach((item) =>
      completed.set(item.user_id, (completed.get(item.user_id) ?? 0) + 1),
    );
    const approved = new Map<string, number>();
    const pending = new Map<string, number>();
    (homework ?? []).forEach((item) => {
      const target =
        item.status === "approved" ? approved : item.status === "pending" ? pending : null;
      if (target) target.set(item.user_id, (target.get(item.user_id) ?? 0) + 1);
    });
    const groupMembers = new Map<string, string[]>();
    (memberships ?? []).forEach((membership: any) => {
      groupMembers.set(membership.group_id, [
        ...(groupMembers.get(membership.group_id) ?? []),
        membership.student_id,
      ]);
    });
    const studentRows = users
      .filter((user) => !admins.has(user.id))
      .map((user) => {
        const profile = profileById.get(user.id);
        const snapshots = buildHomeworkSnapshots({
          lessons: lessons ?? [],
          courseStartAt: profile?.course_start_at ?? null,
          progress: (progress ?? []).filter((item) => item.user_id === user.id),
          submissions: (homework ?? []).filter((item) => item.user_id === user.id),
          homeworkBlocks: homeworkBlocks ?? [],
          sqlAttempts: (sqlAttempts ?? []).filter((item) => item.user_id === user.id),
        });
        const homeworkCounts = countHomeworkTimings(snapshots);
        const currentDay = courseDay(profile?.course_start_at ?? null);
        return {
          id: user.id,
          login: profile?.login ?? "",
          full_name: profile?.full_name ?? null,
          created_at: profile?.created_at ?? user.created_at,
          course_start_at: profile?.course_start_at ?? null,
          currentDay,
          currentAvailableLesson: currentDay ? Math.min(currentDay, 14) : 0,
          courseStatus: !profile?.course_start_at
            ? "not_scheduled"
            : currentDay === 0
              ? "upcoming"
              : (quizAttempts ?? []).some(
                    (attempt) => attempt.user_id === user.id && attempt.passed,
                  )
                ? "completed"
                : "in_progress",
          homeworkCounts,
          banned_until: user.banned_until ?? null,
          completed: completed.get(user.id) ?? 0,
          approved: approved.get(user.id) ?? 0,
          pending: pending.get(user.id) ?? 0,
        };
      });
    return {
      students: studentRows,
      totalLessons: lessons?.length || 14,
      groups: (groups ?? []).map((group: any) => ({
        ...group,
        studentIds: groupMembers.get(group.id) ?? [],
      })),
    };
  });

export const createAdminStudent = createServerFn({ method: "POST" })
  .inputValidator((data) => createStudentInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const login = data.login.toLowerCase();
    await assertAvailableLogin(login);
    const fullName = `${data.firstName.trim()} ${data.lastName.trim()}`;
    const courseStartAt = data.courseStartDate ? courseStartFromDate(data.courseStartDate) : null;
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
      .update({
        full_name: fullName,
        login,
        course_start_at: courseStartAt,
      })
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
    const { data: existing, error: existingError } = await supabaseAdmin
      .from("profiles")
      .select("course_start_at")
      .eq("id", data.userId)
      .single();
    if (existingError) throw existingError;
    const selectedDate = data.courseStartDate || null;
    const courseStartChanged =
      data.courseStartDate !== undefined &&
      selectedDate !== (existing.course_start_at ? courseDate(existing.course_start_at) : null);
    if (
      courseStartChanged &&
      existing.course_start_at &&
      Date.parse(existing.course_start_at) <= Date.now()
    ) {
      throw new Error(
        "Обучение уже началось. Изменить дату старта обычным редактированием нельзя.",
      );
    }
    if (data.password) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
        password: data.password,
      });
      if (error) throw error;
    }
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: fullName,
        login,
        ...(courseStartChanged
          ? { course_start_at: selectedDate ? courseStartFromDate(selectedDate) : null }
          : {}),
      })
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

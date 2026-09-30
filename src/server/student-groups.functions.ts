/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken } from "./admin-auth.server";

const access = z.object({ accessToken: z.string().min(20) });
const groupId = z.string().uuid();
const groupInput = access.extend({
  id: groupId.optional(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).default(""),
});
const membershipInput = access.extend({
  groupId,
  studentIds: z.array(z.string().uuid()).max(1000),
});

async function assertAdmin(token: string) {
  const roles = await getRolesForAccessToken(token);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
}

export const listAdminStudentGroups = createServerFn({ method: "POST" })
  .inputValidator((data) => access.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const [{ data: groups, error: groupsError }, { data: members, error: membersError }] =
      await Promise.all([
        supabaseAdmin
          .from("student_groups" as any)
          .select("id,name,description,created_at,updated_at")
          .order("name"),
        supabaseAdmin.from("group_students" as any).select("group_id,student_id"),
      ]);
    if (groupsError) throw groupsError;
    if (membersError) throw membersError;
    const byGroup = new Map<string, string[]>();
    for (const member of (members ?? []) as unknown as Array<{
      group_id: string;
      student_id: string;
    }>) {
      const list = byGroup.get(member.group_id) ?? [];
      list.push(member.student_id);
      byGroup.set(member.group_id, list);
    }
    return (
      (groups ?? []) as unknown as Array<{
        id: string;
        name: string;
        description: string;
        created_at: string;
        updated_at: string;
      }>
    ).map((group) => ({ ...group, studentIds: byGroup.get(group.id) ?? [] }));
  });

export const saveAdminStudentGroup = createServerFn({ method: "POST" })
  .inputValidator((data) => groupInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const query = data.id
      ? supabaseAdmin
          .from("student_groups" as any)
          .update({ name: data.name, description: data.description })
          .eq("id", data.id)
          .select("id,name,description,created_at,updated_at")
          .single()
      : supabaseAdmin
          .from("student_groups" as any)
          .insert({ name: data.name, description: data.description })
          .select("id,name,description,created_at,updated_at")
          .single();
    const { data: group, error } = await query;
    if (error) throw error;
    return group;
  });

export const deleteAdminStudentGroup = createServerFn({ method: "POST" })
  .inputValidator((data) => access.extend({ id: groupId }).parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { error } = await supabaseAdmin
      .from("student_groups" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const setAdminStudentGroupMembers = createServerFn({ method: "POST" })
  .inputValidator((data) => membershipInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);
    const { data: existingRows, error: existingError } = await supabaseAdmin
      .from("group_students" as any)
      .select("student_id")
      .eq("group_id", data.groupId);
    if (existingError) throw existingError;
    const existingIds = new Set(
      ((existingRows ?? []) as unknown as Array<{ student_id: string }>).map(
        (row) => row.student_id,
      ),
    );
    const desiredIds = new Set(data.studentIds);
    const idsToAdd = [...desiredIds].filter((studentId) => !existingIds.has(studentId));
    const idsToRemove = [...existingIds].filter((studentId) => !desiredIds.has(studentId));

    // Add first, then remove stale links. A failed insert therefore leaves the
    // previous membership intact instead of clearing the whole group.
    if (idsToAdd.length) {
      const { error } = await supabaseAdmin
        .from("group_students" as any)
        .insert(idsToAdd.map((studentId) => ({ group_id: data.groupId, student_id: studentId })));
      if (error) throw error;
    }
    if (idsToRemove.length) {
      const { error } = await supabaseAdmin
        .from("group_students" as any)
        .delete()
        .eq("group_id", data.groupId)
        .in("student_id", idsToRemove);
      if (error) throw error;
    }
    return { ok: true };
  });

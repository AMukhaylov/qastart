/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  getRolesForAccessToken,
  getUserIdForAccessToken,
  listAllAuthUsers,
} from "./admin-auth.server";

const MEETING_SELECT =
  "id,position,title,description,meeting_url,starts_at,is_published,created_at,updated_at";

const accessInput = z.object({
  accessToken: z.string().min(20),
});

const meetingInput = accessInput.extend({
  id: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(600),
  meetingUrl: z.string().trim().max(500),
  startsAt: z.string().trim().max(80).nullable(),
  isPublished: z.boolean(),
  groupIds: z.array(z.string().uuid()).max(100).default([]),
  studentIds: z.array(z.string().uuid()).max(1000).default([]),
});

async function assertAdmin(accessToken: string) {
  const roles = await getRolesForAccessToken(accessToken);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
}

async function getActiveStudentIds() {
  const [users, { data: roles, error: rolesError }] = await Promise.all([
    listAllAuthUsers(),
    supabaseAdmin.from("user_roles").select("user_id,role"),
  ]);
  if (rolesError) throw rolesError;
  const adminIds = new Set(
    (roles ?? []).filter((role) => role.role === "admin").map((role) => role.user_id),
  );
  return new Set(
    users.filter((user) => !user.banned_until && !adminIds.has(user.id)).map((user) => user.id),
  );
}

export const listPublishedMeetings = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const { data: meetings, error } = await supabaseAdmin
      .from("course_meetings")
      .select(MEETING_SELECT)
      .eq("is_published", true)
      .order("position", { ascending: true });

    if (error) throw error;
    const all = meetings ?? [];
    const ids = all.map((meeting) => meeting.id);
    if (!ids.length) return [];
    const [
      { data: directLinks, error: directLinksError },
      { data: groupLinks, error: groupLinksError },
    ] = await Promise.all([
      supabaseAdmin
        .from("meeting_students" as any)
        .select("meeting_id,student_id")
        .in("meeting_id", ids),
      supabaseAdmin
        .from("meeting_groups" as any)
        .select("meeting_id,group_id")
        .in("meeting_id", ids),
    ]);
    if (directLinksError) throw directLinksError;
    if (groupLinksError) throw groupLinksError;
    const allDirect = (directLinks ?? []) as unknown as Array<{
      meeting_id: string;
      student_id: string;
    }>;
    const directIds = new Set(
      allDirect.filter((row) => row.student_id === userId).map((row) => row.meeting_id),
    );
    const links = (groupLinks ?? []) as unknown as Array<{ meeting_id: string; group_id: string }>;
    const groupIds = [...new Set(links.map((row) => row.group_id))];
    const { data: memberships, error: membershipsError } = groupIds.length
      ? await supabaseAdmin
          .from("group_students" as any)
          .select("group_id")
          .eq("student_id", userId)
          .in("group_id", groupIds)
      : { data: [] };
    if (membershipsError) throw membershipsError;
    const memberGroups = new Set(
      ((memberships ?? []) as Array<{ group_id: string }>).map((row) => row.group_id),
    );
    const assigned = new Set([
      ...directIds,
      ...links.filter((row) => memberGroups.has(row.group_id)).map((row) => row.meeting_id),
    ]);
    const configured = new Set(links.map((row) => row.meeting_id));
    const directConfigured = new Set(allDirect.map((row) => row.meeting_id));
    return all.filter(
      (meeting) =>
        (!configured.has(meeting.id) && !directConfigured.has(meeting.id)) ||
        assigned.has(meeting.id),
    );
  });

export const listAdminMeetings = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);

    const { data: meetings, error } = await supabaseAdmin
      .from("course_meetings")
      .select(MEETING_SELECT)
      .order("position", { ascending: true });

    if (error) throw error;
    const ids = (meetings ?? []).map((meeting) => meeting.id);
    const [{ data: groups }, { data: students }] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("meeting_groups" as any)
            .select("meeting_id,group_id,student_groups(id,name)")
            .in("meeting_id", ids)
        : { data: [] },
      ids.length
        ? supabaseAdmin
            .from("meeting_students" as any)
            .select("meeting_id,student_id,profiles(id,full_name,login)")
            .in("meeting_id", ids)
        : { data: [] },
    ]);
    return (meetings ?? []).map((meeting) => ({
      ...meeting,
      groupLinks: (groups ?? []).filter((row: any) => row.meeting_id === meeting.id),
      studentLinks: (students ?? []).filter((row: any) => row.meeting_id === meeting.id),
    }));
  });

export const updateAdminMeeting = createServerFn({ method: "POST" })
  .inputValidator((data) => meetingInput.parse(data))
  .handler(async ({ data }) => {
    await assertAdmin(data.accessToken);

    const { data: meeting, error } = await supabaseAdmin
      .from("course_meetings")
      .update({
        title: data.title,
        description: data.description,
        meeting_url: data.meetingUrl,
        starts_at: data.startsAt || null,
        is_published: data.isPublished,
      })
      .eq("id", data.id)
      .select(MEETING_SELECT)
      .single();

    if (error) throw error;
    const activeStudentIds = await getActiveStudentIds();
    const activeStudentIdsToInsert = data.studentIds.filter((studentId) =>
      activeStudentIds.has(studentId),
    );

    // Insert the new audience before removing old links. This avoids leaving a
    // meeting empty when validation or an insert fails halfway through a save.
    const [{ data: existingGroups }, { data: existingStudents }] = await Promise.all([
      supabaseAdmin
        .from("meeting_groups" as any)
        .select("group_id")
        .eq("meeting_id", data.id),
      supabaseAdmin
        .from("meeting_students" as any)
        .select("student_id")
        .eq("meeting_id", data.id),
    ]);
    const existingGroupIds = new Set(
      ((existingGroups ?? []) as unknown as Array<{ group_id: string }>).map((row) => row.group_id),
    );
    const existingStudentIds = new Set(
      ((existingStudents ?? []) as unknown as Array<{ student_id: string }>).map(
        (row) => row.student_id,
      ),
    );
    const groupsToAdd = data.groupIds.filter((groupId) => !existingGroupIds.has(groupId));
    const studentsToAdd = activeStudentIdsToInsert.filter(
      (studentId) => !existingStudentIds.has(studentId),
    );
    if (groupsToAdd.length) {
      const { error: groupError } = await supabaseAdmin
        .from("meeting_groups" as any)
        .insert(groupsToAdd.map((groupId) => ({ meeting_id: data.id, group_id: groupId })));
      if (groupError) throw groupError;
    }
    if (studentsToAdd.length) {
      const { error: studentError } = await supabaseAdmin
        .from("meeting_students" as any)
        .insert(studentsToAdd.map((studentId) => ({ meeting_id: data.id, student_id: studentId })));
      if (studentError) throw studentError;
    }
    const groupIdsToRemove = [...existingGroupIds].filter(
      (groupId) => !data.groupIds.includes(groupId),
    );
    const studentIdsToRemove = [...existingStudentIds].filter(
      (studentId) => !activeStudentIdsToInsert.includes(studentId),
    );
    if (groupIdsToRemove.length) {
      const { error } = await supabaseAdmin
        .from("meeting_groups" as any)
        .delete()
        .eq("meeting_id", data.id)
        .in("group_id", groupIdsToRemove);
      if (error) throw error;
    }
    if (studentIdsToRemove.length) {
      const { error } = await supabaseAdmin
        .from("meeting_students" as any)
        .delete()
        .eq("meeting_id", data.id)
        .in("student_id", studentIdsToRemove);
      if (error) throw error;
    }
    return { ...meeting, groupLinks: [], studentLinks: [] };
  });

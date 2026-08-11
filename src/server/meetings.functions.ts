import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";

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
});

async function assertAdmin(accessToken: string) {
  const roles = await getRolesForAccessToken(accessToken);
  if (!roles.includes("admin")) throw new Error("Недостаточно прав");
}

export const listPublishedMeetings = createServerFn({ method: "POST" })
  .inputValidator((data) => accessInput.parse(data))
  .handler(async ({ data }) => {
    await getUserIdForAccessToken(data.accessToken);

    const { data: meetings, error } = await supabaseAdmin
      .from("course_meetings")
      .select(MEETING_SELECT)
      .eq("is_published", true)
      .order("position", { ascending: true });

    if (error) throw error;
    return meetings ?? [];
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
    return meetings ?? [];
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
    return meeting;
  });

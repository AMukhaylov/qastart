import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAvatarPresetById } from "@/lib/avatar-presets";
import { getUserIdForAccessToken } from "./admin-auth.server";

const updatePresetAvatarInput = z.object({
  accessToken: z.string().min(20),
  presetId: z.string().min(1),
});

export const updatePresetAvatarForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator((data) => updatePresetAvatarInput.parse(data))
  .handler(async ({ data }) => {
    const userId = await getUserIdForAccessToken(data.accessToken);
    const preset = getAvatarPresetById(data.presetId);

    if (!preset) {
      throw new Error("Аватар не найден");
    }

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ avatar_url: preset.dataUrl })
      .eq("id", userId);

    if (error) throw error;

    return { avatar_url: preset.dataUrl };
  });

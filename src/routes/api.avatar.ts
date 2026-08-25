import { Buffer } from "node:buffer";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getAvatarPresetById } from "@/lib/avatar-presets";
import { getRolesForAccessToken, getUserIdForAccessToken } from "@/server/admin-auth.server";

const AVATARS_BUCKET = "avatars";
const MAX_AVATAR_SIZE = 2 * 1024 * 1024;
const MAX_AVATAR_DATA_URL_LENGTH = 750_000;
const ALLOWED_AVATAR_TYPES = new Set(["image/png", "image/jpeg"]);
const AVATAR_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/;

export const Route = createFileRoute("/api/avatar")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const accessToken = getBearerToken(request);
        if (!accessToken) return new Response("Unauthorized", { status: 401 });

        try {
          const requesterId = await getUserIdForAccessToken(accessToken);

          const url = new URL(request.url);
          const userId = url.searchParams.get("userId");

          if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
            return new Response("Not found", { status: 404 });
          }

          if (!(await canReadAvatar(requesterId, userId, accessToken))) {
            return new Response("Forbidden", { status: 403 });
          }

          const { data, error } = await supabaseAdmin.storage
            .from(AVATARS_BUCKET)
            .download(`${userId}/avatar`);

          if (error || !data) {
            return new Response("Not found", { status: 404 });
          }

          return new Response(await data.arrayBuffer(), {
            headers: {
              "Cache-Control": "private, max-age=3600",
              "Content-Type": data.type || "image/jpeg",
              Vary: "Authorization",
            },
          });
        } catch {
          return new Response("Unauthorized", { status: 401 });
        }
      },
      POST: async ({ request }) => {
        try {
          const accessToken = getBearerToken(request);
          if (!accessToken) return json({ error: "Нужно войти заново" }, 401);

          const userId = await getUserIdForAccessToken(accessToken);
          const contentType = request.headers.get("content-type") ?? "";

          if (contentType.includes("application/json")) {
            const body = (await request.json().catch(() => null)) as {
              avatarDataUrl?: unknown;
              presetId?: unknown;
            } | null;
            const presetId = typeof body?.presetId === "string" ? body.presetId : "";
            const preset = presetId ? getAvatarPresetById(presetId) : null;

            if (preset) {
              const { error: profileError } = await supabaseAdmin
                .from("profiles")
                .update({ avatar_url: preset.dataUrl })
                .eq("id", userId);

              if (profileError) throw profileError;

              return json({ avatar_url: preset.dataUrl });
            }

            const avatarDataUrl = typeof body?.avatarDataUrl === "string" ? body.avatarDataUrl : "";

            if (!AVATAR_DATA_URL_PATTERN.test(avatarDataUrl)) {
              return json({ error: "Поддерживаются PNG или JPG" }, 400);
            }

            if (avatarDataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
              return json({ error: "Фото слишком большое. Попробуйте другое изображение" }, 400);
            }

            const { error: profileError } = await supabaseAdmin
              .from("profiles")
              .update({ avatar_url: avatarDataUrl })
              .eq("id", userId);

            if (profileError) throw profileError;

            return json({ avatar_url: avatarDataUrl });
          }

          const formData = await request.formData();
          const avatar = formData.get("avatar");

          if (!(avatar instanceof File)) {
            return json({ error: "Выберите фото для загрузки" }, 400);
          }

          if (!ALLOWED_AVATAR_TYPES.has(avatar.type)) {
            return json({ error: "Поддерживаются PNG или JPG" }, 400);
          }

          if (avatar.size > MAX_AVATAR_SIZE) {
            return json({ error: "Фото должно быть до 2 МБ" }, 400);
          }

          const avatarBuffer = Buffer.from(await avatar.arrayBuffer());
          if (!hasExpectedImageSignature(avatarBuffer, avatar.type)) {
            return json({ error: "Файл не похож на изображение PNG или JPG" }, 400);
          }

          const path = `${userId}/avatar`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from(AVATARS_BUCKET)
            .upload(path, avatarBuffer, {
              cacheControl: "3600",
              contentType: avatar.type,
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const avatarUrl = `/api/avatar?userId=${encodeURIComponent(userId)}&v=${Date.now()}`;
          const { error: profileError } = await supabaseAdmin
            .from("profiles")
            .update({ avatar_url: avatarUrl })
            .eq("id", userId);

          if (profileError) throw profileError;

          return json({ avatar_url: avatarUrl });
        } catch (error) {
          console.error("[avatar] upload failed", error);
          return json(
            { error: error instanceof Error ? error.message : "Не удалось загрузить фото" },
            500,
          );
        }
      },
    },
  },
});

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

function hasExpectedImageSignature(file: Buffer, contentType: string) {
  if (contentType === "image/png") {
    return (
      file.length >= 8 && file.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  }

  return (
    contentType === "image/jpeg" &&
    file.length >= 3 &&
    file[0] === 0xff &&
    file[1] === 0xd8 &&
    file[2] === 0xff
  );
}

async function canReadAvatar(requesterId: string, avatarOwnerId: string, accessToken: string) {
  if (requesterId === avatarOwnerId) return true;

  const requesterRoles = await getRolesForAccessToken(accessToken);
  if (requesterRoles.includes("admin")) return true;

  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", avatarOwnerId)
    .eq("role", "admin")
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

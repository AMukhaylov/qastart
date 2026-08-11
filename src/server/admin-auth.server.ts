import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AppRole = "admin" | "student";

const VALID_ROLES: AppRole[] = ["admin", "student"];
const DEFAULT_AUTH_ATTEMPTS = 4;

function isAppRole(role: string): role is AppRole {
  return VALID_ROLES.includes(role as AppRole);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getUserIdForAccessToken(
  accessToken: string,
  attempts = DEFAULT_AUTH_ATTEMPTS,
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken);
    const userId = userData.user?.id;

    if (!userError && userId) return userId;

    lastError = userError ?? new Error("Не удалось проверить токен доступа");
    if (attempt < attempts) await wait(Math.min(700 * attempt, 3500));
  }

  throw lastError instanceof Error ? lastError : new Error("Не удалось проверить токен доступа");
}

export async function getRolesForAccessToken(
  accessToken: string,
  attempts = 8,
): Promise<AppRole[]> {
  const userId = await getUserIdForAccessToken(accessToken);

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!error) {
      return (data ?? [])
        .map((row) => row.role)
        .filter((role): role is AppRole => typeof role === "string" && isAppRole(role));
    }

    lastError = error;
    if (attempt < attempts) await wait(Math.min(700 * attempt, 3500));
  }

  throw lastError instanceof Error ? lastError : new Error("Не удалось проверить права доступа");
}

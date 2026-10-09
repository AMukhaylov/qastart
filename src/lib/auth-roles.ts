import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserRoles } from "@/server/admin-auth.functions";

export type AppRole = "admin" | "student";

const VALID_ROLES: AppRole[] = ["admin", "student"];

function isAppRole(role: string): role is AppRole {
  return VALID_ROLES.includes(role as AppRole);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function fetchUserRolesWithRetry(userId: string, attempts = 5): Promise<AppRole[]> {
  return fetchUserRoles(userId, attempts);
}

export async function fetchUserRoles(
  userId: string,
  attempts = 5,
  explicitAccessToken?: string,
): Promise<AppRole[]> {
  let lastError: unknown;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = explicitAccessToken ?? sessionData.session?.access_token;
  if (accessToken && (explicitAccessToken || sessionData.session?.user.id === userId)) {
    try {
      // The user's own roles are readable under RLS. Querying Supabase directly
      // avoids an extra browser -> app server -> Supabase Auth/DB round trip on
      // every login and refresh. Keep the server function as a fallback.
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (!error) {
        return (data ?? [])
          .map((row) => row.role)
          .filter((role): role is AppRole => typeof role === "string" && isAppRole(role));
      }
    } catch (error) {
      lastError = error;
    }

    try {
      return await getCurrentUserRoles({ data: { accessToken } });
    } catch (error) {
      lastError = error;
    }
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    if (!error) {
      return (data ?? [])
        .map((row) => row.role)
        .filter((role): role is AppRole => typeof role === "string" && isAppRole(role));
    }

    lastError = error;
    if (attempt < attempts) await wait(450 * attempt);
  }

  throw lastError instanceof Error ? lastError : new Error("Не удалось проверить права доступа");
}

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "student";

const VALID_ROLES: AppRole[] = ["admin", "student"];

function isAppRole(role: string): role is AppRole {
  return VALID_ROLES.includes(role as AppRole);
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function fetchUserRolesWithRetry(userId: string, attempts = 5): Promise<AppRole[]> {
  let lastError: unknown;

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
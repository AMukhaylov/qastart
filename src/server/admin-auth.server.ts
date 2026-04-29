import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = "admin" | "student";

const VALID_ROLES: AppRole[] = ["admin", "student"];

function isAppRole(role: string): role is AppRole {
  return VALID_ROLES.includes(role as AppRole);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) throw new Error("Backend auth is not configured");

  return createClient<Database>(supabaseUrl, publishableKey, {
    auth: {
      storage: undefined,
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function getRolesForAccessToken(accessToken: string, attempts = 8): Promise<AppRole[]> {
  const authClient = createAuthClient();
  const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(accessToken);
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return [];

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const { data, error } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);

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
import { readFileSync } from "node:fs";

const envPath = "/var/www/qastart/.env";
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const separator = line.indexOf("=");
      if (separator < 1) return ["", ""];

      const key = line.slice(0, separator).trim();
      const value = line
        .slice(separator + 1)
        .trim()
        .replace(/^(['"])(.*)\1$/, "$2");
      return [key, value];
    })
    .filter(([key]) => key),
);

const supabaseUrl = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Supabase server credentials are not configured");
}

const response = await fetch(`${supabaseUrl}/rest/v1/lessons?select=id&limit=1`, {
  headers: {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
  },
  signal: AbortSignal.timeout(15_000),
});

if (!response.ok) {
  throw new Error(`Supabase keep-alive query failed with HTTP ${response.status}`);
}

console.log(`Supabase read-only keep-alive query succeeded at ${new Date().toISOString()}`);

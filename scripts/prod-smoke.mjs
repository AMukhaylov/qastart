import { readFileSync, existsSync } from "node:fs";

const env = loadEnvFile();
const baseUrl = stripTrailingSlash(
  process.env.SMOKE_BASE_URL ?? env.SMOKE_BASE_URL ?? "https://startqa.ru",
);
const publishableKey =
  process.env.SMOKE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  env.SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey =
  process.env.SMOKE_SUPABASE_SERVICE_ROLE_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  env.SUPABASE_SERVICE_ROLE_KEY;
const expectedBrowserSupabaseUrl =
  process.env.SMOKE_EXPECTED_BROWSER_SUPABASE_URL ?? "https://startqa.ru/supabase";
const oldSupabaseRefs = ["utrimncqlzfbvocvednd"];

const checks = [
  ["Главная", () => expectHtml("/")],
  ["Вход", () => expectHtml("/auth")],
  ["Админ-вход", () => expectHtml("/admin/login")],
  ["OAuth callback route", () => expectHtml("/auth/callback")],
  ["Политика", () => expectHtml("/privacy")],
  ["Оферта", () => expectHtml("/offer")],
  ["Контакты", () => expectHtml("/contacts")],
  ["Фронтовый Supabase URL", () => expectClientBundleConfig()],
  ["Supabase Auth proxy", () => expectSupabase("/supabase/auth/v1/settings", [200])],
  [
    "Supabase REST proxy",
    () => expectSupabase("/supabase/rest/v1/lessons?select=id&limit=1", [200, 401, 403]),
  ],
  ["Storage bucket для вложений", () => expectStorageBucket("homework-attachments")],
];

let failed = false;

for (const [name, run] of checks) {
  try {
    const result = await run();
    console.log(`OK ${name}: ${result}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL ${name}: ${error.message}`);
  }
}

if (failed) process.exit(1);

async function expectHtml(path) {
  const response = await fetchWithTimeout(`${baseUrl}${path}`);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  if (!/text\/html/i.test(response.headers.get("content-type") ?? "")) {
    throw new Error(`ожидался HTML, получен ${response.headers.get("content-type") ?? "unknown"}`);
  }

  if (!text.includes("<!DOCTYPE html>") && !text.includes("<html")) {
    throw new Error("ответ не похож на HTML-страницу");
  }

  return `HTTP ${response.status}`;
}

async function expectSupabase(path, okStatuses) {
  if (!publishableKey) {
    throw new Error("не найден SUPABASE_PUBLISHABLE_KEY или VITE_SUPABASE_PUBLISHABLE_KEY");
  }

  const response = await fetchWithTimeout(`${baseUrl}${path}`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${publishableKey}`,
    },
  });

  await response.arrayBuffer();

  if (!okStatuses.includes(response.status)) {
    throw new Error(`HTTP ${response.status}`);
  }

  return `HTTP ${response.status}`;
}

async function expectStorageBucket(bucketId) {
  if (!serviceRoleKey) {
    return "SKIP: не найден SUPABASE_SERVICE_ROLE_KEY";
  }

  const response = await fetchWithTimeout(`${baseUrl}/supabase/storage/v1/bucket/${bucketId}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 160)}`);
  }

  const bucket = JSON.parse(text);
  if (bucket.id !== bucketId) throw new Error(`не тот bucket: ${bucket.id ?? "unknown"}`);
  if (bucket.public !== false) throw new Error("bucket должен быть приватным");

  return `HTTP ${response.status}`;
}

async function expectClientBundleConfig() {
  const htmlResponse = await fetchWithTimeout(`${baseUrl}/auth`);
  const html = await htmlResponse.text();
  if (!htmlResponse.ok) throw new Error(`HTML HTTP ${htmlResponse.status}`);

  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+\.js)"[^>]*>/g)].map((match) =>
    match[1].startsWith("http") ? match[1] : `${baseUrl}${match[1]}`,
  );
  const preloads = [...html.matchAll(/<link[^>]+href="([^"]+\.js)"[^>]*>/g)].map((match) =>
    match[1].startsWith("http") ? match[1] : `${baseUrl}${match[1]}`,
  );
  const entryUrls = [...new Set([...scripts, ...preloads])];
  if (entryUrls.length === 0) throw new Error("не найдены client JS bundles");

  const sources = await fetchClientJsGraph(entryUrls);
  const combined = sources.join("\n");

  if (!combined.includes(expectedBrowserSupabaseUrl)) {
    throw new Error(`в client bundle не найден ${expectedBrowserSupabaseUrl}`);
  }

  for (const ref of oldSupabaseRefs) {
    if (combined.includes(ref)) {
      throw new Error(`в client bundle остался старый Supabase ref ${ref}`);
    }
  }

  return expectedBrowserSupabaseUrl;
}

async function fetchClientJsGraph(entryUrls) {
  const pending = [...entryUrls];
  const seen = new Set();
  const sources = [];

  while (pending.length > 0) {
    const scriptUrl = pending.pop();
    if (!scriptUrl || seen.has(scriptUrl)) continue;
    seen.add(scriptUrl);

    const response = await fetchWithTimeout(scriptUrl);
    if (!response.ok) throw new Error(`${scriptUrl}: HTTP ${response.status}`);

    const source = await response.text();
    sources.push(source);

    for (const match of source.matchAll(/["']((?:\.{1,2}\/|\/)[^"']+\.js)["']/g)) {
      pending.push(new URL(match[1], scriptUrl).href);
    }
  }

  return sources;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error.name === "AbortError") throw new Error("таймаут 15 секунд");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function loadEnvFile() {
  if (!existsSync(".env")) return {};

  const values = {};
  const source = readFileSync(".env", "utf8");

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;

    const [, key, rawValue] = match;
    values[key] = rawValue.trim().replace(/^["']|["']$/g, "");
  }

  return values;
}

function stripTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

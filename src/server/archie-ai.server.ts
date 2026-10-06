import {
  ARCHIE_PROVIDER_DEFAULTS,
  DEFAULT_ARCHIE_SETTINGS,
  type ArchieModelOption,
  type ArchieProviderId,
} from "@/lib/archie";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { decryptProviderKey, encryptProviderKey, maskProviderKey } from "./archie-crypto.server";

type SettingsRow = {
  id: boolean;
  enabled: boolean;
  name: string;
  subtitle: string;
  welcome_message: string;
  system_prompt: string;
  max_message_length: number;
  max_history_messages: number;
  rate_limit_per_minute: number;
  timeout_ms: number;
  quick_actions_enabled: boolean;
  provider: string;
  base_url: string;
  model: string;
  connection_status: "unknown" | "connected" | "error";
  connection_checked_at: string | null;
  connection_error: string;
  encrypted_api_key: string | null;
  api_key_mask: string;
  updated_at: string;
};

export type ArchiePublicSettings = typeof DEFAULT_ARCHIE_SETTINGS;
export type ArchieSettingsPatch = Omit<
  SettingsRow,
  | "id"
  | "encrypted_api_key"
  | "api_key_mask"
  | "updated_at"
  | "connection_status"
  | "connection_checked_at"
  | "connection_error"
>;

export const encryptApiKey = encryptProviderKey;
export const decryptApiKey = decryptProviderKey;

export function providerBaseUrl(provider: ArchieProviderId, configured?: string) {
  const raw = configured?.trim() || ARCHIE_PROVIDER_DEFAULTS[provider].baseUrl;
  const url = new URL(raw);
  if (!(["https:", "http:"] as string[]).includes(url.protocol)) {
    throw new Error("AI provider URL must use HTTP or HTTPS");
  }
  return url.toString().replace(/\/$/, "");
}

export async function loadArchieSettings(): Promise<SettingsRow> {
  const { data, error } = await supabaseAdmin
    .from("archie_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Арчи не настроен: сначала примените миграцию базы данных");
  return data as SettingsRow;
}

export function toPublicSettings(row: SettingsRow): ArchiePublicSettings {
  return {
    enabled: row.enabled,
    name: row.name,
    subtitle: row.subtitle,
    welcomeMessage: row.welcome_message,
    systemPrompt: row.system_prompt,
    maxMessageLength: row.max_message_length,
    maxHistoryMessages: row.max_history_messages,
    rateLimitPerMinute: row.rate_limit_per_minute,
    timeoutMs: row.timeout_ms,
    quickActionsEnabled: row.quick_actions_enabled,
    provider: row.provider as ArchieProviderId,
    baseUrl: row.base_url,
    model: row.model,
    apiKeyConfigured: Boolean(row.encrypted_api_key),
    apiKeyMask: row.api_key_mask,
    connectionStatus: row.connection_status,
    connectionCheckedAt: row.connection_checked_at,
    connectionError: row.connection_error,
  };
}

export async function saveArchieSettings(
  patch: ArchieSettingsPatch,
  encryptedApiKey: string | null | undefined,
  apiKeyMask: string | undefined,
  adminUserId: string,
) {
  const previous = await loadArchieSettings();
  const next = {
    id: true,
    ...patch,
    base_url: providerBaseUrl(patch.provider as ArchieProviderId, patch.base_url),
    encrypted_api_key:
      encryptedApiKey === null ? null : (encryptedApiKey ?? previous.encrypted_api_key),
    api_key_mask: encryptedApiKey === null ? "" : (apiKeyMask ?? previous.api_key_mask),
    connection_status: "unknown" as const,
    connection_checked_at: null,
    connection_error: "",
    updated_by: adminUserId,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabaseAdmin
    .from("archie_settings")
    .upsert(next)
    .select("*")
    .single();
  if (error) throw error;
  return toPublicSettings(data as SettingsRow);
}

export async function saveConnectionStatus(status: "connected" | "error", message: string) {
  const { error } = await supabaseAdmin
    .from("archie_settings")
    .update({
      connection_status: status,
      connection_checked_at: new Date().toISOString(),
      connection_error: status === "error" ? message.slice(0, 300) : "",
    })
    .eq("id", true);
  if (error) throw error;
}

function modelEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/models`;
}

function chatEndpoint(baseUrl: string) {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function parseModelOptions(provider: ArchieProviderId, data: unknown): ArchieModelOption[] {
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as { data?: unknown }).data)
  )
    return [];
  return ((data as { data: unknown[] }).data as Array<Record<string, unknown>>)
    .filter((model) => typeof model.id === "string")
    .map((model) => {
      const pricing =
        typeof model.pricing === "object" && model.pricing !== null
          ? (model.pricing as Record<string, unknown>)
          : null;
      const prompt = pricing?.prompt;
      const completion = pricing?.completion;
      const free =
        typeof prompt === "string" &&
        Number(prompt) === 0 &&
        typeof completion === "string" &&
        Number(completion) === 0;
      return {
        id: model.id as string,
        name: typeof model.name === "string" ? model.name : (model.id as string),
        ...(provider === "openrouter" ? { free, pricing: formatPricing(prompt, completion) } : {}),
      };
    })
    .sort(
      (a, b) => Number(Boolean(b.free)) - Number(Boolean(a.free)) || a.name.localeCompare(b.name),
    );
}

function formatPricing(prompt: unknown, completion: unknown) {
  if (typeof prompt !== "string" || typeof completion !== "string") return null;
  if (Number(prompt) === 0 && Number(completion) === 0) return "Бесплатно";
  const input = Number(prompt);
  const output = Number(completion);
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null;
  return `Вход $${input}/токен · выход $${output}/токен`;
}

async function readResponse(response: Response) {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { body, text };
}

export async function fetchProviderModels(
  provider: ArchieProviderId,
  baseUrl: string,
  apiKey: string,
  timeoutMs: number,
) {
  const response = await fetch(modelEndpoint(providerBaseUrl(provider, baseUrl)), {
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`AI provider models endpoint returned ${response.status}`);
  const { body } = await readResponse(response);
  return parseModelOptions(provider, body);
}

export type AICompletion = {
  content: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
};

export async function generateAIAnswer(input: {
  provider: ArchieProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  timeoutMs: number;
}): Promise<AICompletion> {
  const response = await fetch(chatEndpoint(providerBaseUrl(input.provider, input.baseUrl)), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      ...(input.provider === "openrouter"
        ? { "HTTP-Referer": "https://startqa.ru", "X-Title": "QA Start Archie" }
        : {}),
    },
    body: JSON.stringify({
      model: input.model,
      messages: input.messages,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  if (!response.ok) throw new Error(`AI provider chat endpoint returned ${response.status}`);
  const { body } = await readResponse(response);
  if (typeof body !== "object" || body === null)
    throw new Error("AI provider returned invalid JSON");
  const data = body as {
    choices?: Array<{ message?: { content?: unknown } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim())
    throw new Error("AI provider returned an empty answer");
  const inputTokens = data.usage?.prompt_tokens ?? data.usage?.input_tokens;
  const outputTokens = data.usage?.completion_tokens ?? data.usage?.output_tokens;
  return {
    content,
    inputTokens: Number.isInteger(inputTokens) ? inputTokens! : null,
    outputTokens: Number.isInteger(outputTokens) ? outputTokens! : null,
    totalTokens: Number.isInteger(data.usage?.total_tokens)
      ? data.usage!.total_tokens!
      : Number.isInteger(inputTokens) && Number.isInteger(outputTokens)
        ? inputTokens! + outputTokens!
        : null,
  };
}

export async function testAIConnection(input: {
  provider: ArchieProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
}) {
  if (!input.model.trim()) throw new Error("Сначала выберите ID модели");
  const result = await generateAIAnswer({
    ...input,
    messages: [
      { role: "system", content: "Return a JSON object with type and answer fields." },
      { role: "user", content: "Ответь коротко: подключение работает." },
    ],
  });
  return { connected: true, model: input.model, response: result.content.slice(0, 500) };
}

export async function recordArchieRequest(input: {
  userId: string | null;
  lessonId: string | null;
  provider: string;
  model: string;
  status: "success" | "error";
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
}) {
  const { error } = await supabaseAdmin.from("archie_request_stats").insert({
    user_id: input.userId,
    lesson_id: input.lessonId,
    provider: input.provider,
    model: input.model,
    status: input.status,
    input_tokens: input.inputTokens ?? null,
    output_tokens: input.outputTokens ?? null,
    total_tokens: input.totalTokens ?? null,
  });
  if (error) throw error;
}

export async function getArchieStats() {
  const now = Date.now();
  const moscowNow = new Date(now + 3 * 60 * 60 * 1000);
  moscowNow.setUTCHours(0, 0, 0, 0);
  const todayStart = new Date(moscowNow.getTime() - 3 * 60 * 60 * 1000).toISOString();
  const weekStart = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from("archie_request_stats")
    .select("status,input_tokens,output_tokens,total_tokens,created_at")
    .gte("created_at", weekStart)
    .order("created_at", { ascending: false })
    .limit(10000);
  if (error) throw error;
  const rows = data ?? [];
  const aggregate = (items: typeof rows) => ({
    requests: items.length,
    errors: items.filter((row) => row.status === "error").length,
    inputTokens: items.reduce((sum, row) => sum + (row.input_tokens ?? 0), 0),
    outputTokens: items.reduce((sum, row) => sum + (row.output_tokens ?? 0), 0),
    totalTokens: items.reduce((sum, row) => sum + (row.total_tokens ?? 0), 0),
  });
  return {
    today: aggregate(rows.filter((row) => row.created_at >= todayStart)),
    last7Days: aggregate(rows),
  };
}

export function createApiKeyMask(value: string) {
  return maskProviderKey(value.trim());
}

export function encryptAPIKey(value: string) {
  return encryptApiKey(value.trim());
}

export function decryptAPIKey(value: string) {
  return decryptApiKey(value);
}

export type { ArchieModelOption };

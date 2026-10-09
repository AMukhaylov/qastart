import { useCallback, useEffect, useId, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wifi,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  getArchieAdminData,
  listArchieProviderModels,
  testArchieLessonAnswer,
  testArchieProviderConnection,
  updateArchieAdminSettings,
  updateArchieMainSettings,
} from "@/server/archie.functions";
import {
  ARCHIE_MOTIVATION_MESSAGE_CATEGORIES,
  ARCHIE_MOTIVATION_MESSAGE_LABELS,
  ARCHIE_PROVIDER_DEFAULTS,
  normalizeArchieGreetingMessages,
  parseArchieModelOptions,
  type ArchieModelOption,
  type ArchieProviderId,
} from "@/lib/archie";

type Data = Awaited<ReturnType<typeof getArchieAdminData>>;
type Settings = Data["settings"];
type Lesson = Data["lessons"][number];

const inputClass = "mt-1.5";

function usePersistentSectionExpanded(userId: string, section: string) {
  const [expanded, setExpanded] = useState(true);
  const [loadedPreferenceKey, setLoadedPreferenceKey] = useState<string | null>(null);
  const preferenceKey = `qastart:admin-archie:v1:${userId}:${section}`;

  useEffect(() => {
    let nextExpanded = true;
    try {
      nextExpanded = window.localStorage.getItem(preferenceKey) !== "false";
    } catch {
      // Keep the section usable if browser storage is unavailable.
    }
    setExpanded(nextExpanded);
    setLoadedPreferenceKey(preferenceKey);
  }, [preferenceKey]);

  useEffect(() => {
    if (loadedPreferenceKey !== preferenceKey) return;
    try {
      window.localStorage.setItem(preferenceKey, String(expanded));
    } catch {
      // The control still works for this visit if browser storage is unavailable.
    }
  }, [expanded, loadedPreferenceKey, preferenceKey]);

  return [expanded, setExpanded] as const;
}

export function AdminArchiePanel() {
  const { session, isAdmin } = useAuth();
  const [data, setData] = useState<Data | null>(null);
  const [form, setForm] = useState<Settings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [removeApiKey, setRemoveApiKey] = useState(false);
  const [models, setModels] = useState<ArchieModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMain, setSavingMain] = useState(false);
  const [savingProvider, setSavingProvider] = useState(false);
  const [checking, setChecking] = useState(false);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [testType, setTestType] = useState("");
  const [connectionMessage, setConnectionMessage] = useState("");
  const [mainSettingsExpanded, setMainSettingsExpanded] = usePersistentSectionExpanded(
    session?.user.id ?? "admin",
    "main-settings",
  );
  const [motivationExpanded, setMotivationExpanded] = usePersistentSectionExpanded(
    session?.user.id ?? "admin",
    "motivation",
  );
  const [providerExpanded, setProviderExpanded] = usePersistentSectionExpanded(
    session?.user.id ?? "admin",
    "provider",
  );
  const mainSettingsContentId = useId();
  const motivationContentId = useId();
  const providerContentId = useId();
  const [connectionOk, setConnectionOk] = useState<boolean | null>(null);
  const [testQuestion, setTestQuestion] = useState("");
  const [testLessonId, setTestLessonId] = useState("");

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const next = await getArchieAdminData({ data: { accessToken: session.access_token } });
      setData(next);
      setForm(next.settings);
      setTestLessonId((current) => current || next.lessons[0]?.id || "");
    } catch {
      toast.error("Не удалось загрузить настройки Арчи");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
    setConnectionMessage("");
    setConnectionOk(null);
  }

  async function save() {
    if (!session?.access_token || !form) return;
    setSavingProvider(true);
    try {
      const settings = await updateArchieAdminSettings({
        data: {
          accessToken: session.access_token,
          enabled: data?.settings.enabled ?? form.enabled,
          name: data?.settings.name ?? form.name,
          subtitle: data?.settings.subtitle ?? form.subtitle,
          // Keep the legacy single welcome field in sync for older clients.
          welcomeMessage: normalizeArchieGreetingMessages(
            data?.settings.greetingMessages ?? form.greetingMessages,
          )[0],
          greetingMessages: data?.settings.greetingMessages ?? form.greetingMessages,
          motivationMessages: data?.settings.motivationMessages ?? form.motivationMessages,
          systemPrompt: data?.settings.systemPrompt ?? form.systemPrompt,
          maxMessageLength: data?.settings.maxMessageLength ?? form.maxMessageLength,
          maxHistoryMessages: data?.settings.maxHistoryMessages ?? form.maxHistoryMessages,
          rateLimitPerMinute: data?.settings.rateLimitPerMinute ?? form.rateLimitPerMinute,
          timeoutMs: data?.settings.timeoutMs ?? form.timeoutMs,
          quickActionsEnabled: data?.settings.quickActionsEnabled ?? form.quickActionsEnabled,
          provider: form.provider,
          baseUrl: form.baseUrl,
          model: form.model,
          apiKey: apiKey || undefined,
          removeApiKey,
        },
      });
      setForm(settings);
      setApiKey("");
      setRemoveApiKey(false);
      setData((current) => (current ? { ...current, settings } : current));
      toast.success("Настройки провайдера Арчи сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      setSavingProvider(false);
    }
  }

  async function saveMainSettings() {
    if (!session?.access_token || !form) return;
    setSavingMain(true);
    try {
      const settings = await updateArchieMainSettings({
        data: {
          accessToken: session.access_token,
          enabled: form.enabled,
          name: form.name,
          subtitle: form.subtitle,
          welcomeMessage: normalizeArchieGreetingMessages(form.greetingMessages)[0],
          greetingMessages: form.greetingMessages,
          motivationMessages: form.motivationMessages,
          systemPrompt: form.systemPrompt,
          maxMessageLength: form.maxMessageLength,
          maxHistoryMessages: form.maxHistoryMessages,
          rateLimitPerMinute: form.rateLimitPerMinute,
          timeoutMs: form.timeoutMs,
          quickActionsEnabled: form.quickActionsEnabled,
        },
      });
      setData((current) => (current ? { ...current, settings } : current));
      setForm((current) =>
        current
          ? {
              ...current,
              enabled: settings.enabled,
              name: settings.name,
              subtitle: settings.subtitle,
              welcomeMessage: settings.welcomeMessage,
              greetingMessages: settings.greetingMessages,
              motivationMessages: settings.motivationMessages,
              systemPrompt: settings.systemPrompt,
              maxMessageLength: settings.maxMessageLength,
              maxHistoryMessages: settings.maxHistoryMessages,
              rateLimitPerMinute: settings.rateLimitPerMinute,
              timeoutMs: settings.timeoutMs,
              quickActionsEnabled: settings.quickActionsEnabled,
            }
          : current,
      );
      toast.success("Основные настройки Арчи сохранены");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить основные настройки",
      );
    } finally {
      setSavingMain(false);
    }
  }

  async function fetchModels() {
    if (!session?.access_token || !form) return;
    setLoadingModels(true);
    try {
      let result: ArchieModelOption[];
      if (form.provider === "openrouter") {
        // OpenRouter blocks catalog requests from some server IP ranges. Its
        // model list is public and CORS-enabled, so fetch it from the browser
        // without sending any credentials or other secret data.
        const baseUrl = new URL(form.baseUrl);
        if (baseUrl.protocol !== "https:" || baseUrl.hostname !== "openrouter.ai") {
          throw new Error("Для OpenRouter укажи официальный HTTPS Base URL.");
        }
        const modelsUrl = new URL(`${form.baseUrl.replace(/\/$/, "")}/models`);
        // Archie only uses text chat models. Asking OpenRouter to filter out
        // image/audio/embedding models makes the catalog response smaller and
        // faster to download and render in the admin panel.
        modelsUrl.searchParams.set("output_modalities", "text");
        const response = await fetch(modelsUrl, {
          mode: "cors",
          credentials: "omit",
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(data?.settings.timeoutMs ?? 25000),
        });
        if (!response.ok) {
          throw new Error(`OpenRouter не вернул список моделей (HTTP ${response.status}).`);
        }
        result = parseArchieModelOptions("openrouter", await response.json());
      } else {
        result = await listArchieProviderModels({
          data: {
            accessToken: session.access_token,
            provider: form.provider,
            baseUrl: form.baseUrl,
            apiKey: apiKey || undefined,
          },
        });
      }
      setModels(result);
      if (result.length === 0)
        toast.message("Провайдер не вернул список моделей — введи ID вручную.");
      else toast.success(`Загружено моделей: ${result.length}`);
    } catch (error) {
      if (error instanceof TypeError) {
        toast.error("Не удалось подключиться к OpenRouter из браузера", {
          description:
            "Проверь блокировщик рекламы или доступ к openrouter.ai. Пока можно ввести ID модели вручную.",
        });
      } else {
        toast.error(error instanceof Error ? error.message : "Не удалось загрузить модели");
      }
    } finally {
      setLoadingModels(false);
    }
  }

  async function checkConnection() {
    if (!session?.access_token || !form) return;
    setChecking(true);
    try {
      const result = await testArchieProviderConnection({
        data: {
          accessToken: session.access_token,
          provider: form.provider,
          baseUrl: form.baseUrl,
          model: form.model,
          apiKey: apiKey || undefined,
        },
      });
      setConnectionOk(true);
      setConnectionMessage(
        result.persistedStatus
          ? `Работает · проверено ${new Date().toLocaleString("ru-RU")}`
          : "Проверка прошла для текущих данных. Сохрани их, чтобы Арчи начал их использовать.",
      );
      toast.success(`Подключение работает: ${result.provider} · ${result.model}`);
    } catch (error) {
      setConnectionOk(false);
      setConnectionMessage("Не удалось подключиться. Проверь провайдера, модель и API Key.");
      toast.error(error instanceof Error ? error.message : "Не удалось проверить подключение");
    } finally {
      setChecking(false);
    }
  }

  async function testArchie() {
    if (!session?.access_token || !form || !testLessonId || !testQuestion.trim()) return;
    setTesting(true);
    setTestResult("");
    setTestType("");
    try {
      const result = await testArchieLessonAnswer({
        data: {
          accessToken: session.access_token,
          lessonId: testLessonId,
          message: testQuestion,
          provider: form.provider,
          baseUrl: form.baseUrl,
          model: form.model,
          systemPrompt: form.systemPrompt,
          timeoutMs: form.timeoutMs,
          apiKey: apiKey || undefined,
        },
      });
      setTestResult(result.answer);
      setTestType(`${result.type} · ${result.provider} · ${result.model}`);
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : "Не удалось проверить Арчи");
      setTestType("Ошибка");
    } finally {
      setTesting(false);
    }
  }

  function selectProvider(provider: ArchieProviderId) {
    const baseUrl = ARCHIE_PROVIDER_DEFAULTS[provider].baseUrl;
    update("provider", provider);
    update("baseUrl", baseUrl);
    update("model", "");
    setModels([]);
  }

  if (loading || !form || !data) {
    return (
      <div className="flex min-h-64 items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Загружаем настройки Арчи…
      </div>
    );
  }

  const today = data.stats.today;
  const week = data.stats.last7Days;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">
            Арчи, помощник курса
          </h1>
          <p className="mt-1 text-muted-foreground">
            Настройка помощника, AI-подключения и тестирование ответов.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="h-4 w-4" /> Обновить
        </Button>
      </div>

      {!data.encryptionReady && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Не настроен ключ шифрования.</strong> Добавь серверный{" "}
          <code>ARCHIE_ENCRYPTION_KEY</code> длиной не менее 32 символов и перезапусти приложение.
          Пока он не задан, API Key нельзя сохранить.
        </div>
      )}

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Основные настройки</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Система всегда сохраняет базовые правила безопасности и приватности.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={mainSettingsExpanded}
            aria-controls={mainSettingsContentId}
            aria-label={`${mainSettingsExpanded ? "Скрыть" : "Показать"} блок: основные настройки`}
            onClick={() => setMainSettingsExpanded((current) => !current)}
          >
            {mainSettingsExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {mainSettingsExpanded ? "Скрыть блок" : "Показать блок"}
          </Button>
        </div>
        <div id={mainSettingsContentId} hidden={!mainSettingsExpanded} className="mt-5 space-y-5">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => update("enabled", event.target.checked)}
              className="h-4 w-4 accent-primary"
            />{" "}
            Включить Арчи
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Имя помощника
              <Input
                className={inputClass}
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </label>
            <label className="text-sm font-semibold">
              Подпись
              <Input
                className={inputClass}
                value={form.subtitle}
                onChange={(event) => update("subtitle", event.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm font-semibold">
            Приветствия Арчи
            <Textarea
              className={inputClass}
              rows={4}
              value={form.greetingMessages.join("\n")}
              onChange={(event) =>
                update(
                  "greetingMessages",
                  event.target.value
                    .split("\n")
                    .map((message) => message.trim())
                    .filter(Boolean),
                )
              }
              aria-describedby="archie-greeting-messages-help"
            />
            <span
              id="archie-greeting-messages-help"
              className="mt-1 block text-xs font-normal text-muted-foreground"
            >
              По одной фразе на строку, максимум 8 фраз по 240 символов. При входе на урок выбранная
              фраза показывается рядом с кнопкой и становится первым сообщением Арчи в чате.
            </span>
          </label>
          <section className="rounded-xl border border-primary/10 bg-primary-soft/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold">Мотивация и достижения</h3>
                <p className="mt-1 text-xs font-normal text-muted-foreground">
                  Эти сообщения подготовлены заранее: они не отправляются в ИИ и не расходуют
                  токены. Несколько вариантов указывай по одному на строку.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                aria-expanded={motivationExpanded}
                aria-controls={motivationContentId}
                aria-label={`${motivationExpanded ? "Скрыть" : "Показать"} блок: мотивация и достижения`}
                onClick={() => setMotivationExpanded((current) => !current)}
              >
                {motivationExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {motivationExpanded ? "Скрыть блок" : "Показать блок"}
              </Button>
            </div>
            <div id={motivationContentId} hidden={!motivationExpanded} className="mt-4">
              <div className="grid gap-4 xl:grid-cols-2">
                {ARCHIE_MOTIVATION_MESSAGE_CATEGORIES.map((category) => (
                  <label key={category} className="block text-sm font-semibold">
                    {ARCHIE_MOTIVATION_MESSAGE_LABELS[category]}
                    <Textarea
                      className={inputClass}
                      rows={2}
                      value={form.motivationMessages[category].join("\n")}
                      onChange={(event) =>
                        update("motivationMessages", {
                          ...form.motivationMessages,
                          [category]: event.target.value
                            .split("\n")
                            .map((message) => message.trim())
                            .filter(Boolean),
                        })
                      }
                      aria-label={ARCHIE_MOTIVATION_MESSAGE_LABELS[category]}
                      placeholder="По одной фразе на строку"
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>
          <label className="block text-sm font-semibold">
            Дополнительные инструкции (system prompt)
            <Textarea
              className={inputClass}
              rows={5}
              value={form.systemPrompt}
              onChange={(event) => update("systemPrompt", event.target.value)}
            />
            <span className="mt-1 block text-xs font-normal text-muted-foreground">
              Базовые правила Арчи добавляются отдельно и не могут быть отменены этим текстом.
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-sm font-semibold">
              Максимум символов
              <Input
                className={inputClass}
                type="number"
                min={100}
                max={6000}
                value={form.maxMessageLength}
                onChange={(event) => update("maxMessageLength", Number(event.target.value))}
              />
            </label>
            <label className="text-sm font-semibold">
              Сообщений истории
              <Input
                className={inputClass}
                type="number"
                min={0}
                max={20}
                value={form.maxHistoryMessages}
                onChange={(event) => update("maxHistoryMessages", Number(event.target.value))}
              />
            </label>
            <label className="text-sm font-semibold">
              Запросов в минуту
              <Input
                className={inputClass}
                type="number"
                min={1}
                max={60}
                value={form.rateLimitPerMinute}
                onChange={(event) => update("rateLimitPerMinute", Number(event.target.value))}
              />
            </label>
            <label className="text-sm font-semibold">
              Timeout (мс)
              <Input
                className={inputClass}
                type="number"
                min={5000}
                max={60000}
                step={1000}
                value={form.timeoutMs}
                onChange={(event) => update("timeoutMs", Number(event.target.value))}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={form.quickActionsEnabled}
              onChange={(event) => update("quickActionsEnabled", event.target.checked)}
              className="h-4 w-4 accent-primary"
            />{" "}
            Показывать быстрые действия
          </label>
          <Button
            type="button"
            onClick={() => void saveMainSettings()}
            disabled={savingMain || savingProvider}
          >
            {savingMain ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Сохранить основные настройки
          </Button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">AI-провайдер</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ключ отправляется только серверу и хранится в базе в зашифрованном виде. Он никогда не
              возвращается в браузер.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            aria-expanded={providerExpanded}
            aria-controls={providerContentId}
            aria-label={`${providerExpanded ? "Скрыть" : "Показать"} блок: AI-провайдер`}
            onClick={() => setProviderExpanded((current) => !current)}
          >
            {providerExpanded ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {providerExpanded ? "Скрыть блок" : "Показать блок"}
          </Button>
        </div>
        <div id={providerContentId} hidden={!providerExpanded} className="mt-5 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Провайдер
              <select
                className={`h-10 w-full rounded-md border border-input bg-background px-3 ${inputClass}`}
                value={form.provider}
                onChange={(event) => selectProvider(event.target.value as ArchieProviderId)}
              >
                <option value="openrouter">OpenRouter</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="custom">Custom OpenAI-compatible</option>
              </select>
            </label>
            <label className="text-sm font-semibold">
              Base URL
              <Input
                className={inputClass}
                value={form.baseUrl}
                onChange={(event) => update("baseUrl", event.target.value)}
                placeholder="https://.../v1"
              />
            </label>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">
              API Key
              <Input
                className={inputClass}
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(event) => {
                  setApiKey(event.target.value);
                  setRemoveApiKey(false);
                }}
                placeholder={
                  form.apiKeyConfigured
                    ? `Сохранён ${form.apiKeyMask} · пустое поле оставит ключ`
                    : "Введите API Key"
                }
              />
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => void fetchModels()}
              disabled={
                loadingModels ||
                (form.provider !== "openrouter" && !apiKey && !form.apiKeyConfigured)
              }
            >
              {loadingModels ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}{" "}
              Загрузить модели
            </Button>
          </div>
          {form.apiKeyConfigured && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
              <span>
                Ключ настроен: <strong>{form.apiKeyMask}</strong>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  setRemoveApiKey(true);
                  setApiKey("");
                }}
              >
                {" "}
                <Trash2 className="h-4 w-4" /> Удалить ключ
              </Button>
            </div>
          )}
          {removeApiKey && (
            <p className="text-sm text-destructive">Ключ будет удалён при сохранении настроек.</p>
          )}
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-sm font-semibold">
              Модель
              {models.length ? (
                <select
                  className={`h-10 w-full rounded-md border border-input bg-background px-3 ${inputClass}`}
                  value={form.model}
                  onChange={(event) => update("model", event.target.value)}
                >
                  <option value="">Выбери модель</option>
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {model.id}
                      {model.free ? " · Бесплатно" : ""}
                      {model.pricing ? ` · ${model.pricing}` : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <Input
                  className={inputClass}
                  value={form.model}
                  onChange={(event) => update("model", event.target.value)}
                  placeholder="ID модели, например provider/model"
                />
              )}
            </label>
            <Button
              type="button"
              variant="outline"
              onClick={() => void checkConnection()}
              disabled={checking || !form.model}
            >
              {checking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wifi className="h-4 w-4" />
              )}{" "}
              Проверить подключение
            </Button>
          </div>
          <div
            className={`flex items-center gap-2 text-sm ${connectionOk === true || (connectionOk === null && form.connectionStatus === "connected") ? "text-emerald-700" : connectionOk === false || form.connectionStatus === "error" ? "text-destructive" : "text-muted-foreground"}`}
          >
            <ShieldCheck className="h-4 w-4" />
            {connectionMessage ||
              (form.connectionStatus === "connected"
                ? `Подключение работает · проверено ${form.connectionCheckedAt ? new Date(form.connectionCheckedAt).toLocaleString("ru-RU") : ""}`
                : form.connectionStatus === "error"
                  ? `Последняя проверка не прошла${form.connectionCheckedAt ? ` · ${new Date(form.connectionCheckedAt).toLocaleString("ru-RU")}` : ""}`
                  : form.apiKeyConfigured && form.model
                    ? `Настроено: ${form.provider} · ${form.model} · подключение ещё не проверено`
                    : "Провайдер требует API Key и ID модели")}
          </div>
          <Button
            onClick={() => void save()}
            disabled={savingMain || savingProvider || (!data.encryptionReady && !!apiKey)}
          >
            {savingProvider ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}{" "}
            Сохранить настройки провайдера
          </Button>
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-primary-soft p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Статистика Арчи</h2>
            <p className="text-sm text-muted-foreground">
              Учитываются только запросы и токены. Содержание диалогов не сохраняется.
            </p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            { label: "Сегодня · московское время", value: today },
            { label: "Последние 7 дней", value: week },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl bg-muted/60 p-4">
              <h3 className="font-semibold">{label}</h3>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <p>
                  Запросы: <strong>{value.requests}</strong>
                </p>
                <p>
                  Ошибки: <strong>{value.errors}</strong>
                </p>
                <p>
                  Входные токены: <strong>{value.inputTokens.toLocaleString("ru-RU")}</strong>
                </p>
                <p>
                  Выходные токены: <strong>{value.outputTokens.toLocaleString("ru-RU")}</strong>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div>
          <h2 className="text-lg font-bold">Тест Арчи</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ответ проверяется по безопасно собранному контексту выбранного урока; тест не сохраняет
            ученический диалог.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,240px)_1fr]">
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={testLessonId}
            onChange={(event) => setTestLessonId(event.target.value)}
          >
            {data.lessons.map((lesson: Lesson) => (
              <option key={lesson.id} value={lesson.id}>
                Урок {lesson.day_number} · {lesson.title}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Input
              value={testQuestion}
              onChange={(event) => setTestQuestion(event.target.value)}
              placeholder="Напиши вопрос по выбранному уроку"
              onKeyDown={(event) => {
                if (event.key === "Enter") void testArchie();
              }}
            />
            <Button
              onClick={() => void testArchie()}
              disabled={testing || !testQuestion.trim() || !testLessonId}
            >
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}{" "}
              Отправить
            </Button>
          </div>
        </div>
        {testResult && (
          <div className="rounded-xl bg-muted/60 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
              <CheckCircle2 className="h-4 w-4" /> {testType}
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{testResult}</p>
          </div>
        )}
      </section>
    </div>
  );
}

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";
import archieIdle from "@/assets/archie-idle-256.png";
import archieTyping from "@/assets/archie-typing-256.png";
import archieThinking from "@/assets/archie-thinking-256.png";
import archieResponding from "@/assets/archie-responding-256.png";
import archieError from "@/assets/archie-error-256.png";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getArchieForStudent, askArchie } from "@/server/archie.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ARCHIE_GREETING_MESSAGES,
  normalizeArchieGreetingMessages,
  type ArchieLessonMode,
  type ArchieMotivationEvent,
  type ArchieMotivationMessages,
  type ArchieAnswerType,
  type ArchieChatMessage,
} from "@/lib/archie";

type Message = ArchieChatMessage & {
  id: string;
  type?: ArchieAnswerType;
  pending?: boolean;
  error?: boolean;
};

const QUICK_ACTIONS = [
  { label: "Объясни проще", prompt: "Объясни проще, коротко и понятным языком." },
  { label: "Приведи пример", prompt: "Приведи небольшой пример по этой теме." },
  { label: "Дай подсказку", prompt: "Дай мне подсказку, но не раскрывай готовый ответ." },
  {
    label: "Проверь моё понимание",
    prompt: "Задай один короткий вопрос, чтобы проверить моё понимание.",
  },
];

const SOURCE_LABELS: Record<ArchieAnswerType, string> = {
  lesson: "📘 По материалам урока",
  additional: "💡 Дополнительно",
  off_topic: "↗ За рамками курса",
  hint: "Подсказка",
};

const ARCHIE_FACE_ASSETS = {
  idle: archieIdle,
  typing: archieTyping,
  thinking: archieThinking,
  responding: archieResponding,
  error: archieError,
} as const;

type ArchieFaceState = keyof typeof ARCHIE_FACE_ASSETS;

function getSeenEventKeys(studentId: string) {
  try {
    const value = window.localStorage.getItem(`archie-motivation-seen:${studentId}`);
    const parsed: unknown = value ? JSON.parse(value) : [];
    return new Set(
      Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === "string") : [],
    );
  } catch {
    return new Set<string>();
  }
}

function markEventSeen(studentId: string, key: string) {
  try {
    const seen = getSeenEventKeys(studentId);
    seen.add(key);
    window.localStorage.setItem(
      `archie-motivation-seen:${studentId}`,
      JSON.stringify([...seen].slice(-300)),
    );
  } catch {
    // The current visit still displays the event if browser storage is unavailable.
  }
}

function lockedModeMessage(mode: ArchieLessonMode, messages: ArchieMotivationMessages) {
  const category =
    mode === "homework-pending"
      ? "homeworkPending"
      : mode === "homework-approved"
        ? "homeworkApproved"
        : mode === "homework-returned"
          ? "homeworkReturned"
          : mode === "checked-exercise"
            ? "checkedExercise"
            : "homeworkDoing";
  return messages[category]?.[0] ?? "Я рядом и верю, что у тебя всё получится!";
}

function ArchieFace({ src, className }: { src: string; className: string }) {
  const currentSrcRef = useRef(src);
  const [displayedSrc, setDisplayedSrc] = useState(src);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (currentSrcRef.current === src) return;

    let cancelled = false;
    const preload = new Image();
    preload.src = src;

    const showLoadedImage = () => {
      if (cancelled) return;
      currentSrcRef.current = src;
      setDisplayedSrc(src);
    };

    if (preload.complete) {
      if (preload.naturalWidth > 0) showLoadedImage();
    } else if (typeof preload.decode === "function") {
      void preload
        .decode()
        .then(showLoadedImage)
        .catch(() => {
          // Keep the currently visible face if the next asset cannot be loaded.
        });
    } else {
      preload.onload = showLoadedImage;
      preload.onerror = () => {
        // Keep the currently visible face if the next asset cannot be loaded.
      };
    }

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <span aria-hidden="true" className={`block overflow-hidden ${className}`}>
      {!imageLoaded && (
        <span className="absolute inset-0 flex items-center justify-center bg-primary-soft text-primary">
          <Bot className="h-1/2 w-1/2" />
        </span>
      )}
      <img
        src={displayedSrc}
        alt=""
        className={`absolute inset-0 h-full w-full object-cover ${imageLoaded ? "" : "opacity-0"}`}
        onLoad={() => setImageLoaded(true)}
        onError={() => setImageLoaded(false)}
      />
    </span>
  );
}

export function ArchieChat({
  accessToken,
  lessonId,
  studentId,
  progressSignature,
  lessonCompleted,
}: {
  accessToken: string;
  lessonId: string;
  studentId: string;
  progressSignature: string;
  lessonCompleted: boolean;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  // Don't render the fallback greeting while the lesson-specific greeting is loading.
  const [greetingVisible, setGreetingVisible] = useState(false);
  const [greetingMessages, setGreetingMessages] = useState<string[]>([
    ...DEFAULT_ARCHIE_GREETING_MESSAGES,
  ]);
  const [greetingText, setGreetingText] = useState<string>(DEFAULT_ARCHIE_GREETING_MESSAGES[0]);
  const [greetingReady, setGreetingReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("Арчи");
  const [subtitle, setSubtitle] = useState("Помощник курса");
  const [maxLength, setMaxLength] = useState(1500);
  const [quickActionsEnabled, setQuickActionsEnabled] = useState(true);
  const [mode, setMode] = useState<ArchieLessonMode>("chat");
  const [motivationMessages, setMotivationMessages] = useState<ArchieMotivationMessages | null>(
    null,
  );
  const [motivationQueue, setMotivationQueue] = useState<ArchieMotivationEvent[]>([]);
  const [currentMotivation, setCurrentMotivation] = useState<ArchieMotivationEvent | null>(null);
  const [shouldHideWidget, setShouldHideWidget] = useState(false);
  const [lockedNotice, setLockedNotice] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [faceFeedbackState, setFaceFeedbackState] = useState<"responding" | "error" | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const initializingRef = useRef(false);
  const pendingOpenRef = useRef(false);
  const faceFeedbackTimeoutRef = useRef<number | null>(null);
  const motivationTimeoutRef = useRef<number | null>(null);
  const motivationQueueRef = useRef(motivationQueue);
  const hideAfterMotivationQueueRef = useRef(false);
  const previousProgressSignature = useRef(`${progressSignature}:${refreshTick}`);
  motivationQueueRef.current = motivationQueue;
  const lastMessage = messages[messages.length - 1];
  const faceState: ArchieFaceState = loading
    ? "thinking"
    : faceFeedbackState === "error"
      ? "error"
      : draft.trim().length > 0
        ? "typing"
        : (faceFeedbackState ?? "idle");

  const clearFaceFeedback = useCallback(() => {
    if (faceFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(faceFeedbackTimeoutRef.current);
      faceFeedbackTimeoutRef.current = null;
    }
    setFaceFeedbackState(null);
  }, []);

  const showFaceFeedback = useCallback(
    (state: "responding" | "error") => {
      clearFaceFeedback();
      setFaceFeedbackState(state);
      faceFeedbackTimeoutRef.current = window.setTimeout(
        () => {
          setFaceFeedbackState(null);
          faceFeedbackTimeoutRef.current = null;
        },
        state === "responding" ? 2200 : 2600,
      );
    },
    [clearFaceFeedback],
  );

  useEffect(
    () => () => {
      if (faceFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(faceFeedbackTimeoutRef.current);
      }
      if (motivationTimeoutRef.current !== null) window.clearTimeout(motivationTimeoutRef.current);
    },
    [],
  );
  useEffect(() => {
    if (panelOpen) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, panelOpen]);

  useEffect(() => {
    if (mode !== "chat") setPanelOpen(false);
  }, [mode]);

  useEffect(() => {
    if (!initialized || mode !== "chat" || !greetingVisible || panelOpen) return;
    const timeout = window.setTimeout(() => setGreetingVisible(false), 7500);
    return () => window.clearTimeout(timeout);
  }, [greetingVisible, initialized, mode, panelOpen]);

  useEffect(() => {
    if (!currentMotivation) return;
    setPanelOpen(false);
    setGreetingVisible(false);
    if (motivationTimeoutRef.current !== null) window.clearTimeout(motivationTimeoutRef.current);
    motivationTimeoutRef.current = window.setTimeout(
      () => {
        const dismissWidget = currentMotivation.dismissWidget;
        if (dismissWidget) hideAfterMotivationQueueRef.current = true;
        setCurrentMotivation(null);
        motivationTimeoutRef.current = null;
        if (hideAfterMotivationQueueRef.current && motivationQueueRef.current.length === 0) {
          setShouldHideWidget(true);
        }
      },
      currentMotivation.dismissWidget ? 6500 : 7500,
    );
    return () => {
      if (motivationTimeoutRef.current !== null) window.clearTimeout(motivationTimeoutRef.current);
    };
  }, [currentMotivation]);

  useEffect(() => {
    if (currentMotivation || greetingVisible || motivationQueue.length === 0) return;
    const [next, ...rest] = motivationQueue;
    setMotivationQueue(rest);
    setCurrentMotivation(next);
    markEventSeen(studentId, next.key);
  }, [currentMotivation, greetingVisible, motivationQueue, studentId]);

  useEffect(() => {
    if (!panelOpen) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") setPanelOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [panelOpen]);

  const initialize = useCallback(async () => {
    if (initialized || initializingRef.current) return;
    initializingRef.current = true;
    setConfigLoading(true);
    setErrorMessage("");
    clearFaceFeedback();
    try {
      const config = await getArchieForStudent({ data: { accessToken, lessonId } });
      setGreetingReady(true);
      const events = (config.motivationEvents ?? []) as ArchieMotivationEvent[];
      const seen = getSeenEventKeys(studentId);
      const unseenEvents = events.filter((event) => !seen.has(event.key));
      hideAfterMotivationQueueRef.current = unseenEvents.some((event) => event.dismissWidget);
      setMode(config.mode as ArchieLessonMode);
      setMotivationMessages(config.motivationMessages as ArchieMotivationMessages);
      setMotivationQueue(unseenEvents);
      if (
        ["homework-approved", "lesson-complete", "course-complete"].includes(config.mode) &&
        unseenEvents.length === 0
      ) {
        setShouldHideWidget(true);
      }
      setEnabled(config.enabled);
      setName(config.name);
      setSubtitle(config.subtitle);
      const configuredGreetings = normalizeArchieGreetingMessages(config.greetingMessages);
      setGreetingMessages(configuredGreetings);
      const greetingIndex =
        Array.from(lessonId).reduce((sum, character) => sum + character.charCodeAt(0), 0) %
        configuredGreetings.length;
      if (config.mode === "chat") {
        setGreetingText(configuredGreetings[greetingIndex]);
        setGreetingVisible(true);
      } else if (config.mode === "checked-exercise") {
        setGreetingText(
          config.motivationMessages.checkedExercise[0] ||
            "Попробуй решить самостоятельно! Ошибки тоже помогают учиться.",
        );
        setGreetingVisible(true);
      }
      setMaxLength(config.maxMessageLength);
      setQuickActionsEnabled(config.quickActionsEnabled);
      setInitialized(true);
      if (pendingOpenRef.current) {
        pendingOpenRef.current = false;
        setGreetingVisible(false);
        if (config.mode === "chat") {
          setPanelOpen(true);
        } else {
          setLockedNotice(
            lockedModeMessage(config.mode as ArchieLessonMode, config.motivationMessages),
          );
        }
      }
      if (!config.enabled && config.mode === "chat") {
        setErrorMessage("Арчи сейчас недоступен. Попробуй ещё раз чуть позже.");
        showFaceFeedback("error");
      }
    } catch {
      pendingOpenRef.current = false;
      setErrorMessage("Арчи сейчас не смог ответить. Попробуй ещё раз чуть позже.");
      showFaceFeedback("error");
      setGreetingText(DEFAULT_ARCHIE_GREETING_MESSAGES[0]);
      setGreetingVisible(true);
      setGreetingReady(true);
      window.setTimeout(() => setGreetingVisible(false), 7500);
    } finally {
      initializingRef.current = false;
      setConfigLoading(false);
    }
  }, [accessToken, clearFaceFeedback, initialized, lessonId, showFaceFeedback, studentId]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    const refreshKey = `${progressSignature}:${refreshTick}`;
    if (!initialized || previousProgressSignature.current === refreshKey) return;
    previousProgressSignature.current = refreshKey;
    let cancelled = false;
    void getArchieForStudent({ data: { accessToken, lessonId } })
      .then((config) => {
        if (cancelled) return;
        const nextMode = config.mode as ArchieLessonMode;
        const events = (config.motivationEvents ?? []) as ArchieMotivationEvent[];
        const seen = getSeenEventKeys(studentId);
        const activeKeys = new Set([
          ...motivationQueue.map((event) => event.key),
          ...(currentMotivation ? [currentMotivation.key] : []),
        ]);
        setMode(nextMode);
        setMotivationMessages(config.motivationMessages as ArchieMotivationMessages);
        if (events.some((event) => event.dismissWidget && !seen.has(event.key))) {
          hideAfterMotivationQueueRef.current = true;
        }
        setMotivationQueue((queue) => [
          ...queue,
          ...events.filter((event) => !seen.has(event.key) && !activeKeys.has(event.key)),
        ]);
        if (
          ["homework-approved", "lesson-complete", "course-complete"].includes(nextMode) &&
          events.every((event) => seen.has(event.key))
        ) {
          setShouldHideWidget(true);
        }
      })
      .catch(() => {
        // A progress refresh should not interrupt an already working chat.
      });
    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    currentMotivation,
    initialized,
    lessonId,
    motivationQueue,
    progressSignature,
    refreshTick,
    studentId,
  ]);

  useEffect(() => {
    if (!initialized || mode !== "homework-pending") return;
    const channel = supabase
      .channel(`archie-homework-status:${lessonId}:${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `recipient_user_id=eq.${studentId}`,
        },
        () => setRefreshTick((tick) => tick + 1),
      )
      .subscribe();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") setRefreshTick((tick) => tick + 1);
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      void supabase.removeChannel(channel);
    };
  }, [initialized, lessonId, mode, studentId]);

  function togglePanel() {
    if (!initialized) {
      pendingOpenRef.current = true;
      void initialize();
      return;
    }
    if (mode !== "chat") {
      if (!motivationMessages) return;
      setGreetingVisible(false);
      setLockedNotice(lockedModeMessage(mode, motivationMessages));
      window.setTimeout(() => setLockedNotice(""), 7000);
      return;
    }
    const nextOpen = !panelOpen;
    setPanelOpen(nextOpen);
    if (nextOpen) setGreetingVisible(false);
  }

  async function send(text = draft) {
    const messageText = text.trim();
    if (!messageText || loading || !enabled || mode !== "chat") return;
    if (messageText.length > maxLength) {
      setErrorMessage(`Сообщение должно содержать не больше ${maxLength} символов.`);
      showFaceFeedback("error");
      return;
    }
    clearFaceFeedback();
    setErrorMessage("");
    setDraft("");
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: messageText,
    };
    setMessages((current) => [...current, userMessage]);
    setLoading(true);
    try {
      const result = await askArchie({
        data: {
          accessToken,
          lessonId,
          message: messageText,
          history: messages.slice(-8).map(({ role, content }) => ({ role, content })),
        },
      });
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: result.answer,
        type: result.type,
        error: "error" in result && result.error === true,
      };
      setMessages((current) => [...current, assistantMessage]);
      showFaceFeedback(assistantMessage.error ? "error" : "responding");
    } catch {
      setErrorMessage("Арчи сейчас не смог ответить. Попробуй ещё раз чуть позже.");
      setMessages((current) => current.filter((item) => item.id !== userMessage.id));
      setDraft(messageText);
      showFaceFeedback("error");
    } finally {
      setLoading(false);
    }
  }

  function onInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send();
    }
  }

  // Wait for authoritative mode/event state before mounting on completed lessons.
  // This prevents the floating button flashing for a moment on old lessons while
  // still allowing a not-yet-shown one-time completion message to appear.
  if (shouldHideWidget || (lessonCompleted && !initialized)) return null;

  return (
    <>
      {!panelOpen &&
        greetingReady &&
        (currentMotivation ||
          lockedNotice ||
          (greetingVisible && (mode === "chat" || mode === "checked-exercise"))) && (
          <div
            data-testid="archie-floating-greeting"
            className="fixed bottom-20 right-20 z-40 flex max-w-[min(12rem,calc(100vw-6rem))] items-start gap-2 rounded-2xl border border-primary/15 bg-card px-3.5 py-2.5 text-sm leading-snug text-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-300 sm:bottom-[5.75rem] sm:right-[6.25rem]"
          >
            <span>
              {currentMotivation?.message?.trim() ||
                lockedNotice ||
                greetingText.trim() ||
                DEFAULT_ARCHIE_GREETING_MESSAGES[0]}
            </span>
            <button
              type="button"
              className="-mr-1 -mt-1 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                setGreetingVisible(false);
                setLockedNotice("");
                if (currentMotivation) {
                  if (motivationTimeoutRef.current !== null)
                    window.clearTimeout(motivationTimeoutRef.current);
                  if (currentMotivation.dismissWidget) hideAfterMotivationQueueRef.current = true;
                  if (
                    hideAfterMotivationQueueRef.current &&
                    motivationQueueRef.current.length === 0
                  ) {
                    setShouldHideWidget(true);
                  }
                  setCurrentMotivation(null);
                }
              }}
              aria-label="Скрыть подсказку Арчи"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

      <button
        type="button"
        data-testid="archie-floating-button"
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full border-2 border-background bg-primary shadow-[0_8px_28px_-8px_hsl(var(--primary)/0.75)] transition duration-200 hover:scale-105 hover:shadow-[0_12px_34px_-8px_hsl(var(--primary)/0.8)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/30 active:scale-95 sm:bottom-5 sm:right-6 sm:h-16 sm:w-16"
        onClick={togglePanel}
        aria-label={
          mode === "chat"
            ? panelOpen
              ? "Закрыть чат с Арчи"
              : "Спросить Арчи"
            : "Получить поддержку Арчи"
        }
        aria-expanded={panelOpen}
        aria-controls="archie-chat-panel"
      >
        <ArchieFace
          src={ARCHIE_FACE_ASSETS[faceState]}
          className="absolute inset-1 rounded-full ring-2 ring-white/90"
        />
        <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground sm:bottom-1 sm:right-1">
          {panelOpen ? <X className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
        </span>
        <span className="sr-only">Арчи, помощник курса</span>
      </button>

      <section
        id="archie-chat-panel"
        aria-label={`${name}, ${subtitle}`}
        aria-hidden={!panelOpen || mode !== "chat"}
        className={`fixed bottom-[5.25rem] right-3 z-40 flex w-[calc(100vw-1.5rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-primary/15 bg-card shadow-[0_24px_70px_-22px_hsl(var(--foreground)/0.32)] transition-[opacity,transform,height] duration-300 ease-out sm:bottom-24 sm:right-6 ${messages.length || loading ? "h-[min(500px,calc(100dvh-7rem))]" : "h-[min(350px,calc(100dvh-7rem))]"} ${panelOpen && mode === "chat" ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none invisible translate-y-3 scale-[0.98] opacity-0"}`}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-primary-soft/35 px-3.5 py-3 sm:px-4">
          <ArchieFace
            src={ARCHIE_FACE_ASSETS[faceState]}
            className="relative h-10 w-10 shrink-0 rounded-full shadow-sm ring-2 ring-background"
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold leading-tight">{name}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Свернуть чат Арчи"
            onClick={() => setPanelOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3.5 sm:p-4" aria-live="polite">
          <div
            data-testid="archie-chat-greeting"
            className="max-w-[92%] rounded-2xl rounded-tl-sm bg-primary-soft/70 px-3.5 py-2.5 text-sm leading-relaxed"
          >
            {greetingText}
          </div>
          {configLoading && !initialized && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Подключаю Арчи…
            </div>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  message.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : message.error
                      ? "rounded-tl-sm border border-destructive/30 bg-destructive/5"
                      : "rounded-tl-sm bg-muted"
                }`}
              >
                {message.role === "assistant" && message.type && (
                  <p className="mb-1 text-xs font-semibold text-primary">
                    {SOURCE_LABELS[message.type]}
                  </p>
                )}
                {message.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Арчи думает…
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="shrink-0 border-t border-border bg-background p-3">
          {quickActionsEnabled && (
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  type="button"
                  variant="soft"
                  size="sm"
                  className="shrink-0 text-xs"
                  disabled={loading || !enabled || mode !== "chat"}
                  onClick={() => void send(action.prompt)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Напиши вопрос…"
              maxLength={maxLength}
              rows={2}
              disabled={!enabled || loading || mode !== "chat"}
              className="max-h-32 min-h-12 resize-y"
              aria-label="Сообщение Арчи"
            />
            <Button
              type="button"
              size="icon"
              className="h-12 w-12 shrink-0"
              aria-label="Отправить сообщение"
              disabled={!enabled || loading || mode !== "chat" || !draft.trim()}
              onClick={() => void send()}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {errorMessage && <p className="mt-2 text-sm text-destructive">{errorMessage}</p>}
          {errorMessage && !initialized && (
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto p-0"
              onClick={() => void initialize()}
            >
              Попробовать подключить снова
            </Button>
          )}
          <p className="mt-2 text-right text-xs text-muted-foreground">
            {draft.length}/{maxLength} · Enter — отправить, Shift+Enter — новая строка
          </p>
        </div>
      </section>
    </>
  );
}

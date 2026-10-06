import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Loader2, MessageCircle, Send } from "lucide-react";
import guideSheet from "@/assets/lesson-guide-sheet.jpg";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getArchieForStudent, askArchie } from "@/server/archie.functions";
import type { ArchieAnswerType, ArchieChatMessage } from "@/lib/archie";

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

export function ArchieChat({ accessToken, lessonId }: { accessToken: string; lessonId: string }) {
  const [open, setOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [name, setName] = useState("Арчи");
  const [subtitle, setSubtitle] = useState("Помощник курса");
  const [welcome, setWelcome] = useState(
    "Привет! Я Арчи. Помогу разобраться в материале этого урока.",
  );
  const [maxLength, setMaxLength] = useState(1500);
  const [quickActionsEnabled, setQuickActionsEnabled] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function openChat() {
    setOpen(true);
    setErrorMessage("");
    if (initialized) return;
    try {
      const config = await getArchieForStudent({ data: { accessToken, lessonId } });
      setEnabled(config.enabled);
      setName(config.name);
      setSubtitle(config.subtitle);
      setWelcome(config.welcomeMessage);
      setMaxLength(config.maxMessageLength);
      setQuickActionsEnabled(config.quickActionsEnabled);
      setInitialized(true);
      if (!config.enabled) setErrorMessage("Арчи сейчас недоступен. Попробуй ещё раз чуть позже.");
    } catch {
      setErrorMessage("Арчи сейчас не смог ответить. Попробуй ещё раз чуть позже.");
    }
  }

  async function send(text = draft) {
    const messageText = text.trim();
    if (!messageText || loading || !enabled) return;
    if (messageText.length > maxLength) {
      setErrorMessage(`Сообщение должно содержать не больше ${maxLength} символов.`);
      return;
    }
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
    } catch {
      setErrorMessage("Арчи сейчас не смог ответить. Попробуй ещё раз чуть позже.");
      setMessages((current) => current.filter((item) => item.id !== userMessage.id));
      setDraft(messageText);
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

  return (
    <>
      <Button variant="outline" size="sm" className="mt-4" onClick={() => void openChat()}>
        <MessageCircle className="h-4 w-4" /> Спросить Арчи
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex h-[min(760px,92dvh)] max-h-[92dvh] w-[calc(100%-1rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:w-full sm:rounded-2xl">
          <DialogHeader className="shrink-0 border-b border-border p-4 pr-12 sm:p-5">
            <div className="flex items-center gap-3 text-left">
              <div
                aria-hidden="true"
                className="h-11 w-11 shrink-0 rounded-full bg-cover bg-no-repeat shadow-sm"
                style={{
                  backgroundImage: `url(${guideSheet})`,
                  backgroundSize: "300% 200%",
                  backgroundPosition: "50% 0%",
                }}
              />
              <div className="min-w-0">
                <DialogTitle>{name}</DialogTitle>
                <DialogDescription className="mt-1">{subtitle}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite">
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-primary-soft/70 px-4 py-3 text-sm leading-relaxed">
              {welcome}
            </div>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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

          <div className="shrink-0 border-t border-border bg-background p-3 sm:p-4">
            {quickActionsEnabled && (
              <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
                {QUICK_ACTIONS.map((action) => (
                  <Button
                    key={action.label}
                    type="button"
                    variant="soft"
                    size="sm"
                    className="shrink-0 text-xs"
                    disabled={loading || !enabled}
                    onClick={() => void send(action.prompt)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              <Textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Напиши вопрос…"
                maxLength={maxLength}
                rows={2}
                disabled={!enabled || loading}
                className="max-h-32 min-h-12 resize-y"
                aria-label="Сообщение Арчи"
              />
              <Button
                type="button"
                size="icon"
                className="h-12 w-12 shrink-0"
                aria-label="Отправить сообщение"
                disabled={!enabled || loading || !draft.trim()}
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
            <p className="mt-2 text-right text-xs text-muted-foreground">
              {draft.length}/{maxLength} · Enter — отправить, Shift+Enter — новая строка
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

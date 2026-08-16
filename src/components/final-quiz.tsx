import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Clock3, Loader2, RotateCcw, Trophy, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  finishFinalQuiz,
  saveFinalQuizAnswers,
  startFinalQuiz,
} from "@/server/final-quiz.functions";

type Question = {
  id: string;
  topic: string;
  text: string;
  options: { id: string; text: string }[];
};

type QuizResult = {
  score: number;
  total: number;
  percentage: number;
  passed: boolean;
  timedOut: boolean;
  disqualified: boolean;
  attemptsUsed: number;
  attemptsLeft: number;
  review: {
    id: string;
    topic: string;
    text: string;
    selectedOptionId: string | null;
    selectedOptionText: string;
    correctOptionId: string;
    correctOptionText: string;
    correct: boolean;
    explanation: string;
  }[];
};

type QuizState =
  | { status: "loading" }
  | { status: "ready"; attemptsUsed: number; maxAttempts: number }
  | {
      status: "active";
      attemptId: string;
      expiresAt: string;
      answers: Record<string, string>;
      questions: Question[];
      attemptsUsed: number;
      maxAttempts: number;
    }
  | { status: "result"; result: QuizResult };

function formatTime(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function FinalQuiz({
  accessToken,
  exitRequest = 0,
  onActiveChange,
  onExitComplete,
}: {
  accessToken: string;
  exitRequest?: number;
  onActiveChange?: (active: boolean) => void;
  onExitComplete?: () => void;
}) {
  const [state, setState] = useState<QuizState>({ status: "loading" });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const [saving, setSaving] = useState(false);
  const autoFinishRef = useRef(false);

  const load = async (startNew = false) => {
    setState({ status: "loading" });
    try {
      const next = await startFinalQuiz({ data: { accessToken, startNew } });
      if (next.status === "active") {
        setRemainingMs(Math.max(0, new Date(next.expiresAt).getTime() - Date.now()));
      } else {
        setRemainingMs(0);
      }
      setState(next as Exclude<QuizState, { status: "loading" }>);
      setCurrentIndex(0);
      autoFinishRef.current = false;
    } catch (error) {
      setState({ status: "ready", attemptsUsed: 0, maxAttempts: 3 });
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить тест");
    }
  };

  useEffect(() => {
    void load();
    // The session token changes only after the parent lesson is reloaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (state.status !== "active") return;
    const updateTimer = () => setRemainingMs(new Date(state.expiresAt).getTime() - Date.now());
    updateTimer();
    const timer = window.setInterval(updateTimer, 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => {
    onActiveChange?.(state.status === "active");
    return () => onActiveChange?.(false);
  }, [state.status, onActiveChange]);

  const finish = async (timedOut = false) => {
    if (state.status !== "active" || saving) return;
    setSaving(true);
    try {
      await saveFinalQuizAnswers({
        data: { accessToken, attemptId: state.attemptId, answers: state.answers },
      });
      const result = await finishFinalQuiz({
        data: { accessToken, attemptId: state.attemptId, disqualified: false },
      });
      setState({ status: "result", result: result as QuizResult });
      if (timedOut) toast.info("Время вышло, тест завершён автоматически");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось завершить тест");
      void load();
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (state.status !== "active" || remainingMs > 0 || autoFinishRef.current) return;
    autoFinishRef.current = true;
    void finish(true);
    // finish intentionally uses current state after the timer expires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remainingMs, state]);

  useEffect(() => {
    const disqualifyForLeaving = async () => {
      if (state.status !== "active" || autoFinishRef.current) return;
      autoFinishRef.current = true;
      setSaving(true);
      try {
        const result = await finishFinalQuiz({
          data: { accessToken, attemptId: state.attemptId, disqualified: true },
        });
        setState({ status: "result", result: result as QuizResult });
      } catch {
        void load();
      } finally {
        setSaving(false);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") void disqualifyForLeaving();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // The handler intentionally follows the current active attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, accessToken]);

  const handledExitRequest = useRef(0);
  useEffect(() => {
    if (
      !exitRequest ||
      exitRequest === handledExitRequest.current ||
      state.status !== "active" ||
      saving
    )
      return;

    handledExitRequest.current = exitRequest;
    const exitQuiz = async () => {
      setSaving(true);
      try {
        await saveFinalQuizAnswers({
          data: { accessToken, attemptId: state.attemptId, answers: state.answers },
        });
        await finishFinalQuiz({
          data: { accessToken, attemptId: state.attemptId, disqualified: true },
        });
        onExitComplete?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Не удалось завершить тест");
      } finally {
        setSaving(false);
      }
    };
    void exitQuiz();
  }, [accessToken, exitRequest, onExitComplete, saving, state]);

  const persistAnswer = async (questionId: string, optionId: string) => {
    if (state.status !== "active" || saving) return;
    const answers = { ...state.answers, [questionId]: optionId };
    setState({ ...state, answers });
    try {
      await saveFinalQuizAnswers({ data: { accessToken, attemptId: state.attemptId, answers } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить ответ");
    }
  };

  if (state.status === "loading") {
    return (
      <section className="rounded-2xl border border-border bg-card p-8 shadow-[var(--shadow-soft)]">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
      </section>
    );
  }

  if (state.status === "ready") {
    return (
      <QuizIntro
        attemptsUsed={state.attemptsUsed}
        maxAttempts={state.maxAttempts}
        onStart={() => void load(true)}
      />
    );
  }

  if (state.status === "result") {
    return (
      <QuizResultView
        result={state.result}
        onRetry={state.result.attemptsLeft > 0 ? () => void load(true) : undefined}
      />
    );
  }

  const question = state.questions[currentIndex];
  const answered = Object.keys(state.answers).length;
  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Badge variant="secondary">Итоговый тест</Badge>
          <p className="mt-2 text-sm text-muted-foreground">
            Вопрос {currentIndex + 1} из {state.questions.length} · Отвечено: {answered}
          </p>
        </div>
        <div
          className={`inline-flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${remainingMs < 5 * 60 * 1000 ? "bg-destructive/10 text-destructive" : "bg-primary-soft text-primary"}`}
        >
          <Clock3 className="h-4 w-4" /> {formatTime(remainingMs)}
        </div>
      </div>

      <div className="mt-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {question.topic}
        </p>
        <h2 className="mt-2 text-xl font-extrabold leading-snug sm:text-2xl">{question.text}</h2>
        <div className="mt-6 grid gap-3">
          {question.options.map((option, index) => {
            const selected = state.answers[question.id] === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => void persistAnswer(question.id, option.id)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left text-sm transition-colors ${selected ? "border-primary bg-primary-soft text-foreground" : "border-border hover:border-primary/50 hover:bg-muted/60"}`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                >
                  {String.fromCharCode(65 + index)}
                </span>
                <span className="pt-0.5">{option.text}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-border pt-5">
        <Button
          variant="soft"
          onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
          disabled={currentIndex === 0 || saving}
        >
          Назад
        </Button>
        {currentIndex < state.questions.length - 1 ? (
          <Button
            variant="hero"
            onClick={() =>
              setCurrentIndex((index) => Math.min(state.questions.length - 1, index + 1))
            }
            disabled={saving}
          >
            Следующий вопрос
          </Button>
        ) : (
          <Button variant="hero" onClick={() => void finish()} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Завершить тест
          </Button>
        )}
      </div>
    </section>
  );
}

function QuizIntro({
  attemptsUsed,
  maxAttempts,
  onStart,
}: {
  attemptsUsed: number;
  maxAttempts: number;
  onStart: () => void;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Trophy className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold">Итоговый тест</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Тебе предстоит 30 вопросов по всему курсу. На выполнение даётся 30 минут. Не
            переключайся на другую вкладку и не сворачивай браузер: попытка будет завершена как не
            сданная.
          </p>
        </div>
      </div>
      <div className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-muted p-4">
          <strong>70%</strong>
          <br />
          <span className="text-muted-foreground">проходной балл</span>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <strong>30 минут</strong>
          <br />
          <span className="text-muted-foreground">на попытку</span>
        </div>
        <div className="rounded-xl bg-muted p-4">
          <strong>
            {maxAttempts - attemptsUsed} из {maxAttempts}
          </strong>
          <br />
          <span className="text-muted-foreground">попыток осталось</span>
        </div>
      </div>
      <Button className="mt-6" variant="hero" size="lg" onClick={onStart}>
        Начать тест
      </Button>
    </section>
  );
}

function QuizResultView({ result, onRetry }: { result: QuizResult; onRetry?: () => void }) {
  const mistakes = useMemo(
    () => result.review.filter((question) => !question.correct),
    [result.review],
  );
  return (
    <section className="space-y-6">
      <div
        className={`rounded-2xl border p-6 shadow-[var(--shadow-soft)] sm:p-8 ${result.passed ? "border-primary/25 bg-primary-soft" : "border-destructive/25 bg-destructive/5"}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-xl ${result.passed ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}
            >
              {result.passed ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : (
                <XCircle className="h-6 w-6" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold">
                {result.passed ? "Тест пройден" : "Тест не пройден"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.disqualified
                  ? "Тест завершён: во время попытки была открыта другая вкладка или браузер был свёрнут."
                  : result.timedOut
                    ? "Время вышло: тест завершён автоматически."
                    : "Результат сохранён в твоём кабинете."}
              </p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <div className="text-3xl font-extrabold">{result.percentage}%</div>
            <div className="text-sm text-muted-foreground">
              {result.score} из {result.total} правильных
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
          <Badge variant={result.passed ? "default" : "destructive"}>
            {result.passed ? "Пройден" : "Не пройден"}
          </Badge>
          <span className="text-muted-foreground">Попытка {result.attemptsUsed} из 3</span>
          {onRetry ? (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="h-4 w-4" /> Повторить тест
            </Button>
          ) : null}
        </div>
      </div>

      {result.passed ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-soft)] sm:p-7">
          <h2 className="text-xl font-extrabold">Разбор ответов</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ошибок: {mistakes.length}. Здесь показаны все вопросы, чтобы закрепить материал.
          </p>
          <div className="mt-6 space-y-4">
            {result.review.map((question, index) => (
              <article
                key={question.id}
                className={`rounded-xl border p-4 ${question.correct ? "border-primary/20 bg-primary-soft/40" : "border-destructive/20 bg-destructive/5"}`}
              >
                <div className="flex gap-3">
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${question.correct ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"}`}
                  >
                    {question.correct ? (
                      <CheckCircle2 className="h-4 w-4" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                  </span>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {index + 1}. {question.topic}
                    </p>
                    <h3 className="mt-1 font-bold">{question.text}</h3>
                    <p className="mt-3 text-sm">
                      Твой ответ: <strong>{question.selectedOptionText}</strong>
                    </p>
                    {!question.correct ? (
                      <p className="mt-1 text-sm">
                        Верный ответ: <strong>{question.correctOptionText}</strong>
                      </p>
                    ) : null}
                    <p className="mt-3 text-sm text-muted-foreground">{question.explanation}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

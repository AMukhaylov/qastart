import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Save, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import {
  getAdminFinalQuizSettings,
  saveAdminFinalQuizSettings,
} from "@/server/final-quiz.functions";

type QuizSettings = Awaited<ReturnType<typeof getAdminFinalQuizSettings>>;
type EditableSettings = {
  questionsPerAttempt: number;
  durationMinutes: number;
  maxAttempts: number;
  passingPercent: number;
};

const inputClassName =
  "mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function AdminFinalQuizSettingsPanel() {
  const { session, isAdmin } = useAuth();
  const [settings, setSettings] = useState<QuizSettings | null>(null);
  const [draft, setDraft] = useState<EditableSettings>({
    questionsPerAttempt: 30,
    durationMinutes: 30,
    maxAttempts: 3,
    passingPercent: 70,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [bankQuestionCount, setBankQuestionCount] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const next = await getAdminFinalQuizSettings({ data: { accessToken: session.access_token } });
      setSettings(next);
      setDraft({
        questionsPerAttempt: next.questionsPerAttempt,
        durationMinutes: next.durationMinutes,
        maxAttempts: next.maxAttempts,
        passingPercent: next.passingPercent,
      });
    } catch (error) {
      console.error("Не удалось загрузить настройки итогового теста", error);
      toast.error("Не удалось загрузить настройки итогового теста");
    } finally {
      setLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  const handleBankFile = async (file: File | null) => {
    setBankFile(file);
    setBankQuestionCount(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setBankFile(null);
      toast.error("Выберите JSON-файл банка вопросов");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (!Array.isArray(parsed)) throw new Error("Ожидается JSON-массив вопросов");
      setBankQuestionCount(parsed.length);
    } catch (error) {
      setBankFile(null);
      toast.error(error instanceof Error ? error.message : "Не удалось прочитать JSON-файл");
    }
  };

  const saveSettings = async () => {
    if (!session?.access_token) return;
    setSaving(true);
    try {
      const questions = bankFile ? JSON.parse(await bankFile.text()) : undefined;
      const result = await saveAdminFinalQuizSettings({
        data: { accessToken: session.access_token, ...draft, questions },
      });
      setBankFile(null);
      setBankQuestionCount(null);
      toast.success(
        bankFile
          ? `Банк из ${result.bankQuestionCount} вопросов сохранён`
          : "Настройки теста сохранены",
      );
      await load();
    } catch (error) {
      console.error("Не удалось сохранить настройки итогового теста", error);
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить настройки итогового теста",
      );
    } finally {
      setSaving(false);
    }
  };

  const downloadBank = () => {
    if (!settings) return;
    const blob = new Blob([JSON.stringify(settings.questions, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "qa-start-final-quiz-bank.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!isAdmin)
    return (
      <div className="py-12 text-center text-muted-foreground">Требуются права администратора.</div>
    );
  if (loading)
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );

  return (
    <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
      <div>
        <h2 className="text-xl font-extrabold">Настройки итогового теста</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Эти параметры применяются при начале следующей попытки. Текущая активная попытка
          продолжится с исходными настройками.
        </p>
      </div>
      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <label className="text-sm font-semibold">
          Вопросов в попытке
          <input
            className={inputClassName}
            type="number"
            min={1}
            max={settings?.bankQuestionCount ?? 90}
            value={draft.questionsPerAttempt}
            onChange={(event) =>
              setDraft({ ...draft, questionsPerAttempt: Number(event.target.value) })
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Время на попытку (минут)
          <input
            className={inputClassName}
            type="number"
            min={1}
            max={240}
            value={draft.durationMinutes}
            onChange={(event) =>
              setDraft({ ...draft, durationMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label className="text-sm font-semibold">
          Количество попыток
          <input
            className={inputClassName}
            type="number"
            min={1}
            max={20}
            value={draft.maxAttempts}
            onChange={(event) => setDraft({ ...draft, maxAttempts: Number(event.target.value) })}
          />
        </label>
        <label className="text-sm font-semibold">
          Проходной балл (%)
          <input
            className={inputClassName}
            type="number"
            min={1}
            max={100}
            value={draft.passingPercent}
            onChange={(event) => setDraft({ ...draft, passingPercent: Number(event.target.value) })}
          />
        </label>
      </div>
      <div className="mt-6 rounded-xl bg-muted p-4 text-sm">
        Сейчас в банке: <strong>{settings?.bankQuestionCount ?? 0} вопросов</strong>
      </div>
      <div className="mt-6 space-y-3">
        <h2 className="font-bold">Банк вопросов</h2>
        <p className="text-sm text-muted-foreground">
          JSON-массив из 90 вопросов с полями id, topic, text, options, correctOptionId и
          explanation. Перед заменой сервер проверит формат, ответы и дубли.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={downloadBank} disabled={!settings}>
            <Download className="h-4 w-4" /> Скачать текущий банк
          </Button>
          <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium hover:bg-muted">
            <Upload className="h-4 w-4" /> Загрузить / заменить банк
            <input
              className="sr-only"
              type="file"
              accept="application/json,.json"
              onChange={(event) => void handleBankFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {bankFile ? (
          <p className="text-sm">
            {bankFile.name}
            {bankQuestionCount !== null ? ` · ${bankQuestionCount} вопросов` : ""}
          </p>
        ) : null}
      </div>
      <Button className="mt-6" onClick={() => void saveSettings()} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Сохранить настройки
      </Button>
    </section>
  );
}

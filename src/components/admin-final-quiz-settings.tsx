import { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Save, Upload, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  createAdminFinalQuizVideoUpload,
  getAdminFinalQuizSettings,
  saveAdminFinalQuizIntroVideoUrl,
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
const MAX_VIDEO_SIZE = 512 * 1024 * 1024;

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
  const [videoSaving, setVideoSaving] = useState(false);

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

  const uploadVideo = async (file: File | null) => {
    if (!file || !session?.access_token) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const types: Record<string, string> = {
      mp4: "video/mp4",
      webm: "video/webm",
      mov: "video/quicktime",
      ogg: "video/ogg",
    };
    if (!extension || !types[extension] || (file.type && file.type !== types[extension])) {
      toast.error("Поддерживаются видео MP4, WebM, MOV и OGG");
      return;
    }
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error("Размер видео не должен превышать 512 МБ");
      return;
    }

    setVideoSaving(true);
    try {
      const signed = await createAdminFinalQuizVideoUpload({
        data: {
          accessToken: session.access_token,
          extension: extension as "mp4" | "webm" | "mov" | "ogg",
          contentType: types[extension] as
            | "video/mp4"
            | "video/webm"
            | "video/quicktime"
            | "video/ogg",
        },
      });
      const { error: uploadError } = await supabase.storage
        .from("final-quiz-author")
        .uploadToSignedUrl(signed.path, signed.token, file, {
          contentType: signed.contentType,
          upsert: true,
        });
      if (uploadError) throw uploadError;
      await saveAdminFinalQuizIntroVideoUrl({
        data: { accessToken: session.access_token, videoUrl: signed.publicUrl },
      });
      setSettings((current) =>
        current ? { ...current, introVideoUrl: signed.publicUrl } : current,
      );
      toast.success("Видео перед итоговым тестом загружено");
    } catch (error) {
      console.error("Не удалось загрузить видео перед итоговым тестом", error);
      toast.error(error instanceof Error ? error.message : "Не удалось загрузить видео");
    } finally {
      setVideoSaving(false);
    }
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
    <div className="space-y-6">
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
              onChange={(event) =>
                setDraft({ ...draft, passingPercent: Number(event.target.value) })
              }
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

      <section className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-soft)] sm:p-8">
        <div className="flex items-center gap-3">
          <Video className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-extrabold">Напутствие перед итоговым тестом</h2>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Небольшое напутствие перед завершением QA Start
        </p>
        {settings?.introVideoUrl ? (
          <video
            className="mt-4 max-h-96 w-full rounded-xl bg-black"
            controls
            preload="metadata"
            src={settings.introVideoUrl}
          />
        ) : (
          <p className="mt-4 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            Видео ещё не загружено
          </p>
        )}
        <label className="mt-5 block text-sm font-semibold">
          Загрузить видео автора (MP4, WebM, MOV, OGG; до 512 МБ)
          <input
            className={`${inputClassName} cursor-pointer`}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/ogg,.mp4,.webm,.mov,.ogg"
            disabled={videoSaving}
            onChange={(event) => void uploadVideo(event.target.files?.[0] ?? null)}
          />
        </label>
        {videoSaving ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Загружаем видео…
          </p>
        ) : null}
      </section>
    </div>
  );
}

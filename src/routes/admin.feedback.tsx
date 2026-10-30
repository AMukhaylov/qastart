import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Download, Loader2, Plus, Save, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import {
  getAdminFeedbackData,
  saveAdminFeedbackGroupPolicy,
  saveAdminFeedbackGroupSkipSetting,
  saveAdminFeedbackSettings,
  type FeedbackQuestion,
} from "@/server/lesson-feedback.functions";
import {
  saveAdminCourseFeedbackQuestions,
  type CourseFeedbackQuestion,
} from "@/server/course-feedback.functions";

export const Route = createFileRoute("/admin/feedback")({ component: AdminFeedback });

type FeedbackItem = {
  id: string;
  user_id: string;
  lesson_id: string;
  answers: Record<string, unknown>;
  rating: number;
  difficulty: string;
  comment: string | null;
  created_at: string;
};
type LessonItem = { id: string; day_number: number; title: string };
type ProfileItem = { id: string; full_name: string | null; login: string | null };
type FeedbackGroup = {
  id: string;
  name: string;
  allow_feedback_skip: boolean;
  lesson_feedback_required: boolean;
  course_feedback_required: boolean;
};
type CourseFeedbackItem = {
  id: string;
  user_id: string;
  answers: Record<string, unknown>;
  created_at: string;
};
const emptyQuestions: FeedbackQuestion[] = [];

function AdminFeedback() {
  const { session, isAdmin } = useAuth();
  const [lessons, setLessons] = useState<LessonItem[]>([]);
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [studentCount, setStudentCount] = useState(0);
  const [groups, setGroups] = useState<FeedbackGroup[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [courseFeedback, setCourseFeedback] = useState<CourseFeedbackItem[]>([]);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [feedbackSettings, setFeedbackSettings] = useState<
    {
      lesson_id: string;
      required_override: boolean | null;
      use_common_template: boolean;
      questions: FeedbackQuestion[];
    }[]
  >([]);
  const [commonTemplate, setCommonTemplate] = useState<FeedbackQuestion[]>([]);
  const [courseQuestions, setCourseQuestions] = useState<CourseFeedbackQuestion[]>([]);
  const [courseQuestionsSaved, setCourseQuestionsSaved] = useState<CourseFeedbackQuestion[]>([]);
  const [useCommonTemplate, setUseCommonTemplate] = useState(true);
  const [lessonId, setLessonId] = useState("");
  const [globalRequired, setGlobalRequired] = useState(false);
  const [override, setOverride] = useState<"inherit" | "on" | "off">("inherit");
  const [questions, setQuestions] = useState<FeedbackQuestion[]>(emptyQuestions);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingCourseQuestions, setSavingCourseQuestions] = useState(false);
  const [studentFilter, setStudentFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("");

  useEffect(() => {
    if (!isAdmin || !session?.access_token) return;
    void getAdminFeedbackData({ data: { accessToken: session.access_token } })
      .then((data) => {
        setLessons(data.lessons as LessonItem[]);
        setFeedback(data.feedback as FeedbackItem[]);
        setProfiles(data.profiles as ProfileItem[]);
        setStudentCount(data.studentCount);
        const loadedGroups = data.groups as unknown as FeedbackGroup[];
        setGroups(loadedGroups);
        setSelectedGroupId((current) =>
          loadedGroups.some((group) => group.id === current)
            ? current
            : (loadedGroups[0]?.id ?? ""),
        );
        setCourseFeedback(data.courseFeedback as CourseFeedbackItem[]);
        setCourseQuestions(data.courseFeedbackQuestions as CourseFeedbackQuestion[]);
        setCourseQuestionsSaved(data.courseFeedbackQuestions as CourseFeedbackQuestion[]);
        setFeedbackSettings(data.settings as typeof feedbackSettings);
        setCommonTemplate(data.commonTemplate as FeedbackQuestion[]);
        setGlobalRequired(Boolean(data.courseSettings?.required_by_default));
        const firstLesson = (data.lessons as LessonItem[])[0];
        if (firstLesson) setLessonId(firstLesson.id);
      })
      .catch((error) =>
        toast.error(error instanceof Error ? error.message : "Не удалось загрузить обратную связь"),
      )
      .finally(() => setLoading(false));
  }, [isAdmin, session?.access_token]);

  useEffect(() => {
    if (!lessonId) return;
    void getAdminFeedbackData({ data: { accessToken: session?.access_token ?? "" } })
      .then((data) => {
        const lessonSetting = (data.settings as typeof feedbackSettings).find(
          (item) => item.lesson_id === lessonId,
        );
        setOverride(
          lessonSetting?.required_override === null ||
            lessonSetting?.required_override === undefined
            ? "inherit"
            : lessonSetting.required_override
              ? "on"
              : "off",
        );
        const usesCommon = lessonSetting?.use_common_template ?? true;
        setUseCommonTemplate(usesCommon);
        setQuestions(
          usesCommon
            ? (data.commonTemplate as FeedbackQuestion[])
            : (lessonSetting?.questions ?? emptyQuestions),
        );
      })
      .catch(() => undefined);
  }, [lessonId, session?.access_token]);

  const profileById = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const selectedFeedback = useMemo(
    () =>
      feedback.filter((item) => {
        if (lessonId && item.lesson_id !== lessonId) return false;
        const name =
          profileById.get(item.user_id)?.full_name ??
          profileById.get(item.user_id)?.login ??
          item.user_id;
        if (studentFilter && !name.toLowerCase().includes(studentFilter.toLowerCase()))
          return false;
        if (ratingFilter && item.rating !== Number(ratingFilter)) return false;
        if (difficultyFilter && item.difficulty !== difficultyFilter) return false;
        if (dateFrom && item.created_at.slice(0, 10) < dateFrom) return false;
        if (dateTo && item.created_at.slice(0, 10) > dateTo) return false;
        return true;
      }),
    [
      feedback,
      lessonId,
      profileById,
      studentFilter,
      ratingFilter,
      difficultyFilter,
      dateFrom,
      dateTo,
    ],
  );
  const average = selectedFeedback.length
    ? selectedFeedback.reduce((sum, item) => sum + item.rating, 0) / selectedFeedback.length
    : 0;
  const sortedRatings = selectedFeedback.map((item) => item.rating).sort((a, b) => a - b);
  const median = sortedRatings.length
    ? sortedRatings.length % 2
      ? sortedRatings[Math.floor(sortedRatings.length / 2)]!
      : (sortedRatings[sortedRatings.length / 2 - 1]! + sortedRatings[sortedRatings.length / 2]!) /
        2
    : null;
  const distribution = Array.from(
    { length: 10 },
    (_, index) => selectedFeedback.filter((item) => item.rating === index + 1).length,
  );
  const totalForLesson = useMemo(
    () => feedback.filter((item) => item.lesson_id === lessonId).length,
    [feedback, lessonId],
  );
  const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
  const requiredLessonCount = lessons.filter((lesson) => {
    const overrideValue = feedbackSettings.find(
      (item) => item.lesson_id === lesson.id,
    )?.required_override;
    return overrideValue ?? globalRequired;
  }).length;
  const requiredFeedbackCount = feedback.filter((item) => {
    const overrideValue = feedbackSettings.find(
      (setting) => setting.lesson_id === item.lesson_id,
    )?.required_override;
    return overrideValue ?? globalRequired;
  }).length;
  const courseStats = useMemo(
    () =>
      lessons.map((lesson) => {
        const rows = feedback.filter((item) => item.lesson_id === lesson.id);
        return {
          lesson,
          count: rows.length,
          average: rows.length
            ? rows.reduce((sum, item) => sum + item.rating, 0) / rows.length
            : null,
          hardShare: rows.length
            ? rows.filter((item) => ["hard", "too_hard"].includes(item.difficulty)).length /
              rows.length
            : null,
        };
      }),
    [lessons, feedback],
  );
  const lowestRated = courseStats
    .filter((item) => item.average !== null)
    .sort((a, b) => a.average! - b.average!)[0];
  const hardestLesson = courseStats
    .filter((item) => item.hardShare !== null)
    .sort((a, b) => b.hardShare! - a.hardShare!)[0];

  function updateQuestion(index: number, changes: Partial<FeedbackQuestion>) {
    setQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...changes } : question,
      ),
    );
  }
  function addQuestion() {
    setQuestions((current) => [
      ...current,
      { id: `question_${Date.now()}`, type: "textarea", label: "Новый вопрос", required: true },
    ]);
  }
  function moveQuestion(index: number, direction: number) {
    setQuestions((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  function updateCourseQuestion(index: number, changes: Partial<CourseFeedbackQuestion>) {
    setCourseQuestions((current) =>
      current.map((question, questionIndex) =>
        questionIndex === index ? { ...question, ...changes } : question,
      ),
    );
  }
  function addCourseQuestion() {
    setCourseQuestions((current) => [
      ...current,
      {
        id: `course_question_${Date.now()}`,
        type: "textarea",
        label: "Новый вопрос об итогах курса",
        required: true,
      },
    ]);
  }
  function moveCourseQuestion(index: number, direction: number) {
    setCourseQuestions((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
  async function save() {
    if (!session?.access_token || !lessonId) return;
    setSaving(true);
    try {
      await saveAdminFeedbackSettings({
        data: {
          accessToken: session.access_token,
          lessonId,
          requiredOverride: override === "inherit" ? null : override === "on",
          useCommonTemplate,
          questions,
        },
      });
      setFeedbackSettings((current) => {
        const next = current.filter((setting) => setting.lesson_id !== lessonId);
        return [
          ...next,
          {
            lesson_id: lessonId,
            required_override: override === "inherit" ? null : override === "on",
            use_common_template: useCommonTemplate,
            questions,
          },
        ];
      });
      if (useCommonTemplate) setCommonTemplate(questions);
      toast.success("Настройки опроса сохранены");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  }
  async function toggleGroupPolicy(
    group: FeedbackGroup,
    field: "lesson_feedback_required" | "course_feedback_required",
    required: boolean,
  ) {
    if (!session?.access_token || savingGroupId) return;
    const previous = group[field];
    setSavingGroupId(group.id);
    setGroups((current) =>
      current.map((item) => (item.id === group.id ? { ...item, [field]: required } : item)),
    );
    try {
      await saveAdminFeedbackGroupPolicy({
        data: {
          accessToken: session.access_token,
          groupId: group.id,
          lessonRequired:
            field === "lesson_feedback_required" ? required : group.lesson_feedback_required,
          courseRequired:
            field === "course_feedback_required" ? required : group.course_feedback_required,
        },
      });
      toast.success(`Настройка потока «${group.name}» сохранена`);
    } catch (error) {
      setGroups((current) =>
        current.map((item) => (item.id === group.id ? { ...item, [field]: previous } : item)),
      );
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройку потока");
    } finally {
      setSavingGroupId(null);
    }
  }
  async function toggleGroupSkip(group: FeedbackGroup, allowSkip: boolean) {
    if (!session?.access_token || savingGroupId) return;
    setSavingGroupId(group.id);
    setGroups((current) =>
      current.map((item) =>
        item.id === group.id ? { ...item, allow_feedback_skip: allowSkip } : item,
      ),
    );
    try {
      await saveAdminFeedbackGroupSkipSetting({
        data: { accessToken: session.access_token, groupId: group.id, allowSkip },
      });
      toast.success(`Настройка группы «${group.name}» сохранена`);
    } catch (error) {
      setGroups((current) =>
        current.map((item) =>
          item.id === group.id ? { ...item, allow_feedback_skip: group.allow_feedback_skip } : item,
        ),
      );
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить настройку группы");
    } finally {
      setSavingGroupId(null);
    }
  }
  async function saveCourseQuestions() {
    if (!session?.access_token || savingCourseQuestions) return;
    setSavingCourseQuestions(true);
    try {
      await saveAdminCourseFeedbackQuestions({
        data: { accessToken: session.access_token, questions: courseQuestions },
      });
      setCourseQuestionsSaved(courseQuestions);
      toast.success("Итоговый опрос сохранён");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить итоговый опрос");
    } finally {
      setSavingCourseQuestions(false);
    }
  }
  function exportCsv() {
    const escape = (value: unknown) => {
      const raw = String(value ?? "");
      const safe = /^[\s]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const rows = [
      [
        "student",
        "lesson",
        "rating",
        "difficulty",
        "answer_good",
        "answer_bad",
        "answer_improve",
        "comment",
        "created_at",
      ],
      ...selectedFeedback.map((item) => {
        const lesson = lessons.find((candidate) => candidate.id === item.lesson_id);
        const answers = item.answers ?? {};
        return [
          profileById.get(item.user_id)?.full_name ??
            profileById.get(item.user_id)?.login ??
            item.user_id,
          lesson?.title ?? item.lesson_id,
          item.rating,
          (
            {
              too_easy: "Слишком легко",
              normal: "Нормально",
              hard: "Сложно",
              too_hard: "Слишком сложно",
            } as Record<string, string>
          )[item.difficulty] ?? item.difficulty,
          answers.good,
          answers.unclear,
          answers.improve,
          item.comment,
          item.created_at,
        ];
      }),
    ];
    const blob = new Blob(["\ufeff" + rows.map((row) => row.map(escape).join(",")).join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "qa-start-feedback.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading)
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Загрузка обратной связи…
      </div>
    );
  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-extrabold">Обратная связь курса</h1>
        <p className="mt-2 text-muted-foreground">
          Настраивай обязательность отдельно для потоков, редактируй опросы и анализируй ответы.
        </p>
      </header>
      <section className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="text-xl font-bold">Настройки обратной связи для групп</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Выбери группу и настрой для неё отзывы по урокам, возможность их пропустить и итоговый
            опрос после Дня 14. Поток 0 настраивается здесь так же, как любая другая группа.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-border p-4">
          {groups.length ? (
            <>
              <label className="block max-w-xl text-sm font-medium">
                Учебная группа
                <select
                  className="mt-1 h-11 w-full rounded-md border border-input bg-background px-3"
                  value={selectedGroupId}
                  onChange={(event) => setSelectedGroupId(event.target.value)}
                  aria-label="Выбрать учебную группу для настроек обратной связи"
                >
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedGroup && (
                <div className="space-y-3 rounded-lg border border-border p-4 text-sm">
                  <strong className="text-base">Настройки группы «{selectedGroup.name}»</strong>
                  <label className="flex items-center justify-between gap-3">
                    <span>Отзывы по урокам обязательны для перехода дальше</span>
                    {savingGroupId === selectedGroup.id && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                    <input
                      type="checkbox"
                      checked={selectedGroup.lesson_feedback_required}
                      disabled={Boolean(savingGroupId)}
                      onChange={(event) =>
                        void toggleGroupPolicy(
                          selectedGroup,
                          "lesson_feedback_required",
                          event.currentTarget.checked,
                        )
                      }
                      aria-label={`Обязательные отзывы по урокам для группы ${selectedGroup.name}`}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3">
                    <span>Итоговый опрос о курсе обязателен после Дня 14</span>
                    <input
                      type="checkbox"
                      checked={selectedGroup.course_feedback_required}
                      disabled={Boolean(savingGroupId)}
                      onChange={(event) =>
                        void toggleGroupPolicy(
                          selectedGroup,
                          "course_feedback_required",
                          event.currentTarget.checked,
                        )
                      }
                      aria-label={`Обязательный итоговый опрос для группы ${selectedGroup.name}`}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-3 border-t border-border pt-2 text-muted-foreground">
                    <span>Разрешить явно пропустить обязательный опрос урока</span>
                    <input
                      type="checkbox"
                      checked={selectedGroup.allow_feedback_skip}
                      disabled={Boolean(savingGroupId)}
                      onChange={(event) =>
                        void toggleGroupSkip(selectedGroup, event.currentTarget.checked)
                      }
                      aria-label={`Разрешить пропуск опроса группе ${selectedGroup.name}`}
                    />
                  </label>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Правила сохраняются отдельно для выбранной группы. Если ученик состоит в нескольких
                группах, применяется наиболее строгая настройка.
              </p>
            </>
          ) : (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                Учебных групп пока нет. Создай группу «Поток 0» и назначь учеников в разделе
                «Студенты», затем выбери её здесь. Новые группы по умолчанию останутся
                опциональными.
              </p>
              <a
                href="/admin/students"
                className="font-medium text-primary underline-offset-4 hover:underline"
              >
                Перейти в раздел «Студенты»
              </a>
            </div>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)]">
          <label className="text-sm">
            Урок
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
              value={lessonId}
              onChange={(event) => setLessonId(event.target.value)}
            >
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  День {lesson.day_number}: {lesson.title}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Показывать опрос
            <select
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3"
              value={override}
              onChange={(event) => setOverride(event.target.value as typeof override)}
            >
              <option value="inherit">Как задано общим переключателем</option>
              <option value="on">Показывать для этого урока</option>
              <option value="off">Не показывать для этого урока</option>
            </select>
          </label>
        </div>
        <label className="flex items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            checked={useCommonTemplate}
            onChange={(event) => {
              const enabled = event.target.checked;
              setUseCommonTemplate(enabled);
              if (enabled) setQuestions(commonTemplate);
            }}
          />
          Использовать общий шаблон вопросов (изменения сохраняются для всех уроков с шаблоном)
        </label>
        <div className="space-y-3">
          {questions.map((question, index) => (
            <article key={question.id} className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm">Вопрос {index + 1}</strong>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Выше"
                    disabled={index === 0}
                    onClick={() => moveQuestion(index, -1)}
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Ниже"
                    disabled={index === questions.length - 1}
                    onClick={() => moveQuestion(index, 1)}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Удалить вопрос"
                    onClick={() =>
                      setQuestions((current) => current.filter((_, row) => row !== index))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
                <Input
                  value={question.label}
                  onChange={(event) => updateQuestion(index, { label: event.target.value })}
                  aria-label="Текст вопроса"
                />
                <select
                  className="h-10 rounded-md border border-input bg-background px-3"
                  value={question.type}
                  onChange={(event) =>
                    updateQuestion(index, {
                      type: event.target.value as FeedbackQuestion["type"],
                      options:
                        event.target.value === "radio"
                          ? (question.options ?? [
                              { label: "Вариант 1", value: "option_1" },
                              { label: "Вариант 2", value: "option_2" },
                            ])
                          : undefined,
                    })
                  }
                >
                  <option value="rating">Шкала 1–10</option>
                  <option value="textarea">Развёрнутый ответ</option>
                  <option value="radio">Один вариант</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={question.required}
                  onChange={(event) => updateQuestion(index, { required: event.target.checked })}
                />
                Обязательный
              </label>
              {question.type === "radio" && (
                <Textarea
                  rows={3}
                  aria-label="Варианты ответов: подпись | значение, по одному на строку"
                  value={(question.options ?? [])
                    .map((option) => `${option.label} | ${option.value}`)
                    .join("\n")}
                  onChange={(event) =>
                    updateQuestion(index, {
                      options: event.target.value
                        .split("\n")
                        .filter(Boolean)
                        .map((line, row) => {
                          const [label, value] = line.split("|").map((part) => part.trim());
                          return {
                            label: label || `Вариант ${row + 1}`,
                            value: value || `option_${row + 1}`,
                          };
                        }),
                    })
                  }
                  placeholder="Текст варианта | value"
                />
              )}
            </article>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addQuestion}>
            <Plus className="h-4 w-4" />
            Добавить вопрос
          </Button>
          <Button onClick={() => void save()} disabled={saving || !questions.length}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить настройки
          </Button>
        </div>
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <h2 className="text-xl font-bold">Итоговый опрос после Дня 14</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Этот набор вопросов собирает впечатление о курсе целиком и отдельно настраивается от
            отзывов по урокам.
          </p>
        </div>
        {courseQuestions.map((question, index) => (
          <article key={question.id} className="space-y-3 rounded-xl border border-border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="text-sm">Вопрос {index + 1}</strong>
              <div className="flex gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Выше"
                  disabled={index === 0}
                  onClick={() => moveCourseQuestion(index, -1)}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Ниже"
                  disabled={index === courseQuestions.length - 1}
                  onClick={() => moveCourseQuestion(index, 1)}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Удалить вопрос"
                  onClick={() =>
                    setCourseQuestions((current) => current.filter((_, row) => row !== index))
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
              <Input
                value={question.label}
                onChange={(event) => updateCourseQuestion(index, { label: event.target.value })}
                aria-label="Текст итогового вопроса"
              />
              <select
                className="h-10 rounded-md border border-input bg-background px-3"
                value={question.type}
                onChange={(event) =>
                  updateCourseQuestion(index, {
                    type: event.target.value as CourseFeedbackQuestion["type"],
                    options:
                      event.target.value === "radio"
                        ? (question.options ?? [
                            { label: "Вариант 1", value: "option_1" },
                            { label: "Вариант 2", value: "option_2" },
                          ])
                        : undefined,
                  })
                }
              >
                <option value="rating">Шкала 1–10</option>
                <option value="textarea">Развёрнутый ответ</option>
                <option value="radio">Один вариант</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={question.required}
                onChange={(event) =>
                  updateCourseQuestion(index, { required: event.target.checked })
                }
              />
              Обязательный вопрос
            </label>
            {question.type === "radio" && (
              <Textarea
                rows={3}
                aria-label="Варианты: подпись | значение, по одному на строку"
                value={(question.options ?? [])
                  .map((option) => `${option.label} | ${option.value}`)
                  .join("\n")}
                onChange={(event) =>
                  updateCourseQuestion(index, {
                    options: event.target.value
                      .split("\n")
                      .filter(Boolean)
                      .map((line, row) => {
                        const [label, value] = line.split("|").map((part) => part.trim());
                        return {
                          label: label || `Вариант ${row + 1}`,
                          value: value || `option_${row + 1}`,
                        };
                      }),
                  })
                }
                placeholder="Текст варианта | value"
              />
            )}
          </article>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addCourseQuestion}>
            <Plus className="h-4 w-4" /> Добавить вопрос
          </Button>
          <Button
            onClick={() => void saveCourseQuestions()}
            disabled={savingCourseQuestions || !courseQuestions.length}
          >
            {savingCourseQuestions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Сохранить итоговый опрос
          </Button>
        </div>
        {courseFeedback.length > 0 && (
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">Ответы об итогах курса · {courseFeedback.length}</h3>
              <Button
                variant="outline"
                onClick={() => {
                  const rows = [
                    ["student", "answers", "created_at"],
                    ...courseFeedback.map((item) => [
                      profileById.get(item.user_id)?.full_name ?? item.user_id,
                      JSON.stringify(item.answers),
                      item.created_at,
                    ]),
                  ];
                  const escape = (value: unknown) =>
                    `"${String(value ?? "").replaceAll('"', '""')}"`;
                  const blob = new Blob(
                    ["\ufeff" + rows.map((row) => row.map(escape).join(",")).join("\r\n")],
                    { type: "text/csv;charset=utf-8" },
                  );
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = "qa-start-course-feedback.csv";
                  anchor.click();
                  URL.revokeObjectURL(url);
                }}
              >
                <Download className="h-4 w-4" /> Экспорт ответов
              </Button>
            </div>
            {courseFeedback.map((item) => (
              <article key={item.id} className="space-y-2 rounded-xl border border-border p-4">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <strong>
                    {profileById.get(item.user_id)?.full_name ??
                      profileById.get(item.user_id)?.login ??
                      item.user_id}
                  </strong>
                  <span className="text-muted-foreground">
                    {new Date(item.created_at).toLocaleString("ru-RU")}
                  </span>
                </div>
                {Object.entries(item.answers).map(([key, value]) => (
                  <p key={key} className="text-sm">
                    <span className="font-medium">
                      {courseQuestionsSaved.find((question) => question.id === key)?.label ?? key}:
                    </span>{" "}
                    {String(value)}
                  </p>
                ))}
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Результаты</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Всего отзывов по уроку: {totalForLesson} · в выборке: {selectedFeedback.length} ·
              средняя оценка: {selectedFeedback.length ? average.toFixed(1) : "—"} · медиана:{" "}
              {median ?? "—"}
            </p>
          </div>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            Экспорт CSV
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Input
            placeholder="Ученик"
            value={studentFilter}
            onChange={(event) => setStudentFilter(event.target.value)}
          />
          <Input
            type="date"
            value={dateFrom}
            onChange={(event) => setDateFrom(event.target.value)}
            aria-label="Дата с"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(event) => setDateTo(event.target.value)}
            aria-label="Дата по"
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={ratingFilter}
            onChange={(event) => setRatingFilter(event.target.value)}
          >
            <option value="">Любая оценка</option>
            {Array.from({ length: 10 }, (_, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3"
            value={difficultyFilter}
            onChange={(event) => setDifficultyFilter(event.target.value)}
          >
            <option value="">Любая сложность</option>
            <option value="too_easy">Слишком легко</option>
            <option value="normal">Нормально</option>
            <option value="hard">Сложно</option>
            <option value="too_hard">Слишком сложно</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {distribution.map((count, index) => (
            <span key={index} className="rounded-md bg-muted px-2 py-1">
              {index + 1}: {count}
            </span>
          ))}
        </div>
        {selectedFeedback.map((item) => (
          <article key={item.id} className="rounded-xl border border-border p-4 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 text-sm">
              <strong>
                {profileById.get(item.user_id)?.full_name ??
                  profileById.get(item.user_id)?.login ??
                  item.user_id}
              </strong>
              <span>
                День {lessons.find((lesson) => lesson.id === item.lesson_id)?.day_number} ·{" "}
                {new Date(item.created_at).toLocaleString("ru-RU")} · оценка {item.rating}/10 ·{" "}
                {(
                  {
                    too_easy: "Слишком легко",
                    normal: "Нормально",
                    hard: "Сложно",
                    too_hard: "Слишком сложно",
                  } as Record<string, string>
                )[item.difficulty] ?? item.difficulty}
              </span>
            </div>
            {Object.entries(item.answers ?? {}).map(([key, value]) => (
              <p key={key} className="text-sm">
                <span className="font-medium">
                  {questions.find((question) => question.id === key)?.label ?? key}:
                </span>{" "}
                {String(value)}
              </p>
            ))}
          </article>
        ))}
        {!selectedFeedback.length && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Пока нет отзывов по выбранным фильтрам.
          </p>
        )}
      </section>
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-xl font-bold">Сводка по курсу</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Отзывов: {feedback.length} · completion rate:{" "}
          {studentCount && requiredLessonCount
            ? `${Math.min(100, Math.round((requiredFeedbackCount / (studentCount * requiredLessonCount)) * 100))}%`
            : "—"}
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-lg bg-muted px-3 py-2">
            Самая низкая оценка:{" "}
            {lowestRated
              ? `День ${lowestRated.lesson.day_number} · ${lowestRated.average!.toFixed(1)}`
              : "пока нет данных"}
          </span>
          <span className="rounded-lg bg-muted px-3 py-2">
            Чаще сложно:{" "}
            {hardestLesson
              ? `День ${hardestLesson.lesson.day_number} · ${Math.round(hardestLesson.hardShare! * 100)}%`
              : "пока нет данных"}
          </span>
        </div>
        <div className="mt-4 divide-y divide-border">
          {courseStats.map(({ lesson, count, average: lessonAverage, hardShare }) => {
            const lessonRows = feedback.filter((item) => item.lesson_id === lesson.id);
            const remarks = new Map<string, number>();
            for (const item of lessonRows) {
              const remark = String(item.answers.unclear ?? item.answers.improve ?? "").trim();
              if (remark) remarks.set(remark, (remarks.get(remark) ?? 0) + 1);
            }
            const mainRemark = [...remarks.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
            return (
              <div
                key={lesson.id}
                className="grid gap-1 py-3 text-sm sm:grid-cols-[1fr_90px_110px_110px_minmax(180px,1.5fr)]"
              >
                <span>
                  День {lesson.day_number}: {lesson.title}
                </span>
                <span>{count} ответов</span>
                <span>Средняя {lessonAverage === null ? "—" : lessonAverage.toFixed(1)}</span>
                <span>Сложно: {hardShare === null ? "—" : `${Math.round(hardShare * 100)}%`}</span>
                <span className="text-muted-foreground" title={mainRemark}>
                  {mainRemark ? `Замечание: ${mainRemark.slice(0, 90)}` : "Основные замечания: —"}
                </span>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

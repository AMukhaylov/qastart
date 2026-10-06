import { courseDate, courseDay, lessonOpensAt } from "./course-schedule.ts";

type Lesson = { id: string; day_number: number; homework_md?: string | null };
type Progress = { lesson_id: string; completed: boolean; completed_at: string | null };
type Submission = { id: string; lesson_id: string; created_at: string; status?: string };
type HomeworkMessage = {
  submission_id: string;
  author_role: string;
  created_at: string;
};
type HomeworkBlock = { id: string; lesson_id: string; content: unknown };
type SqlAttempt = { block_id: string; task_id: string; passed: boolean; passed_at: string | null };

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function earliest(current: string | undefined, candidate: string) {
  return !current || candidate < current ? candidate : current;
}

function latest(current: string | undefined, candidate: string) {
  return !current || candidate > current ? candidate : current;
}

export function sqlHomeworkSubmittedAtByLesson(blocks: HomeworkBlock[], attempts: SqlAttempt[]) {
  const byTask = new Map(
    attempts
      .filter((attempt) => attempt.passed && attempt.passed_at)
      .map((attempt) => [`${attempt.block_id}:${attempt.task_id}`, attempt.passed_at!]),
  );
  const result = new Map<string, string>();
  for (const block of blocks) {
    if (record(block.content)?.mode !== "sql_sandbox") continue;
    const tasks = record(record(block.content)?.sandbox)?.tasks;
    const taskIds = Array.isArray(tasks)
      ? tasks.flatMap((task) => {
          const id = record(task)?.id;
          return typeof id === "string" ? [id] : [];
        })
      : [];
    if (!taskIds.length) continue;
    const passedAt = taskIds.map((id) => byTask.get(`${block.id}:${id}`));
    if (passedAt.some((value) => !value)) continue;
    const submittedAt = (passedAt as string[]).sort().at(-1)!;
    const current = result.get(block.lesson_id);
    if (!current || submittedAt < current) result.set(block.lesson_id, submittedAt);
  }
  return result;
}

export type HomeworkSnapshot = {
  lessonId: string;
  dayNumber: number;
  lessonAvailableAt: string | null;
  lessonCompletedAt: string | null;
  firstSubmittedAt: string | null;
  lastSubmittedAt: string | null;
  delayHours: number | null;
  assigned: boolean;
  sameCalendarDay: boolean;
  reviewStatus: string | null;
};

export type HomeworkTimingCounts = {
  assigned: number;
  submitted: number;
  notSubmitted: number;
  sameCalendarDay: number;
  under24Hours: number;
  hours24To48: number;
  hours48To72: number;
  over72Hours: number;
  averageDelayHours: number | null;
  medianDelayHours: number | null;
};

export function buildHomeworkSnapshots(input: {
  lessons: Lesson[];
  courseStartAt?: string | null;
  progress: Progress[];
  submissions: Submission[];
  messages?: HomeworkMessage[];
  homeworkBlocks: HomeworkBlock[];
  sqlAttempts: SqlAttempt[];
  now?: Date;
}): HomeworkSnapshot[] {
  const progressByLesson = new Map(
    input.progress
      .filter((item) => item.completed && item.completed_at)
      .map((item) => [item.lesson_id, item.completed_at!]),
  );
  const submissionsById = new Map(input.submissions.map((item) => [item.id, item]));
  const manualFirst = new Map<string, string>();
  const manualLast = new Map<string, string>();
  const latestSubmission = new Map<string, Submission>();

  for (const message of input.messages ?? []) {
    if (message.author_role !== "student") continue;
    const submission = submissionsById.get(message.submission_id);
    if (!submission) continue;
    manualFirst.set(
      submission.lesson_id,
      earliest(manualFirst.get(submission.lesson_id), message.created_at),
    );
    manualLast.set(
      submission.lesson_id,
      latest(manualLast.get(submission.lesson_id), message.created_at),
    );
  }

  for (const submission of input.submissions) {
    // The immutable server-stamped created_at is a safe fallback for old rows
    // whose student message was not recorded.
    manualFirst.set(
      submission.lesson_id,
      earliest(manualFirst.get(submission.lesson_id), submission.created_at),
    );
    manualLast.set(
      submission.lesson_id,
      latest(manualLast.get(submission.lesson_id), submission.created_at),
    );
    const current = latestSubmission.get(submission.lesson_id);
    if (!current || submission.created_at > current.created_at) {
      latestSubmission.set(submission.lesson_id, submission);
    }
  }

  const sqlSubmittedAt = sqlHomeworkSubmittedAtByLesson(input.homeworkBlocks, input.sqlAttempts);
  const homeworkLessonIds = new Set(input.homeworkBlocks.map((block) => block.lesson_id));
  const currentCourseDay = courseDay(input.courseStartAt ?? null, input.now);

  return input.lessons
    .filter((lesson) => homeworkLessonIds.has(lesson.id) || Boolean(lesson.homework_md?.trim()))
    .map((lesson) => {
      const lessonCompletedAt = progressByLesson.get(lesson.id) ?? null;
      const sqlAt = sqlSubmittedAt.get(lesson.id) ?? null;
      const firstSubmittedAt =
        [manualFirst.get(lesson.id), sqlAt]
          .filter((value): value is string => Boolean(value))
          .sort()[0] ?? null;
      const lastSubmittedAt = latest(manualLast.get(lesson.id), sqlAt ?? "") || null;
      const submitted = Boolean(firstSubmittedAt);
      const delayHours =
        lessonCompletedAt && firstSubmittedAt
          ? Math.max(0, (Date.parse(firstSubmittedAt) - Date.parse(lessonCompletedAt)) / 3_600_000)
          : null;

      return {
        lessonId: lesson.id,
        dayNumber: lesson.day_number,
        lessonAvailableAt:
          input.courseStartAt && lesson.day_number > 0
            ? lessonOpensAt(input.courseStartAt, Math.min(lesson.day_number, 14))
            : null,
        lessonCompletedAt,
        firstSubmittedAt,
        lastSubmittedAt: submitted ? lastSubmittedAt : null,
        delayHours,
        // The homework is issued when its lesson becomes available, even if
        // the learner has not completed the lesson yet. Future lessons are
        // not counted until their scheduled day.
        assigned: input.courseStartAt
          ? lesson.day_number <= currentCourseDay
          : Boolean(lessonCompletedAt),
        sameCalendarDay:
          Boolean(lessonCompletedAt && firstSubmittedAt) &&
          courseDate(lessonCompletedAt!) === courseDate(firstSubmittedAt!),
        reviewStatus: latestSubmission.get(lesson.id)?.status ?? null,
      };
    });
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function countHomeworkTimings(snapshots: HomeworkSnapshot[]): HomeworkTimingCounts {
  const assigned = snapshots.filter((item) => item.assigned);
  const submitted = assigned.filter((item) => item.firstSubmittedAt);
  const delays = submitted.flatMap((item) => (item.delayHours === null ? [] : [item.delayHours]));
  return {
    assigned: assigned.length,
    submitted: submitted.length,
    notSubmitted: assigned.length - submitted.length,
    sameCalendarDay: submitted.filter((item) => item.sameCalendarDay).length,
    under24Hours: delays.filter((hours) => hours < 24).length,
    hours24To48: delays.filter((hours) => hours >= 24 && hours < 48).length,
    hours48To72: delays.filter((hours) => hours >= 48 && hours < 72).length,
    over72Hours: delays.filter((hours) => hours >= 72).length,
    averageDelayHours: delays.length
      ? delays.reduce((sum, hours) => sum + hours, 0) / delays.length
      : null,
    medianDelayHours: median(delays),
  };
}

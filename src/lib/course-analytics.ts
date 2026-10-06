import { getAcceptedSqlHomeworkLessonIds } from "./homework-status.ts";
import { buildHomeworkSnapshots, countHomeworkTimings } from "./course-homework.ts";
import { courseDay } from "./course-schedule.ts";

export type AnalyticsStudent = {
  id: string;
  full_name: string | null;
  login: string;
  created_at: string | null;
  course_start_at?: string | null;
};

type AnalyticsLesson = {
  id: string;
  day_number: number;
  title: string;
  homework_md?: string | null;
};
type AnalyticsProgress = {
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
};
type AnalyticsBlockProgress = { user_id: string; lesson_id: string; completed_at: string };
type AnalyticsSubmission = {
  id: string;
  user_id: string;
  lesson_id: string;
  status: string;
  created_at: string;
  reviewed_at: string | null;
};
type AnalyticsHomeworkMessage = {
  submission_id: string;
  user_id: string;
  author_role: string;
  created_at: string;
};
type AnalyticsHomeworkBlock = {
  id: string;
  lesson_id: string;
  content: Record<string, unknown>;
};
type AnalyticsSqlAttempt = {
  user_id: string;
  block_id: string;
  lesson_id: string;
  task_id: string;
  passed: boolean;
  passed_at?: string | null;
  created_at: string;
};
type QuizQuestion = {
  id: string;
  topic?: string;
  text?: string;
  correctOptionId?: string;
  options?: Array<{ id: string; text: string }>;
};
type AnalyticsQuizAttempt = {
  user_id: string;
  question_order: unknown;
  answers: unknown;
  percentage: number | null;
  passed: boolean | null;
  timed_out: boolean;
  disqualified: boolean;
  started_at: string;
  finished_at: string | null;
};
export type AnalyticsLessonQuestionAnswer = {
  user_id: string;
  lesson_id: string;
  block_id: string;
  answered_at: string;
  question_text: string;
  options: string[];
  selected_indexes: number[];
  correct_indexes: number[];
  is_correct: boolean;
};

export type CourseAnalyticsInput = {
  students: AnalyticsStudent[];
  lessons: AnalyticsLesson[];
  progress: AnalyticsProgress[];
  blockProgress: AnalyticsBlockProgress[];
  submissions: AnalyticsSubmission[];
  homeworkMessages: AnalyticsHomeworkMessage[];
  homeworkBlocks: AnalyticsHomeworkBlock[];
  sqlAttempts: AnalyticsSqlAttempt[];
  quizAttempts: AnalyticsQuizAttempt[];
  lessonQuestionAnswers: AnalyticsLessonQuestionAnswer[];
  now?: Date;
};

export type CourseAnalytics = ReturnType<typeof buildCourseAnalytics>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function dateMs(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function questionSnapshot(order: unknown) {
  const record = asRecord(order);
  const questionIds = Array.isArray(record?.questionIds)
    ? record.questionIds.filter((id): id is string => typeof id === "string")
    : [];
  const questionsById = asRecord(record?.questionsById) ?? {};
  return { questionIds, questionsById };
}

function answerMap(answers: unknown) {
  const record = asRecord(answers) ?? {};
  return Object.fromEntries(
    Object.entries(record).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export function buildCourseAnalytics(input: CourseAnalyticsInput) {
  const nowMs = (input.now ?? new Date()).getTime();
  const studentsById = new Map(input.students.map((student) => [student.id, student]));
  const progressByStudent = new Map<string, AnalyticsProgress[]>();
  const activityByStudent = new Map<string, number[]>();
  const activityByStudentLesson = new Map<string, number[]>();
  const finalLessonId = input.lessons.find((lesson) => lesson.day_number === 14)?.id ?? "";
  const addActivity = (userId: string, lessonId: string, timestamp: string | null | undefined) => {
    const time = dateMs(timestamp);
    if (time === null) return;
    const studentActivities = activityByStudent.get(userId) ?? [];
    studentActivities.push(time);
    activityByStudent.set(userId, studentActivities);
    const key = `${userId}:${lessonId}`;
    const lessonActivities = activityByStudentLesson.get(key) ?? [];
    lessonActivities.push(time);
    activityByStudentLesson.set(key, lessonActivities);
  };

  for (const row of input.progress) {
    if (!studentsById.has(row.user_id)) continue;
    const studentProgress = progressByStudent.get(row.user_id) ?? [];
    studentProgress.push(row);
    progressByStudent.set(row.user_id, studentProgress);
    addActivity(row.user_id, row.lesson_id, row.completed_at ?? row.created_at);
  }
  for (const row of input.blockProgress) {
    if (studentsById.has(row.user_id)) addActivity(row.user_id, row.lesson_id, row.completed_at);
  }

  const latestSubmissions = new Map<string, AnalyticsSubmission>();
  for (const submission of input.submissions) {
    if (!studentsById.has(submission.user_id)) continue;
    addActivity(submission.user_id, submission.lesson_id, submission.created_at);
    const key = `${submission.user_id}:${submission.lesson_id}`;
    const existing = latestSubmissions.get(key);
    if (!existing || submission.created_at > existing.created_at)
      latestSubmissions.set(key, submission);
  }
  for (const attempt of input.sqlAttempts) {
    if (studentsById.has(attempt.user_id)) {
      addActivity(attempt.user_id, attempt.lesson_id, attempt.created_at);
    }
  }
  for (const answer of input.lessonQuestionAnswers) {
    if (studentsById.has(answer.user_id)) {
      addActivity(answer.user_id, answer.lesson_id, answer.answered_at);
    }
  }
  for (const attempt of input.quizAttempts) {
    if (!studentsById.has(attempt.user_id)) continue;
    addActivity(attempt.user_id, finalLessonId, attempt.started_at);
    addActivity(attempt.user_id, finalLessonId, attempt.finished_at);
  }

  const sqlHomeworkBlocks = input.homeworkBlocks.filter(
    (block) => block.content.mode === "sql_sandbox",
  );
  const sqlAttemptsByStudent = new Map<string, AnalyticsSqlAttempt[]>();
  for (const attempt of input.sqlAttempts) {
    const attempts = sqlAttemptsByStudent.get(attempt.user_id) ?? [];
    attempts.push(attempt);
    sqlAttemptsByStudent.set(attempt.user_id, attempts);
  }
  const acceptedSqlByStudent = new Map<string, Set<string>>();
  for (const student of input.students) {
    const accepted = getAcceptedSqlHomeworkLessonIds(
      sqlHomeworkBlocks,
      sqlAttemptsByStudent.get(student.id) ?? [],
    );
    acceptedSqlByStudent.set(student.id, accepted);
  }

  let approvedHomeworks = 0;
  let pendingHomeworks = 0;
  let awaitingMentorHomeworks = 0;
  let rejectedHomeworks = 0;
  let sqlHomeworksCompleted = 0;
  const mentorReviewHours: number[] = [];
  for (const [key, submission] of latestSubmissions) {
    if (submission.status === "approved") approvedHomeworks += 1;
    else if (submission.status === "pending") pendingHomeworks += 1;
    else if (submission.status === "rejected") rejectedHomeworks += 1;
    else if (submission.status === "awaiting_mentor") awaitingMentorHomeworks += 1;

    const submittedAt = dateMs(submission.created_at);
    const reviewedAt = dateMs(submission.reviewed_at);
    if (reviewedAt !== null && submittedAt !== null && reviewedAt >= submittedAt) {
      mentorReviewHours.push((reviewedAt - submittedAt) / 3_600_000);
    }
  }
  for (const accepted of acceptedSqlByStudent.values()) sqlHomeworksCompleted += accepted.size;

  const finishedQuizAttempts = input.quizAttempts.filter(
    (attempt) => attempt.finished_at && !attempt.disqualified,
  );
  const quizAttemptsByStudent = new Map<string, AnalyticsQuizAttempt[]>();
  for (const attempt of finishedQuizAttempts) {
    const attempts = quizAttemptsByStudent.get(attempt.user_id) ?? [];
    attempts.push(attempt);
    quizAttemptsByStudent.set(attempt.user_id, attempts);
  }
  const quizDurations = finishedQuizAttempts.flatMap((attempt) => {
    const start = dateMs(attempt.started_at);
    const finish = dateMs(attempt.finished_at);
    return start !== null && finish !== null && finish >= start ? [(finish - start) / 60_000] : [];
  });
  const questionStats = new Map<
    string,
    {
      id: string;
      topic: string;
      text: string;
      correctOptionId: string | null;
      seen: number;
      answered: number;
      correct: number;
      options: Map<string, { text: string; count: number }>;
    }
  >();
  for (const attempt of finishedQuizAttempts) {
    const { questionIds, questionsById } = questionSnapshot(attempt.question_order);
    const answers = answerMap(attempt.answers);
    for (const questionId of questionIds) {
      const question = asRecord(questionsById[questionId]) as QuizQuestion | null;
      if (!question || typeof question.id !== "string") continue;
      const item = questionStats.get(questionId) ?? {
        id: question.id,
        topic: question.topic ?? "Без темы",
        text: question.text ?? "Вопрос недоступен",
        correctOptionId: question.correctOptionId ?? null,
        seen: 0,
        answered: 0,
        correct: 0,
        options: new Map(),
      };
      item.seen += 1;
      const selectedOptionId = answers[questionId];
      if (selectedOptionId) {
        item.answered += 1;
        const option = question.options?.find((candidate) => candidate.id === selectedOptionId);
        const optionStats = item.options.get(selectedOptionId) ?? {
          text: option?.text ?? "Другой ответ",
          count: 0,
        };
        optionStats.count += 1;
        item.options.set(selectedOptionId, optionStats);
      }
      if (selectedOptionId && selectedOptionId === question.correctOptionId) item.correct += 1;
      questionStats.set(questionId, item);
    }
  }

  const students = input.students.map((student) => {
    const progress = progressByStudent.get(student.id) ?? [];
    const completedLessonIds = new Set(
      progress.filter((item) => item.completed).map((item) => item.lesson_id),
    );
    const attempts = quizAttemptsByStudent.get(student.id) ?? [];
    const passedAttempt = attempts
      .filter((attempt) => attempt.passed)
      .sort((left, right) => (left.finished_at ?? "").localeCompare(right.finished_at ?? ""))[0];
    const activities = activityByStudent.get(student.id) ?? [];
    const firstActivity = activities.length ? Math.min(...activities) : null;
    const lastActivity = activities.length ? Math.max(...activities) : null;
    const referenceEnd = passedAttempt?.finished_at ? dateMs(passedAttempt.finished_at) : null;
    const homeworkStatuses = [...latestSubmissions.entries()]
      .filter(([key]) => key.startsWith(`${student.id}:`))
      .map(([, submission]) => submission);
    const completedHomeworkCount =
      homeworkStatuses.filter((submission) => submission.status === "approved").length +
      (acceptedSqlByStudent.get(student.id)?.size ?? 0);
    const studentQuizScores = attempts.flatMap((attempt) =>
      attempt.percentage === null ? [] : [attempt.percentage],
    );
    const idleDays =
      lastActivity === null ? null : Math.max(0, Math.floor((nowMs - lastActivity) / 86_400_000));
    const homeworkSnapshots = buildHomeworkSnapshots({
      lessons: input.lessons,
      courseStartAt: student.course_start_at ?? null,
      progress,
      submissions: input.submissions.filter((item) => item.user_id === student.id),
      messages: input.homeworkMessages.filter((item) => item.user_id === student.id),
      homeworkBlocks: input.homeworkBlocks,
      sqlAttempts: (sqlAttemptsByStudent.get(student.id) ?? []).map((item) => ({
        ...item,
        passed_at: item.passed_at ?? null,
      })),
      now: new Date(nowMs),
    });
    const homeworkMetrics = countHomeworkTimings(homeworkSnapshots);
    const currentDay = courseDay(student.course_start_at ?? null, new Date(nowMs));
    return {
      id: student.id,
      name: student.full_name?.trim() || student.login || "Ученик без имени",
      login: student.login,
      registeredAt: student.created_at,
      courseStartAt: student.course_start_at ?? null,
      currentDay,
      availableLessons: input.lessons
        .filter((lesson) => lesson.day_number >= 1 && lesson.day_number <= currentDay)
        .map((lesson) => lesson.day_number),
      availableLessonCount: input.lessons.filter(
        (lesson) => lesson.day_number >= 1 && lesson.day_number <= currentDay,
      ).length,
      completedLessonTimes: progress
        .filter((item) => item.completed)
        .map((item) => ({ lessonId: item.lesson_id, completedAt: item.completed_at })),
      homeworkSnapshots,
      homeworkMetrics,
      completedLessons: completedLessonIds.size,
      totalLessons: input.lessons.length,
      passedCourse: Boolean(passedAttempt),
      quizAttempts: attempts.length,
      bestQuizPercent: studentQuizScores.length ? Math.max(...studentQuizScores) : null,
      approvedHomework: completedHomeworkCount,
      pendingHomework: homeworkStatuses.filter((submission) => submission.status === "pending")
        .length,
      awaitingMentorHomework: homeworkStatuses.filter(
        (submission) => submission.status === "awaiting_mentor",
      ).length,
      rejectedHomework: homeworkStatuses.filter((submission) => submission.status === "rejected")
        .length,
      firstActivityAt: firstActivity === null ? null : new Date(firstActivity).toISOString(),
      lastActivityAt: lastActivity === null ? null : new Date(lastActivity).toISOString(),
      idleDays,
      elapsedDays:
        firstActivity === null || referenceEnd === null
          ? null
          : Math.max(0, Math.round((referenceEnd - firstActivity) / 86_400_000)),
    };
  });

  const startedStudents = students.filter((student) => student.firstActivityAt !== null).length;
  const homeworkDelaySamples = students.flatMap((student) =>
    student.homeworkSnapshots.flatMap((snapshot) =>
      snapshot.assigned && snapshot.delayHours !== null ? [snapshot.delayHours] : [],
    ),
  );
  const homeworkTotals = students.reduce(
    (sum, student) => ({
      assigned: sum.assigned + student.homeworkMetrics.assigned,
      submitted: sum.submitted + student.homeworkMetrics.submitted,
      notSubmitted: sum.notSubmitted + student.homeworkMetrics.notSubmitted,
      sameCalendarDay: sum.sameCalendarDay + student.homeworkMetrics.sameCalendarDay,
      under24Hours: sum.under24Hours + student.homeworkMetrics.under24Hours,
      hours24To48: sum.hours24To48 + student.homeworkMetrics.hours24To48,
      hours48To72: sum.hours48To72 + student.homeworkMetrics.hours48To72,
      over72Hours: sum.over72Hours + student.homeworkMetrics.over72Hours,
    }),
    {
      assigned: 0,
      submitted: 0,
      notSubmitted: 0,
      sameCalendarDay: 0,
      under24Hours: 0,
      hours24To48: 0,
      hours48To72: 0,
      over72Hours: 0,
    },
  );
  const midCourseStudents = students.filter(
    (student) => student.completedLessons >= Math.ceil(input.lessons.length / 2),
  ).length;
  const completedCoreLessons = new Set(
    input.lessons.filter((lesson) => lesson.day_number < 14).map((lesson) => lesson.id),
  );
  const coreCourseStudents = students.filter((student) => {
    const progress = progressByStudent.get(student.id) ?? [];
    return (
      completedCoreLessons.size > 0 &&
      completedCoreLessons.size ===
        new Set(
          progress
            .filter((item) => item.completed && completedCoreLessons.has(item.lesson_id))
            .map((item) => item.lesson_id),
        ).size
    );
  }).length;
  const passedStudents = students.filter((student) => student.passedCourse).length;
  const laggingStudents7d = students.filter(
    (student) => !student.passedCourse && student.idleDays !== null && student.idleDays >= 7,
  ).length;
  const laggingStudents14d = students.filter(
    (student) => !student.passedCourse && student.idleDays !== null && student.idleDays >= 14,
  ).length;
  const activeStudents7d = students.filter(
    (student) => student.idleDays !== null && student.idleDays < 7,
  ).length;

  const lessonFunnel = input.lessons
    .filter((lesson) => lesson.day_number < 14)
    .sort((left, right) => left.day_number - right.day_number)
    .map((lesson) => {
      const available = students.filter((student) =>
        student.availableLessons.includes(lesson.day_number),
      ).length;
      const completed = students.filter((student) =>
        (progressByStudent.get(student.id) ?? []).some(
          (item) => item.lesson_id === lesson.id && item.completed,
        ),
      ).length;
      // A completed progress record is definitive evidence of a start, even if
      // legacy rows predate the activity events used by the funnel.
      const started = students.filter(
        (student) =>
          activityByStudentLesson.has(`${student.id}:${lesson.id}`) ||
          (progressByStudent.get(student.id) ?? []).some(
            (item) => item.lesson_id === lesson.id && item.completed,
          ),
      ).length;
      return {
        lessonId: lesson.id,
        dayNumber: lesson.day_number,
        title: lesson.title,
        available,
        started,
        completed,
        completionPercent: started ? Math.round((completed / started) * 100) : 0,
      };
    });

  const homeworkLessonIds = new Set(input.homeworkBlocks.map((block) => block.lesson_id));
  const homeworkFunnel = input.lessons
    .filter((lesson) => homeworkLessonIds.has(lesson.id) || Boolean(lesson.homework_md?.trim()))
    .map((lesson) => {
      const snapshots = students.flatMap((student) =>
        student.homeworkSnapshots.filter((snapshot) => snapshot.lessonId === lesson.id),
      );
      return {
        lessonId: lesson.id,
        dayNumber: lesson.day_number,
        title: lesson.title,
        ...countHomeworkTimings(snapshots),
      };
    });

  const topicStats = new Map<string, { topic: string; seen: number; correct: number }>();
  for (const question of questionStats.values()) {
    const topic = topicStats.get(question.topic) ?? { topic: question.topic, seen: 0, correct: 0 };
    topic.seen += question.seen;
    topic.correct += question.correct;
    topicStats.set(question.topic, topic);
  }

  const lessonById = new Map(input.lessons.map((lesson) => [lesson.id, lesson]));
  const lessonQuestionStats = new Map<
    string,
    {
      id: string;
      lessonDay: number | null;
      lessonTitle: string;
      text: string;
      answered: number;
      correct: number;
      correctIndexes: number[];
      options: Array<{ text: string; count: number }>;
    }
  >();
  for (const answer of input.lessonQuestionAnswers) {
    const lesson = lessonById.get(answer.lesson_id);
    const stats = lessonQuestionStats.get(answer.block_id) ?? {
      id: answer.block_id,
      lessonDay: lesson?.day_number ?? null,
      lessonTitle: lesson?.title ?? "Урок удалён",
      text: answer.question_text,
      answered: 0,
      correct: 0,
      correctIndexes: answer.correct_indexes,
      options: answer.options.map((text) => ({ text, count: 0 })),
    };
    stats.answered += 1;
    if (answer.is_correct) stats.correct += 1;
    for (const index of answer.selected_indexes) {
      if (stats.options[index]) stats.options[index]!.count += 1;
    }
    lessonQuestionStats.set(answer.block_id, stats);
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    totals: {
      students: students.length,
      started: startedStudents,
      completed: passedStudents,
      completionPercent: students.length ? Math.round((passedStudents / students.length) * 100) : 0,
      activeLast7Days: activeStudents7d,
      inactiveAtLeast7Days: laggingStudents7d,
      inactiveAtLeast14Days: laggingStudents14d,
      reachedHalf: midCourseStudents,
      completedLessons1To13: coreCourseStudents,
      finalQuizAttempts: finishedQuizAttempts.length,
      manualHomeworkApproved: approvedHomeworks,
      manualHomeworkPending: pendingHomeworks,
      manualHomeworkAwaitingMentor: awaitingMentorHomeworks,
      manualHomeworkRejected: rejectedHomeworks,
      sqlHomeworkCompleted: sqlHomeworksCompleted,
      homeworkAssigned: homeworkTotals.assigned,
      homeworkSubmitted: homeworkTotals.submitted,
      homeworkNotSubmitted: homeworkTotals.notSubmitted,
      homeworkSameCalendarDay: homeworkTotals.sameCalendarDay,
      homeworkUnder24Hours: homeworkTotals.under24Hours,
      homework24To48Hours: homeworkTotals.hours24To48,
      homework48To72Hours: homeworkTotals.hours48To72,
      homeworkOver72Hours: homeworkTotals.over72Hours,
      averageHomeworkDelayHours: homeworkDelaySamples.length
        ? homeworkDelaySamples.reduce((sum, hours) => sum + hours, 0) / homeworkDelaySamples.length
        : null,
      medianHomeworkDelayHours: median(homeworkDelaySamples),
      medianMentorReviewHours: median(mentorReviewHours),
      medianFinalQuizMinutes: median(quizDurations),
    },
    lessonFunnel,
    homeworkFunnel,
    students: students.sort((left, right) => {
      if (left.passedCourse !== right.passedCourse)
        return Number(left.passedCourse) - Number(right.passedCourse);
      return (right.idleDays ?? -1) - (left.idleDays ?? -1);
    }),
    questionStats: [...questionStats.values()]
      .map((question) => ({
        ...question,
        accuracyPercent: question.seen ? Math.round((question.correct / question.seen) * 100) : 0,
        responsePercent: question.seen ? Math.round((question.answered / question.seen) * 100) : 0,
        topWrongOption:
          [...question.options.entries()]
            .filter(([optionId]) => optionId !== question.correctOptionId)
            .sort((left, right) => right[1].count - left[1].count)[0]?.[1].text ?? null,
        options: [...question.options.values()],
      }))
      .sort(
        (left, right) => left.accuracyPercent - right.accuracyPercent || right.seen - left.seen,
      ),
    topicStats: [...topicStats.values()]
      .map((topic) => ({
        ...topic,
        accuracyPercent: topic.seen ? Math.round((topic.correct / topic.seen) * 100) : 0,
      }))
      .sort((left, right) => left.accuracyPercent - right.accuracyPercent),
    lessonQuestionStats: [...lessonQuestionStats.values()]
      .map((question) => {
        const correctIndexes = new Set(question.correctIndexes);
        const { correctIndexes: _correctIndexes, ...publicQuestion } = question;
        return {
          ...publicQuestion,
          correctIndexes: [...correctIndexes],
          accuracyPercent: question.answered
            ? Math.round((question.correct / question.answered) * 100)
            : 0,
          topWrongOption:
            question.options
              .filter((option, index) => !correctIndexes.has(index) && option.count > 0)
              .sort((left, right) => right.count - left.count)[0]?.text ?? null,
        };
      })
      .sort(
        (left, right) =>
          left.accuracyPercent - right.accuracyPercent || right.answered - left.answered,
      ),
    homeworkDelayNote:
      "Интервалы считаются от завершения урока до первой отправки ДЗ. Это аналитика поведения, не дедлайн; категория «в тот же календарный день» входит в «до 24 часов».",
  };
}

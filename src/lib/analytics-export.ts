type ExportStudent = {
  id: string;
  name: string;
  login: string;
  registeredAt: string | null;
};

type ExportFeedbackResponse = { user_id: string };
type ExportFeedbackSkip = { user_id: string };

export function buildAnalyticsExport<
  TStudent extends ExportStudent,
  TResponse extends ExportFeedbackResponse,
  TSkip extends ExportFeedbackSkip,
  TData extends {
    generatedAt: string;
    students: TStudent[];
    feedbackQuestionsByLesson: Record<string, unknown[]>;
    feedbackResponses: TResponse[];
    feedbackSkips: TSkip[];
  },
>(data: TData, exportedAt = new Date()) {
  const { students, feedbackQuestionsByLesson, feedbackResponses, feedbackSkips, ...analytics } =
    data;
  const studentKeys = new Map(
    [...new Set(students.map((student) => student.id))]
      .sort()
      .map((id, index) => [id, `student_${String(index + 1).padStart(3, "0")}`]),
  );

  return {
    schemaVersion: "1.0",
    course: "QA Start",
    generatedAt: data.generatedAt,
    exportedAt: exportedAt.toISOString(),
    privacy: {
      studentNamesAndLoginsRemoved: true,
      studentIdsPseudonymized: true,
      freeTextMayContainPersonalData: true,
    },
    analytics: {
      ...analytics,
      students: students.map(
        ({ id, name: _name, login: _login, registeredAt: _registeredAt, ...metrics }) => ({
          studentKey: studentKeys.get(id) ?? "student_unknown",
          ...metrics,
        }),
      ),
    },
    feedback: {
      questionsByLesson: feedbackQuestionsByLesson,
      responses: feedbackResponses.map(({ user_id, ...response }) => ({
        studentKey: studentKeys.get(user_id) ?? "student_unknown",
        ...response,
      })),
      skipped: feedbackSkips.map(({ user_id, ...skip }) => ({
        studentKey: studentKeys.get(user_id) ?? "student_unknown",
        ...skip,
      })),
    },
  };
}

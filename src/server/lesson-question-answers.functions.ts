import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { buildLessonQuestionAnswer, sameIndexes } from "@/lib/lesson-question-answer";
import { getRolesForAccessToken, getUserIdForAccessToken } from "./admin-auth.server";

const input = z.object({
  accessToken: z.string().min(20),
  blockId: z.string().uuid(),
  selectedIndexes: z.array(z.number().int().nonnegative()).min(1).max(100),
});

export const saveLessonQuestionAnswer = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const [userId, roles] = await Promise.all([
      getUserIdForAccessToken(data.accessToken),
      getRolesForAccessToken(data.accessToken, 2),
    ]);
    const isAdmin = roles.includes("admin");
    const { data: block, error: blockError } = await supabaseAdmin
      .from("lesson_blocks")
      .select("id,lesson_id,block_type,content")
      .eq("id", data.blockId)
      .maybeSingle();
    if (blockError) throw blockError;
    if (!block || block.block_type !== "question") throw new Error("Вопрос не найден");

    const [
      { data: lesson, error: lessonError },
      { data: existingAnswer, error: answerError },
      { data: completedBlock, error: completedBlockError },
    ] = await Promise.all([
      supabaseAdmin.from("lessons").select("id,day_number").eq("id", block.lesson_id).maybeSingle(),
      supabaseAdmin
        .from("lesson_question_answers")
        .select("id,selected_indexes,is_correct")
        .eq("user_id", userId)
        .eq("block_id", block.id)
        .maybeSingle(),
      supabaseAdmin
        .from("lesson_block_progress")
        .select("id")
        .eq("user_id", userId)
        .eq("block_id", block.id)
        .maybeSingle(),
    ]);
    if (lessonError) throw lessonError;
    if (answerError) throw answerError;
    if (completedBlockError) throw completedBlockError;
    if (!lesson) throw new Error("Урок не найден");
    if (!isAdmin && completedBlock && !existingAnswer) {
      throw new Error("Ответ на этот вопрос уже отмечен выполненным");
    }

    if (!isAdmin) {
      if (lesson.day_number > 1) {
        const { data: previousLesson, error: previousLessonError } = await supabaseAdmin
          .from("lessons")
          .select("id")
          .eq("day_number", lesson.day_number - 1)
          .maybeSingle();
        if (previousLessonError) throw previousLessonError;
        if (!previousLesson) throw new Error("Урок пока недоступен");
        const { data: previousProgress, error: previousProgressError } = await supabaseAdmin
          .from("lesson_progress")
          .select("completed")
          .eq("user_id", userId)
          .eq("lesson_id", previousLesson.id)
          .maybeSingle();
        if (previousProgressError) throw previousProgressError;
        if (!previousProgress?.completed) throw new Error("Сначала заверши предыдущий урок");
      }
      if (!existingAnswer) {
        const { data: currentProgress, error: currentProgressError } = await supabaseAdmin
          .from("lesson_progress")
          .select("completed")
          .eq("user_id", userId)
          .eq("lesson_id", lesson.id)
          .maybeSingle();
        if (currentProgressError) throw currentProgressError;
        if (!currentProgress?.completed) {
          const now = new Date();
          const courseDay = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Asia/Yekaterinburg",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(now);
          const dayStart = new Date(`${courseDay}T00:00:00+05:00`).toISOString();
          const dayEnd = new Date(Date.parse(dayStart) + 86_400_000).toISOString();
          const { count, error: countError } = await supabaseAdmin
            .from("lesson_progress")
            .select("id", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("completed", true)
            .gte("completed_at", dayStart)
            .lt("completed_at", dayEnd);
          if (countError) throw countError;
          if ((count ?? 0) >= 3) throw new Error("Достигнут дневной лимит новых уроков");
        }
      }
    }

    const answer = buildLessonQuestionAnswer(block.content, data.selectedIndexes);
    if (existingAnswer) {
      if (!sameIndexes(existingAnswer.selected_indexes, answer.selectedIndexes)) {
        throw new Error("Ответ на этот вопрос уже сохранён");
      }
      return { saved: true, isCorrect: existingAnswer.is_correct };
    }

    const { error: saveError } = await supabaseAdmin.from("lesson_question_answers").insert({
      user_id: userId,
      lesson_id: lesson.id,
      block_id: block.id,
      question_text: answer.questionText,
      options: answer.options,
      selected_indexes: answer.selectedIndexes,
      correct_indexes: answer.correctIndexes,
      is_correct: answer.isCorrect,
    });
    if (saveError?.code === "23505") {
      const { data: savedAnswer, error: savedAnswerError } = await supabaseAdmin
        .from("lesson_question_answers")
        .select("selected_indexes,is_correct")
        .eq("user_id", userId)
        .eq("block_id", block.id)
        .maybeSingle();
      if (savedAnswerError) throw savedAnswerError;
      if (savedAnswer && sameIndexes(savedAnswer.selected_indexes, answer.selectedIndexes)) {
        return { saved: true, isCorrect: savedAnswer.is_correct };
      }
      throw new Error("Ответ на этот вопрос уже сохранён");
    }
    if (saveError) throw saveError;
    return { saved: true, isCorrect: answer.isCorrect };
  });

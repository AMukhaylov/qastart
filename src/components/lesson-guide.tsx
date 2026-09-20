import { Lightbulb, MessageCircleQuestion, PartyPopper, Sparkles } from "lucide-react";
import guideSheet from "@/assets/lesson-guide-sheet.jpg";

export type LessonGuideVariant =
  | "intro"
  | "explain"
  | "important"
  | "question"
  | "task"
  | "success";

const artworkPosition: Record<LessonGuideVariant, string> = {
  intro: "0% 0%",
  explain: "50% 0%",
  important: "100% 0%",
  question: "0% 100%",
  task: "50% 100%",
  success: "100% 100%",
};

const icons = {
  intro: Sparkles,
  explain: Lightbulb,
  important: Lightbulb,
  question: MessageCircleQuestion,
  task: Sparkles,
  success: PartyPopper,
};

export function LessonGuide({
  variant,
  title,
  text,
}: {
  variant: LessonGuideVariant;
  title: string;
  text: string;
}) {
  const Icon = icons[variant];
  return (
    <aside className="overflow-hidden rounded-2xl border border-primary/15 bg-primary-soft/70 shadow-[var(--shadow-soft)]">
      <div className="grid items-center gap-4 p-5 sm:grid-cols-[1fr_156px] sm:p-6">
        <div className="order-2 sm:order-1">
          <div className="inline-flex items-center gap-2 text-sm font-bold text-primary">
            <Icon className="h-4 w-4" /> Твой проводник
          </div>
          <h2 className="mt-2 text-xl font-extrabold tracking-tight">{title}</h2>
          <p className="mt-2 leading-relaxed text-foreground/80">{text}</p>
        </div>
        <div
          role="img"
          aria-label="Иллюстрация наставника QA Start"
          className="order-1 mx-auto h-36 w-36 rounded-2xl bg-cover bg-no-repeat shadow-sm sm:order-2 sm:h-40 sm:w-40"
          style={{
            backgroundImage: `url(${guideSheet})`,
            backgroundSize: "300% 200%",
            backgroundPosition: artworkPosition[variant],
          }}
        />
      </div>
    </aside>
  );
}

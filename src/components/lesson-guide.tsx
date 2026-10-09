import { Clock3, Lightbulb, MessageCircleQuestion, PartyPopper, Sparkles } from "lucide-react";
import guideSheet from "@/assets/lesson-guide-sheet.jpg";
import pendingArtwork from "@/assets/lesson-guide-pending.webp";
import { lessonGuideArtworkPosition, type LessonGuideVariant } from "@/lib/lesson-guide";
import { LessonRichContent } from "@/components/lesson-rich-content";

const icons = {
  intro: Sparkles,
  explain: Lightbulb,
  important: Lightbulb,
  question: MessageCircleQuestion,
  task: Sparkles,
  pending: Clock3,
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
          <div className="mt-2 leading-relaxed text-foreground/80">
            <LessonRichContent content={text} />
          </div>
        </div>
        <div
          role="img"
          aria-label="Иллюстрация наставника QA Start"
          className="order-1 mx-auto h-36 w-36 rounded-2xl bg-cover bg-no-repeat shadow-sm sm:order-2 sm:h-40 sm:w-40"
          style={{
            backgroundImage: `url(${variant === "pending" ? pendingArtwork : guideSheet})`,
            backgroundSize: variant === "pending" ? "cover" : "300% 200%",
            backgroundPosition:
              variant === "pending" ? "center" : lessonGuideArtworkPosition[variant],
          }}
        />
      </div>
    </aside>
  );
}

import { useEffect, useState } from "react";
import { lessonContentToHtml } from "@/lib/lesson-content";

type LessonRichContentProps = {
  content: string;
};

export function LessonRichContent({ content }: LessonRichContentProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    setHtml(lessonContentToHtml(content));
  }, [content]);

  if (!html) {
    return <div className="whitespace-pre-wrap text-[15px] leading-relaxed">{content}</div>;
  }

  return <div className="lesson-rich-content" dangerouslySetInnerHTML={{ __html: html }} />;
}

import { useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Smile } from "lucide-react";
import { lessonContentToHtml, sanitizeLessonHtml } from "@/lib/lesson-content";
import { homeworkMessageHasContent } from "@/lib/homework-message";

const EMOJIS = ["😀", "🙂", "👍", "🎉", "✅", "🔍", "🚀", "💡", "🙏", "😕"];

type HomeworkMessageEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  rows?: "compact" | "regular";
};

export function HomeworkMessageEditor({
  value,
  onChange,
  label,
  placeholder,
  rows = "regular",
}: HomeworkMessageEditorProps) {
  const [showEmojis, setShowEmojis] = useState(false);
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] }, link: false })],
    content: "",
    editorProps: {
      attributes: {
        class: `tiptap-editor overflow-y-auto px-3 py-3 text-sm leading-relaxed focus:outline-none ${
          rows === "compact" ? "min-h-24 max-h-72" : "min-h-36 max-h-[420px]"
        }`,
        "aria-label": label,
      },
      transformPastedHTML: (html) => sanitizeLessonHtml(html),
    },
    onUpdate: ({ editor: updatedEditor }) => onChange(sanitizeLessonHtml(updatedEditor.getHTML())),
  });

  useEffect(() => {
    if (!editor) return;
    const nextHtml = lessonContentToHtml(value);
    if (editor.getHTML() !== nextHtml) editor.commands.setContent(nextHtml, { emitUpdate: false });
  }, [editor, value]);

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5">
        <button
          type="button"
          title="Жирный"
          aria-label="Жирный"
          aria-pressed={editor?.isActive("bold") ?? false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${editor?.isActive("bold") ? "bg-primary-soft text-primary" : ""}`}
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Курсив"
          aria-label="Курсив"
          aria-pressed={editor?.isActive("italic") ?? false}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground ${editor?.isActive("italic") ? "bg-primary-soft text-primary" : ""}`}
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          type="button"
          title="Добавить эмодзи"
          aria-label="Добавить эмодзи"
          aria-expanded={showEmojis}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setShowEmojis((open) => !open)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Smile className="h-4 w-4" />
        </button>
        {showEmojis && (
          <div className="flex flex-wrap gap-1 border-l border-border pl-2" aria-label="Эмодзи">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                aria-label={`Вставить ${emoji}`}
                title={`Вставить ${emoji}`}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  editor?.chain().focus().insertContent(emoji).run();
                  setShowEmojis(false);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-lg hover:bg-muted"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="px-3 pt-2">
        {placeholder && <p className="text-xs text-muted-foreground">{placeholder}</p>}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

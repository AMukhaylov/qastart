import { useEffect, useState, type ReactNode } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import { Bold, Code, CodeXml, Italic, Link2, Palette, Quote, Smile, X } from "lucide-react";
import { lessonContentToHtml, sanitizeLessonHtml } from "@/lib/lesson-content";

const EMOJIS = ["😀", "🙂", "👍", "🎉", "✅", "🔍", "🚀", "💡", "🙏", "😕"];

type HomeworkMessageEditorProps = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  rows?: "compact" | "regular";
};

function ToolbarButton({
  editor,
  label,
  active = false,
  onClick,
  children,
}: {
  editor: Editor | null;
  label: string;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={!editor}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40 ${active ? "bg-primary-soft text-primary" : ""}`}
    >
      {children}
    </button>
  );
}

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
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: false }),
      TextStyle,
      Color,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
        defaultProtocol: "https",
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      }),
    ],
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

  function setLink() {
    if (!editor) return;
    const currentUrl = editor.getAttributes("link").href as string | undefined;
    const enteredUrl = window.prompt("Вставь ссылку", currentUrl ?? "");
    if (enteredUrl === null) return;

    const value = enteredUrl.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const url = /^(https?:\/\/|mailto:)/i.test(value) ? value : `https://${value}`;
    try {
      const parsed = new URL(url);
      if (["http:", "https:", "mailto:"].includes(parsed.protocol)) {
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
      }
    } catch {
      // Ignore invalid URLs instead of saving unsafe or malformed links.
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-input bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring/30">
      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 p-1.5">
        <ToolbarButton
          editor={editor}
          label="Жирный"
          active={editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        >
          <Bold className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Курсив"
          active={editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Цитата"
          active={editor?.isActive("blockquote")}
          onClick={() => editor?.chain().focus().toggleBlockquote().run()}
        >
          <Quote className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Строка кода"
          active={editor?.isActive("code")}
          onClick={() => editor?.chain().focus().toggleCode().run()}
        >
          <Code className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Блок кода"
          active={editor?.isActive("codeBlock")}
          onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
        >
          <CodeXml className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label={editor?.isActive("link") ? "Изменить или удалить ссылку" : "Вставить ссылку"}
          active={editor?.isActive("link")}
          onClick={setLink}
        >
          <Link2 className="h-4 w-4" />
        </ToolbarButton>
        <label
          title="Цвет текста"
          className="relative inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Palette className="h-4 w-4" />
          <input
            type="color"
            aria-label="Цвет текста"
            value={editor?.getAttributes("textStyle").color || "#1d4ed8"}
            onChange={(event) => editor?.chain().focus().setColor(event.target.value).run()}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <ToolbarButton
          editor={editor}
          label="Сбросить цвет текста"
          onClick={() => editor?.chain().focus().unsetColor().run()}
        >
          <X className="h-4 w-4" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          label="Добавить эмодзи"
          active={showEmojis}
          onClick={() => setShowEmojis((open) => !open)}
        >
          <Smile className="h-4 w-4" />
        </ToolbarButton>
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
      {placeholder && <p className="px-3 pt-2 text-xs text-muted-foreground">{placeholder}</p>}
      <EditorContent editor={editor} />
    </div>
  );
}

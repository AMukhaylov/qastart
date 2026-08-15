import { useEffect } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import {
  Bold,
  Code,
  CodeXml,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { lessonContentToHtml, sanitizeLessonHtml } from "@/lib/lesson-content";

type LessonRichTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
};

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

function ToolbarButton({ label, active, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-primary-soft text-primary" : ""
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: Editor | null }) {
  const disabled = !editor;

  function setLink() {
    if (!editor) return;
    const currentUrl = editor.getAttributes("link").href as string | undefined;
    const enteredUrl = window.prompt("Вставь ссылку", currentUrl ?? "");
    if (enteredUrl === null) return;

    const url = enteredUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    const normalizedUrl = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
    try {
      const parsed = new URL(normalizedUrl);
      if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) return;
      editor.chain().focus().extendMarkRange("link").setLink({ href: normalizedUrl }).run();
    } catch {
      // An invalid URL is intentionally ignored instead of becoming unsafe markup.
    }
  }

  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-border bg-muted/40 p-2">
      <ToolbarButton
        label="Обычный текст"
        active={editor?.isActive("paragraph")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().setParagraph().run()}
      >
        <Pilcrow className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Заголовок H2"
        active={editor?.isActive("heading", { level: 2 })}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Заголовок H3"
        active={editor?.isActive("heading", { level: 3 })}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-border" />
      <ToolbarButton
        label="Жирный"
        active={editor?.isActive("bold")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Курсив"
        active={editor?.isActive("italic")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Подчёркивание"
        active={editor?.isActive("underline")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <UnderlineIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Зачёркивание"
        active={editor?.isActive("strike")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-border" />
      <ToolbarButton
        label="Маркированный список"
        active={editor?.isActive("bulletList")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Нумерованный список"
        active={editor?.isActive("orderedList")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Цитата"
        active={editor?.isActive("blockquote")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Строка кода"
        active={editor?.isActive("code")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleCode().run()}
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Блок кода"
        active={editor?.isActive("codeBlock")}
        disabled={disabled}
        onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
      >
        <CodeXml className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Вставить ссылку"
        active={editor?.isActive("link")}
        disabled={disabled}
        onClick={setLink}
      >
        <Link2 className="h-4 w-4" />
      </ToolbarButton>
      <span className="mx-1 h-5 w-px shrink-0 bg-border" />
      <ToolbarButton
        label="Отменить"
        disabled={!editor?.can().chain().focus().undo().run()}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton
        label="Повторить"
        disabled={!editor?.can().chain().focus().redo().run()}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}

export function LessonRichTextEditor({ value, onChange }: LessonRichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: false,
      }),
      Underline,
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class:
          "tiptap-editor min-h-[380px] max-h-[620px] overflow-y-auto px-4 py-4 text-[15px] leading-relaxed focus:outline-none",
        "aria-label": "Конспект урока",
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
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

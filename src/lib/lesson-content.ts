import DOMPurify from "dompurify";
import { marked } from "marked";

const ALLOWED_TAGS = [
  "p",
  "br",
  "h2",
  "h3",
  "strong",
  "em",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

function isRichTextHtml(value: string) {
  return /<\/?(?:p|br|h2|h3|strong|em|u|s|ul|ol|li|blockquote|code|pre|a)\b/i.test(value);
}

export function sanitizeLessonHtml(value: string) {
  if (typeof window === "undefined") return "";

  return DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}

export function lessonContentToHtml(value: string) {
  const source = value.trim();
  if (!source) return "";

  const html = isRichTextHtml(source)
    ? source
    : (marked.parse(source, { async: false, breaks: true, gfm: true }) as string);

  return sanitizeLessonHtml(html);
}

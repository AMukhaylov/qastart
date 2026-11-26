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
  "span",
];

const ALLOWED_ATTR = ["href", "target", "rel", "style"];

function isRichTextHtml(value: string) {
  return /<\/?(?:p|br|h2|h3|strong|em|u|s|ul|ol|li|blockquote|code|pre|a|span)\b/i.test(value);
}

export function sanitizeLessonHtml(value: string) {
  if (typeof window === "undefined") return "";

  const sanitized = DOMPurify.sanitize(value, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
  const document = new DOMParser().parseFromString(sanitized, "text/html");
  document.body.querySelectorAll("[style]").forEach((element) => {
    const style = element.getAttribute("style")?.trim() ?? "";
    if (element.tagName !== "SPAN" || !/^color:\s*#[\da-f]{6};?$/i.test(style)) {
      element.removeAttribute("style");
    }
  });
  return document.body.innerHTML;
}

export function lessonContentToHtml(value: string) {
  const source = value.trim();
  if (!source) return "";

  const html = isRichTextHtml(source)
    ? source
    : (marked.parse(source, { async: false, breaks: true, gfm: true }) as string);

  return sanitizeLessonHtml(html);
}

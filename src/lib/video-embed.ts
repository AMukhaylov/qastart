const ALLOWED_VIDEO_EMBED_HOSTS = new Set([
  "kinescope.io",
  "www.youtube.com",
  "www.youtube-nocookie.com",
]);

/** Accepts a direct player URL or extracts one from Kinescope's iframe snippet. */
export function getSafeVideoEmbedUrl(value: string): string | null {
  const input = value.trim();
  if (!input) return null;

  const iframeMatch = input.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1/i);
  const candidate = (iframeMatch?.[2] ?? input).replaceAll("&amp;", "&").trim();

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:" || !ALLOWED_VIDEO_EMBED_HOSTS.has(url.hostname)) return null;

    const isKinescopeEmbed =
      url.hostname === "kinescope.io" && /^\/embed\/[\w-]+/.test(url.pathname);
    const isYoutubeEmbed =
      (url.hostname === "www.youtube.com" || url.hostname === "www.youtube-nocookie.com") &&
      /^\/embed\/[\w-]+/.test(url.pathname);

    return isKinescopeEmbed || isYoutubeEmbed ? url.toString() : null;
  } catch {
    return null;
  }
}

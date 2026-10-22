import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export type ParsedVideo =
  | { kind: "youtube"; id: string; embedUrl: string; thumbnail: string }
  | { kind: "vimeo"; id: string; embedUrl: string; thumbnail: string }
  | { kind: "file"; url: string };

/** Mendukung URL YouTube (watch, shorts, youtu.be, embed), Vimeo, dan file video upload. */
export function parseVideoUrl(url: string | null | undefined): ParsedVideo | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (yt) {
    return {
      kind: "youtube",
      id: yt[1],
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0`,
      thumbnail: `https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`,
    };
  }
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeo) {
    return {
      kind: "vimeo",
      id: vimeo[1],
      embedUrl: `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1`,
      thumbnail: `https://vumbnail.com/${vimeo[1]}.jpg`,
    };
  }
  if (/^https?:\/\//.test(url) || url.startsWith("/")) return { kind: "file", url };
  return null;
}

/** Hanya izinkan http(s) atau path relatif untuk URL yang dirender. */
export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

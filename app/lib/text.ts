const CONTROL =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g;

const LINK =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|ca|xyz|ru|me|app|dev|link)\b)/i;

export function normalizeVisitorText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const cleaned = value.normalize("NFC").replace(CONTROL, "").replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : null;
}

export function containsLink(value: string | null): boolean {
  return value != null && LINK.test(value);
}

export function clipVisitorText(value: string | null, max: number): string | null {
  if (value == null) return null;
  return value.length >= 1 && value.length <= max ? value : null;
}

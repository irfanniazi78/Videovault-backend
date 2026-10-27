export type UrlValidationResult =
  | { valid: true; normalized: string }
  | { valid: false; error: string };

const MIN_LENGTH = 8;

/**
 * Validates and normalizes a user-supplied video URL.
 * - Accepts strings with or without a protocol (https:// is assumed).
 * - Only http / https URLs are accepted.
 * - Returns a normalized absolute URL when valid.
 */
export function validateUrlInput(raw: unknown): UrlValidationResult {
  if (typeof raw !== "string") {
    return { valid: false, error: "Please enter a video URL." };
  }

  const trimmed = raw.trim();
  if (trimmed.length < MIN_LENGTH) {
    return { valid: false, error: "Please enter a video URL (at least 8 characters)." };
  }

  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return { valid: false, error: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: "Only secure HTTP and HTTPS links are supported." };
  }

  const host = parsed.hostname;
  const isLocalHost = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (!isLocalHost && !host.includes(".")) {
    return { valid: false, error: "That hostname doesn't look right. Double-check the URL." };
  }

  return { valid: true, normalized: parsed.toString() };
}

/** Convenience boolean check used by forms and quick validation. */
export function isValidVideoUrl(raw: string): boolean {
  return validateUrlInput(raw).valid;
}

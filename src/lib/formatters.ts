/** Formats a duration in seconds as "H:MM:SS" or "M:SS". Returns "—" when unknown. */
export function formatDuration(totalSeconds?: number | null): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return "—";

  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB"];

/** Formats a size in bytes into a human readable string. Returns "—" when unknown. */
export function formatBytes(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), BYTE_UNITS.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const rounded =
    value >= 100
      ? Math.round(value).toString()
      : value.toFixed(1).replace(/\.0$/, "");

  return `${rounded} ${BYTE_UNITS[exponent]}`;
}

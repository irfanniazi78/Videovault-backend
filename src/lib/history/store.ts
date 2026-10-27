import { promises as fs } from "fs";
import path from "path";

import type { HistoryEntry, HistoryStatus } from "@/lib/types/video";

const FALLBACK_DATA_DIR = path.join(process.cwd(), "data");

/** Data directory; overridable for tests and custom deployments. */
function dataDir(): string {
  return process.env.VIDEOVAULT_DATA_DIR ?? FALLBACK_DATA_DIR;
}

function historyFile(): string {
  return path.join(dataDir(), "history.json");
}

const entries = new Map<string, HistoryEntry>();

async function ensureLoaded(): Promise<void> {
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    const raw = await fs.readFile(historyFile(), "utf8");
    const parsed = JSON.parse(raw) as HistoryEntry[];
    for (const entry of parsed) entries.set(entry.id, entry);
  } catch {
    // File missing or unreadable — start with an empty history.
  }
}

async function persist(): Promise<void> {
  try {
    await fs.mkdir(dataDir(), { recursive: true });
    const all = Array.from(entries.values());
    await fs.writeFile(historyFile(), JSON.stringify(all, null, 2));
  } catch {
    // Persistence is best-effort; history stays usable for the session.
  }
}

function toEntry(input: HistoryEntry): HistoryEntry {
  const status: HistoryStatus = input.status ?? "failed";
  return {
    ...input,
    status,
    finishedAt:
      status === "completed" || status === "cancelled"
        ? input.finishedAt ?? new Date().toISOString()
        : undefined,
  };
}

export async function recordHistory(input: HistoryEntry): Promise<HistoryEntry> {
  await ensureLoaded();
  const entry = toEntry(input);
  entries.set(entry.id, entry);
  await persist();
  return entry;
}

export async function listHistory(): Promise<HistoryEntry[]> {
  await ensureLoaded();
  return Array.from(entries.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function clearHistory(): Promise<void> {
  entries.clear();
  await persist();
}

import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import { api } from "../src/api/client";
import { session } from "../src/store/session";
import type { DownloadJob, VideoFormat, VideoMetadata } from "../src/types/video";

function groupByQuality(formats: VideoFormat[]) {
  const groups = new Map<string, VideoFormat[]>();
  for (const f of formats) {
    const existing = groups.get(f.quality) ?? [];
    existing.push(f);
    groups.set(f.quality, existing);
  }
  return Array.from(groups.entries()).map(([quality, containers]) => ({ quality, containers }));
}

function qualityRank(q: string): number {
  const m = /^(\d+)/.exec(q.trim());
  return m ? Number.parseInt(m[1], 10) : 0;
}

export default function VideoScreen() {
  const router = useRouter();
  const metadata = session.getMetadata();
  const [selectedQuality, setSelectedQuality] = useState<string>("");
  const [selectedFormatId, setSelectedFormatId] = useState<string>("");
  const [job, setJob] = useState<DownloadJob | null>(session.getJob());
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    if (!metadata) return [];
    const g = groupByQuality([...metadata.formats].sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality)));
    return g.sort((a, b) => qualityRank(b.quality) - qualityRank(a.quality));
  }, [metadata]);

  useEffect(() => {
    if (groups.length === 0) return;
    const preferred = groups[0];
    setSelectedQuality(preferred.quality);
    setSelectedFormatId(preferred.containers[0]?.id ?? "");
  }, [metadata?.id]);

  useEffect(() => {
    if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") return;
    const timer = setInterval(async () => {
      try {
        const { job: latest } = await api.getJob(job.id);
        setJob(latest);
        session.setJob(latest);
        if (latest.status === "completed" || latest.status === "failed" || latest.status === "cancelled") {
          clearInterval(timer);
        }
      } catch {
        // ignore transient errors
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  if (!metadata) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No video analyzed. Go back and paste a URL.</Text>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  const selectedGroup = groups.find((g) => g.quality === selectedQuality);
  const selectedFormat = groups
    .flatMap((g) => g.containers)
    .find((f) => f.id === selectedFormatId);

  const isActive = job != null && (job.status === "queued" || job.status === "processing");
  const busy = isCreating || isActive;

  const handleDownload = async () => {
    if (!selectedFormat) return;
    setIsCreating(true);
    setCreateError(null);
    try {
      const { job: newJob } = await api.createDownload(metadata.id, metadata.url, selectedFormat.id);
      setJob(newJob);
      session.setJob(newJob);
    } catch (e) {
      const err = e as { message?: string };
      setCreateError(err?.message ?? "Failed to start download.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = async () => {
    if (!job) return;
    try {
      const { job: cancelled } = await api.cancelJob(job.id);
      setJob(cancelled);
      session.setJob(cancelled);
    } catch {
      // ignore
    }
  };

  const handleSaveFile = async () => {
    if (!job?.fileName) return;
    setSaving(true);
    try {
      const url = api.getJobFileUrl(job.id);
      const fileName = job.fileName;
      const target = `${FileSystem.documentDirectory}${fileName}`;
      const result = await FileSystem.downloadAsync(url, target);
      if (result.status === 200) {
        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(result.uri);
        } else {
          Alert.alert("Saved", `File saved to ${result.uri}`);
        }
      } else {
        Alert.alert("Error", "Failed to download file.");
      }
    } catch (e) {
      const err = e as { message?: string };
      Alert.alert("Error", err?.message ?? "Failed to save file.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {metadata.thumbnailUrl ? (
        <View style={styles.thumbWrap}>
          {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
          <Text style={styles.thumbPlaceholder}>🎬</Text>
        </View>
      ) : null}

      <Text style={styles.title}>{metadata.title}</Text>
      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatDuration(metadata.durationSeconds)}</Text>
        </View>
        {metadata.formats.length > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {metadata.formats.length} format{metadata.formats.length > 1 ? "s" : ""}
            </Text>
          </View>
        ) : null}
      </View>

      {metadata.formats.length === 0 ? (
        <View style={styles.card}>
          <Text style={styles.muted}>No downloadable formats were found for this video.</Text>
          {metadata.officialOptions?.map((opt) => (
            <Pressable key={opt.url} onPress={() => {}} style={styles.linkRow}>
              <Text style={styles.linkText}>{opt.label} ↗</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Quality</Text>
          <View style={styles.chipRow}>
            {groups.map((g) => (
              <Pressable
                key={g.quality}
                onPress={() => {
                  setSelectedQuality(g.quality);
                  if (g.containers[0]) setSelectedFormatId(g.containers[0].id);
                }}
                style={[styles.chip, selectedQuality === g.quality && styles.chipActive]}
              >
                <Text style={[styles.chipText, selectedQuality === g.quality && styles.chipTextActive]}>
                  {g.quality}
                </Text>
              </Pressable>
            ))}
          </View>

          {selectedGroup ? (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Format</Text>
              <View style={styles.formatList}>
                {selectedGroup.containers.map((f) => {
                  const isSelected = selectedFormatId === f.id;
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => setSelectedFormatId(f.id)}
                      style={[styles.formatRow, isSelected && styles.formatRowActive]}
                    >
                      <Text style={styles.formatContainer}>{f.container.toUpperCase()}</Text>
                      <Text style={styles.formatMeta}>
                        {f.quality}
                        {f.fileSizeBytes != null ? ` · ${formatBytes(f.fileSizeBytes)}` : ""}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}
        </View>
      )}

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.button, (busy || !selectedFormat) && styles.buttonDisabled]}
          onPress={handleDownload}
          disabled={busy || !selectedFormat}
        >
          {isCreating ? (
            <ActivityIndicator color="#fff" />
          ) : isActive ? (
            <Text style={styles.buttonText}>Downloading… {Math.round(job?.progress ?? 0)}%</Text>
          ) : (
            <Text style={styles.buttonText}>
              {job?.status === "completed"
                ? "Download again"
                : job?.status === "failed"
                  ? "Retry download"
                  : selectedFormat
                    ? `Download · ${selectedFormat.container.toUpperCase()} ${selectedFormat.quality}`
                    : "Download"}
            </Text>
          )}
        </Pressable>
        {isActive ? (
          <Pressable style={styles.cancelButton} onPress={handleCancel}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>

      {isActive && job ? (
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(2, job.progress)}%` }]} />
          </View>
          <Text style={styles.progressLabel}>{Math.round(job.progress)}% · {job.status}</Text>
        </View>
      ) : null}

      {createError ? (
        <View style={styles.alertError}>
          <Text style={styles.alertTitle}>Error</Text>
          <Text style={styles.alertText}>{createError}</Text>
        </View>
      ) : null}

      {job?.status === "failed" ? (
        <View style={styles.alertError}>
          <Text style={styles.alertTitle}>Download failed</Text>
          <Text style={styles.alertText}>{job.error ?? "The download failed. Please try again."}</Text>
        </View>
      ) : null}

      {job?.status === "completed" ? (
        <View style={styles.alertSuccess}>
          <Text style={styles.alertSuccessTitle}>Download completed successfully.</Text>
          <Pressable
            style={[styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSaveFile}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>{saving ? "Saving…" : "Save file"}</Text>
          </Pressable>
        </View>
      ) : null}

      {metadata.officialOptions && metadata.officialOptions.length > 0 ? (
        <View style={styles.card}>
          {metadata.providerNotes ? <Text style={styles.muted}>{metadata.providerNotes}</Text> : null}
          {metadata.officialOptions.map((opt) => (
            <Pressable key={opt.url} onPress={() => {}} style={styles.linkRow}>
              <Text style={styles.linkText}>{opt.label} ↗</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function formatDuration(totalSeconds?: number | null): string {
  if (totalSeconds == null || Number.isNaN(totalSeconds)) return "—";
  const total = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatBytes(bytes?: number | null): string {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[exponent]}`;
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  badgeRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  badge: {
    backgroundColor: "#eff6ff",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#1d4ed8" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#334155" },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 14, fontWeight: "600", color: "#334155" },
  chipTextActive: { color: "#ffffff" },
  formatList: { gap: 8 },
  formatRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "#ffffff",
  },
  formatRowActive: { borderColor: "#2563eb", backgroundColor: "#eff6ff" },
  formatContainer: { fontSize: 14, fontWeight: "600", color: "#0f172a" },
  formatMeta: { fontSize: 12, color: "#64748b" },
  actionRow: { flexDirection: "row", gap: 12 },
  button: {
    flex: 1,
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  cancelButton: {
    backgroundColor: "#fee2e2",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelButtonText: { color: "#991b1b", fontWeight: "600", fontSize: 15 },
  progressWrap: { gap: 6 },
  progressTrack: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 999, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: "#2563eb", borderRadius: 999 },
  progressLabel: { fontSize: 12, color: "#64748b" },
  alertError: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  alertTitle: { fontWeight: "600", color: "#991b1b", marginBottom: 4 },
  alertText: { color: "#7f1d1d", fontSize: 14 },
  alertSuccess: {
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    gap: 10,
  },
  alertSuccessTitle: { fontWeight: "600", color: "#166534" },
  saveButton: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: { color: "#ffffff", fontWeight: "600", fontSize: 15 },
  linkRow: { paddingVertical: 6 },
  linkText: { color: "#2563eb", fontSize: 14, fontWeight: "500" },
  muted: { fontSize: 14, color: "#475569" },
  thumbWrap: {
    height: 160,
    borderRadius: 16,
    backgroundColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholder: { fontSize: 48 },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#1e293b", fontWeight: "600", fontSize: 15 },
});

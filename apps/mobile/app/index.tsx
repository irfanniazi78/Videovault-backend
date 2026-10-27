import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { api } from "../src/api/client";
import { session } from "../src/store/session";
import type { VideoMetadata } from "../src/types/video";

export default function HomeScreen() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [officialOptions, setOfficialOptions] = useState<{ label: string; url: string }[]>([]);
  const [providerNotes, setProviderNotes] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a video URL.");
      return;
    }
    setError(null);
    setOfficialOptions([]);
    setProviderNotes(null);
    setLoading(true);
    try {
      const { video } = await api.analyzeVideo(trimmed);
      session.setMetadata(video);
      session.setJob(null);
      router.push("/video");
    } catch (e) {
      const err = e as { message?: string; details?: Record<string, unknown> | null };
      setError(err?.message ?? "Failed to analyze the video.");
      const details = err?.details;
      if (details && Array.isArray(details.officialOptions)) {
        setOfficialOptions(details.officialOptions as { label: string; url: string }[]);
      }
      if (details && typeof details.providerNotes === "string") {
        setProviderNotes(details.providerNotes as string);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <Text style={styles.badge}>Fast · Clean · Legitimate</Text>
          <Text style={styles.title}>Download videos, beautifully.</Text>
          <Text style={styles.subtitle}>
            Paste a video link to inspect available formats and download in the quality you need.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Video URL</Text>
          <TextInput
            style={styles.input}
            value={url}
            onChangeText={setUrl}
            placeholder="Paste a video link…"
            placeholderTextColor="#94a3b8"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            editable={!loading}
          />
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleAnalyze}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Analyze</Text>}
          </Pressable>
        </View>

        {error ? (
          <View style={styles.alertError}>
            <Text style={styles.alertTitle}>Analysis failed</Text>
            <Text style={styles.alertText}>{error}</Text>
          </View>
        ) : null}

        {officialOptions.length > 0 || providerNotes ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Official options</Text>
            {providerNotes ? <Text style={styles.muted}>{providerNotes}</Text> : null}
            {officialOptions.map((opt) => (
              <Pressable key={opt.url} onPress={() => {}} style={styles.linkRow}>
                <Text style={styles.linkText}>{opt.label} ↗</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.row}>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/history")}>
            <Text style={styles.secondaryButtonText}>History</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => router.push("/settings")}>
            <Text style={styles.secondaryButtonText}>Settings</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { padding: 20, gap: 16 },
  hero: { alignItems: "center", marginTop: 12 },
  badge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1d4ed8",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  title: { fontSize: 28, fontWeight: "700", color: "#0f172a", marginTop: 12, textAlign: "center" },
  subtitle: { fontSize: 15, color: "#475569", marginTop: 8, textAlign: "center" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#334155" },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#f8fafc",
  },
  button: {
    backgroundColor: "#2563eb",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontWeight: "600", fontSize: 16 },
  alertError: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  alertTitle: { fontWeight: "600", color: "#991b1b", marginBottom: 4 },
  alertText: { color: "#7f1d1d", fontSize: 14 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#0f172a" },
  muted: { fontSize: 14, color: "#475569" },
  linkRow: { paddingVertical: 6 },
  linkText: { color: "#2563eb", fontSize: 14, fontWeight: "500" },
  row: { flexDirection: "row", gap: 12 },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#1e293b", fontWeight: "600", fontSize: 15 },
});

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { api } from "../src/api/client";
import type { HistoryEntry } from "../src/types/video";

export default function HistoryScreen() {
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { entries: list } = await api.listHistory();
      setEntries(list);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleClear = async () => {
    try {
      await api.clearHistory();
    } catch {
      // ignore
    }
    setEntries([]);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text style={styles.title}>Download history</Text>
        <Pressable style={styles.secondaryButton} onPress={handleClear}>
          <Text style={styles.secondaryButtonText}>Clear</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : entries.length === 0 ? (
        <Text style={styles.muted}>No downloads yet.</Text>
      ) : (
        entries.map((e) => (
          <View key={e.id} style={styles.card}>
            <Text style={styles.cardTitle}>{e.title ?? e.url}</Text>
            <Text style={styles.muted}>{e.url}</Text>
            {e.formatLabel ? <Text style={styles.muted}>{e.formatLabel}</Text> : null}
            <Text style={styles.status}>{e.status}</Text>
          </View>
        ))
      )}

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 4,
  },
  cardTitle: { fontSize: 15, fontWeight: "600", color: "#0f172a" },
  muted: { fontSize: 13, color: "#64748b" },
  status: { fontSize: 12, fontWeight: "600", color: "#2563eb", textTransform: "capitalize" },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#1e293b", fontWeight: "600", fontSize: 14 },
});

import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFERRED_QUALITY_KEY = "videovault-preferred-quality";
const REDUCED_MOTION_KEY = "videovault-reduced-motion";

const QUALITIES = ["auto", "2160p", "1440p", "1080p", "720p", "480p", "360p"];

export default function SettingsScreen() {
  const router = useRouter();
  const [preferredQuality, setPreferredQuality] = useState("auto");
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    (async () => {
      const q = await AsyncStorage.getItem(PREFERRED_QUALITY_KEY);
      if (q) setPreferredQuality(q);
      const r = await AsyncStorage.getItem(REDUCED_MOTION_KEY);
      if (r === "true") setReducedMotion(true);
    })();
  }, []);

  const updateQuality = async (q: string) => {
    setPreferredQuality(q);
    await AsyncStorage.setItem(PREFERRED_QUALITY_KEY, q);
  };

  const updateReducedMotion = async (v: boolean) => {
    setReducedMotion(v);
    await AsyncStorage.setItem(REDUCED_MOTION_KEY, String(v));
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Preferences are stored locally on your device.</Text>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferred quality</Text>
        <View style={styles.chipRow}>
          {QUALITIES.map((q) => (
            <Pressable
              key={q}
              onPress={() => updateQuality(q)}
              style={[styles.chip, preferredQuality === q && styles.chipActive]}
            >
              <Text style={[styles.chipText, preferredQuality === q && styles.chipTextActive]}>
                {q === "auto" ? "Automatic (best available)" : q}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sectionTitle}>Reduce motion</Text>
            <Text style={styles.muted}>Minimize animations throughout the interface.</Text>
          </View>
          <Switch value={reducedMotion} onValueChange={updateReducedMotion} />
        </View>
      </View>

      <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  title: { fontSize: 22, fontWeight: "700", color: "#0f172a" },
  subtitle: { fontSize: 14, color: "#64748b" },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#334155" },
  muted: { fontSize: 13, color: "#64748b" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#f1f5f9",
  },
  chipActive: { backgroundColor: "#2563eb" },
  chipText: { fontSize: 13, fontWeight: "600", color: "#334155" },
  chipTextActive: { color: "#ffffff" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  secondaryButton: {
    backgroundColor: "#e2e8f0",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: "#1e293b", fontWeight: "600", fontSize: 15 },
});

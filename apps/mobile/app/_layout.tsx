import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "react-native";

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: scheme === "dark" ? "#09090b" : "#ffffff" },
          headerTintColor: scheme === "dark" ? "#fafafa" : "#0f172a",
          contentStyle: { backgroundColor: scheme === "dark" ? "#09090b" : "#f8fafc" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "VideoVault", headerShown: false }} />
        <Stack.Screen name="video" options={{ title: "Video" }} />
        <Stack.Screen name="history" options={{ title: "History" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
      </Stack>
    </>
  );
}

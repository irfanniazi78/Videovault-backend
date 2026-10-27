import Constants from "expo-constants";

export function getApiUrl(): string {
  const fromExtra = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  const url = fromEnv || fromExtra || "http://10.0.2.2:3000";
  return url.replace(/\/+$/, "");
}

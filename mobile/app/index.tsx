import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { formatMoney } from "@/lib/money";
import { apiGet } from "../lib/api";

// Fis tasarimi 18.4'un isi. Burasi bilerek sade: 18.2'nin sorusu "guzel
// gorunuyor mu" degil, "oturum ve API gercekten calisiyor mu".

type MeUser = { id: string; displayName: string; email: string };

type State =
  | { kind: "loading" }
  | { kind: "ok"; user: MeUser }
  | { kind: "error"; text: string };

export default function HomeScreen() {
  const { isLoaded, isSignedIn, getToken, signOut } = useAuth();
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const token = await getToken();
      const result = await apiGet<{ ok: true; user: MeUser }>("/api/v1/me", token);

      setState(
        result.ok
          ? { kind: "ok", user: result.data.user }
          : { kind: "error", text: `${result.status} · ${result.code}` },
      );
    } catch (error) {
      // Buraya genelde ag hatasi dusuyor: dev sunucusu kapali ya da
      // EXPO_PUBLIC_API_BASE_URL cihazdan erisilemeyen bir adres.
      setState({ kind: "error", text: String(error) });
    }
  }, [getToken]);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      void load();
    }
  }, [isLoaded, isSignedIn, load]);

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return <Redirect href="/sign-in" />;
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.cap}>OTURUM</Text>

      {state.kind === "loading" && <ActivityIndicator />}

      {state.kind === "error" && (
        <>
          <Text style={styles.error}>{state.text}</Text>
          <Pressable style={styles.button} onPress={() => void load()}>
            <Text style={styles.buttonText}>Tekrar dene</Text>
          </Pressable>
        </>
      )}

      {state.kind === "ok" && (
        <>
          <Text style={styles.name}>{state.user.displayName}</Text>
          <Text style={styles.muted}>{state.user.email}</Text>

          {/*
            Paylasilan saf modulun olcumu (ADR-029). Bu satir web'deki
            src/lib/money.ts'ten geliyor - mobilde kopyasi yok. Dogru
            gorunuyorsa Metro'nun takma ad cozumu ve Hermes'in Intl destegi
            birlikte calisiyor demektir.
          */}
          <Text style={styles.cap}>PAYLASILAN MODUL</Text>
          <Text style={styles.money}>{formatMoney(123456, "TRY", "tr")}</Text>
        </>
      )}

      <Pressable style={styles.secondary} onPress={() => void signOut()}>
        <Text style={styles.secondaryText}>Çıkış yap</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, gap: 8, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  cap: { fontSize: 11, letterSpacing: 2, color: "#888", marginTop: 24 },
  name: { fontSize: 28, fontWeight: "600" },
  muted: { fontSize: 14, color: "#666" },
  money: { fontSize: 32, fontVariant: ["tabular-nums"] },
  error: { fontSize: 14, color: "#b3261e" },
  button: { marginTop: 12, padding: 12, backgroundColor: "#111", borderRadius: 8, alignSelf: "flex-start" },
  buttonText: { color: "#fff" },
  secondary: { marginTop: "auto", paddingVertical: 12 },
  secondaryText: { color: "#666" },
});

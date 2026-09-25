import { useCallback, useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import { AppStateProvider, useAppState } from "./lib/appState";
import { WorkoutModalProvider, useWorkoutModal } from "./lib/workoutModal";
import { isSupabaseConfigured } from "./lib/supabase";
import { useAppFonts } from "./lib/fonts";
import { fonts } from "./lib/theme";
import AppNavigator from "./navigation/AppNavigator";
import AuthScreen from "./screens/AuthScreen";
import WorkoutScreen from "./screens/WorkoutScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

function MainApp() {
  const workoutModal = useWorkoutModal();
  return (
    <>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      <WorkoutScreen visible={workoutModal.visible} onClose={workoutModal.close} />
    </>
  );
}

function Root() {
  const { scheme, colors } = useTheme();
  const appState = useAppState();
  const [fontsLoaded] = useAppFonts();

  const hideSplash = useCallback(async () => {
    if (fontsLoaded && !appState.authLoading) await SplashScreen.hideAsync();
  }, [fontsLoaded, appState.authLoading]);

  useEffect(() => {
    hideSplash();
  }, [hideSplash]);

  if (!fontsLoaded || appState.authLoading) return null;

  if (!isSupabaseConfigured) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.paper, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.ink, fontFamily: fonts.display, fontSize: 28, marginBottom: 12, textAlign: "center" }}>
          Missing Supabase keys
        </Text>
        <Text style={{ color: colors.ink2, fontSize: 14, textAlign: "center", lineHeight: 20 }}>
          Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to a .env file at the project root, then
          restart the dev server.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {appState.userId ? (
        <WorkoutModalProvider>
          <MainApp />
        </WorkoutModalProvider>
      ) : (
        <AuthScreen />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppStateProvider>
          <Root />
        </AppStateProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

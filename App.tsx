import { useCallback, useEffect } from "react";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import { AppStateProvider, useAppState } from "./lib/appState";
import { WorkoutModalProvider, useWorkoutModal } from "./lib/workoutModal";
import { isSupabaseConfigured } from "./lib/supabase";
import { configurePurchases, forgetPurchaser, identifyPurchaser } from "./lib/purchases";
import { useAppFonts } from "./lib/fonts";
import { fonts } from "./lib/theme";
import AppNavigator from "./navigation/AppNavigator";
import AuthScreen from "./screens/AuthScreen";
import OnboardingScreen from "./screens/OnboardingScreen";
import WorkoutScreen from "./screens/WorkoutScreen";
import MobilityScreen from "./screens/MobilityScreen";
import WalkScreen from "./screens/WalkScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});
configurePurchases();

function MainApp() {
  const workoutModal = useWorkoutModal();
  return (
    <>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
      <WorkoutScreen visible={workoutModal.kind === "workout"} onClose={workoutModal.close} />
      <MobilityScreen visible={workoutModal.kind === "mobility"} onClose={workoutModal.close} />
      <WalkScreen visible={workoutModal.kind === "walk"} onClose={workoutModal.close} />
    </>
  );
}

function Root() {
  const { scheme, colors } = useTheme();
  const appState = useAppState();
  const [fontsLoaded, fontError] = useAppFonts();
  // A font failing to load shouldn't hang the app on the splash screen forever —
  // fall back to the system font rather than block indefinitely.
  const fontsReady = fontsLoaded || !!fontError;

  const hideSplash = useCallback(async () => {
    if (fontsReady && !appState.authLoading) await SplashScreen.hideAsync();
  }, [fontsReady, appState.authLoading]);

  useEffect(() => {
    hideSplash();
  }, [hideSplash]);

  // Ties RevenueCat's customer identity to the same Supabase user id everywhere
  // else in this app keys off of, so purchase receipts follow sign-in/sign-out the
  // same way the rest of the account's data does.
  useEffect(() => {
    if (appState.userId) identifyPurchaser(appState.userId);
    else forgetPurchaser();
  }, [appState.userId]);

  if (!fontsReady || appState.authLoading) return null;

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
        appState.profile.medicalDisclaimerAccepted ? (
          <WorkoutModalProvider>
            <MainApp />
          </WorkoutModalProvider>
        ) : (
          <OnboardingScreen onDone={() => {}} />
        )
      ) : (
        <AuthScreen />
      )}
    </View>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppStateProvider>
          <ThemeProvider>
            <Root />
          </ThemeProvider>
        </AppStateProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

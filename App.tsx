import { useCallback, useEffect } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { ThemeProvider, useTheme } from "./lib/ThemeContext";
import { AppStateProvider } from "./lib/appState";
import { useAppFonts } from "./lib/fonts";
import TodayScreen from "./screens/TodayScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

function Root() {
  const { scheme, colors } = useTheme();
  const [fontsLoaded] = useAppFonts();

  const hideSplash = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    hideSplash();
  }, [hideSplash]);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.paper }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <TodayScreen />
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppStateProvider>
        <Root />
      </AppStateProvider>
    </ThemeProvider>
  );
}

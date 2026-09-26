import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!url && !!anonKey;

// A harmless placeholder so createClient doesn't throw before .env is filled in —
// isSupabaseConfigured is what actually gates whether the app tries to use it.
export const supabase = createClient(url || "https://placeholder.supabase.co", anonKey || "placeholder", {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Supabase-recommended wiring: without this, token auto-refresh keeps trying on a
// background/suspended JS timer and can miss its window, so reopening the app after
// it's been backgrounded a while can briefly look "logged out" until the next network
// call happens to trigger a refresh. Foregrounding now kicks a refresh immediately.
if (isSupabaseConfigured) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

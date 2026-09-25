import React from "react";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Text, TouchableOpacity, View, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useTheme } from "../lib/ThemeContext";
import { fonts } from "../lib/theme";
import { ProgressIcon, TodayIcon, YouIcon } from "./TabIcon";

const ICONS: Record<string, (props: { color: string }) => React.ReactElement> = {
  Today: TodayIcon,
  Progress: ProgressIcon,
  You: YouIcon,
};

export default function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ backgroundColor: colors.raised }} edges={["bottom"]}>
      <View style={[styles.row, { borderTopColor: colors.line, backgroundColor: colors.raised }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = (options.title ?? route.name) as string;
          const focused = state.index === index;
          const Icon = ICONS[route.name];

          const onPress = () => {
            Haptics.selectionAsync().catch(() => {});
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.tab} activeOpacity={0.7}>
              <View style={[styles.indicator, { backgroundColor: focused ? colors.accent : "transparent" }]} />
              {Icon ? <Icon color={focused ? colors.accent : colors.muted} /> : null}
              <Text
                style={[
                  styles.label,
                  { color: focused ? colors.accent : colors.muted, fontFamily: fonts.bodyBold },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", borderTopWidth: 1 },
  tab: { flex: 1, alignItems: "center", paddingTop: 10, paddingBottom: 8, gap: 4 },
  indicator: { position: "absolute", top: 0, width: 26, height: 3, borderRadius: 2 },
  label: { fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.3 },
});

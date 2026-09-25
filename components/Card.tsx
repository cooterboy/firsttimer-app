import React from "react";
import { View, ViewProps } from "react-native";
import { useTheme } from "../lib/ThemeContext";
import { radius, shadow } from "../lib/theme";

export default function Card({ style, ...props }: ViewProps) {
  const { colors } = useTheme();
  return (
    <View
      {...props}
      style={[
        {
          backgroundColor: colors.raised,
          borderWidth: 1,
          borderColor: colors.line,
          borderRadius: radius,
          padding: 18,
          ...shadow,
        },
        style,
      ]}
    />
  );
}

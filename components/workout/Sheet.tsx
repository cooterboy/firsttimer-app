import React from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../../lib/ThemeContext";
import { radius } from "../../lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Sheet({ visible, onClose, children }: Props) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose}>
          <Pressable style={{ width: "100%" }}>
            <View style={[styles.sheet, { backgroundColor: colors.raised, borderColor: colors.line }]}>
              <View style={[styles.grip, { backgroundColor: colors.line }]} />
              <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                {children}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: "85%",
  },
  grip: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  content: { padding: 20, paddingBottom: 36 },
});

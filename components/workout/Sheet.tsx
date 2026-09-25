import React, { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useTheme } from "../../lib/ThemeContext";
import { radius } from "../../lib/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

// KeyboardAvoidingView is unreliable inside a transparent RN Modal on iOS, so this
// tracks the keyboard height directly and shifts the sheet up by exactly that much.
function useKeyboardHeight() {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvt, (e) => setHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvt, () => setHeight(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);
  return height;
}

export default function Sheet({ visible, onClose, children }: Props) {
  const { colors } = useTheme();
  const kbHeight = useKeyboardHeight();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={{ width: "100%", marginBottom: kbHeight }}>
          <View style={[styles.sheet, { backgroundColor: colors.raised, borderColor: colors.line }]}>
            <View style={[styles.grip, { backgroundColor: colors.line }]} />
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
              {children}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
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

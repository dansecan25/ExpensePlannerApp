import React from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

const ICON_COLOR = "#FFFFFF";

export default function EditMovementButton({ label, onPress, size = 40 }) {
  return (
    <TouchableOpacity
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={[
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View style={styles.pencil}>
        <View style={[styles.pencilBody, { backgroundColor: ICON_COLOR }]} />
        <View style={[styles.pencilTip, { borderTopColor: ICON_COLOR }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(66,97,160,0.55)",
  },
  pencil: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "45deg" }],
  },
  pencilBody: {
    width: 5,
    height: 11,
    borderTopLeftRadius: 1,
    borderTopRightRadius: 1,
  },
  pencilTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 2.5,
    borderRightWidth: 2.5,
    borderTopWidth: 5,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});

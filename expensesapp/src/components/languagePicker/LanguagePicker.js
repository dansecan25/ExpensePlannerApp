import React from "react";
import { StyleSheet, View } from "react-native";
import CustomButton from "../customButton/customButton";
import { LANGUAGES } from "../../i18n/i18n";

export default function LanguagePicker({ value, onChange, disabled = false }) {
  return (
    <View style={styles.row}>
      {LANGUAGES.map(option => (
        <CustomButton
          disabled={disabled}
          key={option.value}
          onPress={() => onChange(option.value)}
          style={styles.choice}
          text={option.label}
          type={value === option.value ? "primary" : "secondary"}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
  },
  choice: {
    flex: 1,
  },
});

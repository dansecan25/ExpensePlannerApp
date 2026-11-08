import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import CustomText from "../customText/customText";
import EditMovementButton from "../editMovementButton/EditMovementButton";
import getColors from "../../utils/color-picker";
import { useTheme } from "../../utils/themeContext";

// Items are plain strings, or { key, text, onEdit, editLabel } for rows that
// show an edit button.
export default function ScrollableTile({
  title,
  data = [],
  size = 180, // square size (width & height)
  style={}
}) {
  useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: getColors("tile_background"), width: "100%", height: size },style]}>

      <ScrollView
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {data.map((item, index) => {
          const row = typeof item === "string" ? { text: item } : item;
          return (
            <View key={row.key ?? index} style={styles.row}>
              <CustomText
                type="body1"
                text={row.text}
                style={styles.item}
              />
              {row.onEdit ? (
                <EditMovementButton
                  label={row.editLabel}
                  onPress={row.onEdit}
                  size={32}
                />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: 16,
    padding: 14,
    elevation: 3, // Android shadow
  },

  title: {
    marginBottom: 8,
  },

  scrollContent: {
    paddingBottom: 6,
  },

  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  item: {
    flex: 1,
  },
});

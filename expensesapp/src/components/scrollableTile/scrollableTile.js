import React from "react";
import { View, ScrollView, StyleSheet } from "react-native";
import CustomText from "../customText/customText";
import getColors from "../../utils/color-picker";
import { useTheme } from "../../utils/themeContext";

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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {data.map((item, index) => (
          <CustomText
            key={index}
            type="body1"
            text={item}
            style={styles.item}
          />
        ))}
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

  item: {
    marginBottom: 6,
  },
});

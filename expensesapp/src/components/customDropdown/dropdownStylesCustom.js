// styles/dropdown.styles.js
import { StyleSheet } from "react-native";

export const dropdownStyles = StyleSheet.create({
  input: {
    height: 48,
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#CCC",
  },

  dropdown: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    marginTop: 4,
    paddingVertical: 4,
    maxHeight: 100, 
    borderWidth: 1,
    borderColor: "#CCC",
  },

  itemContainer: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
  },

  itemText: {
    fontSize: 16,
    color: "#000",
  },

  placeholderText: {
    color: "#888",
    fontSize: 16,
  },

  selectedText: {
    fontSize: 16,
    color: "#000",
  },
});

import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { getColors } from "../../utils/color-picker";
import { useTheme } from "../../utils/themeContext";

export default function CustomDropdown({
  data = [],
  labelField = "label",
  valueField = "value",
  value,
  onChange,
  placeholder = "Select an option",
  style,
  disabled = false,
  searchable = true,
  searchPlaceholder = "Search",
}) {
  useTheme();
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState("");
  const selectedItem = data.find(item => item[valueField] === value);
  const filteredData = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) {
      return data;
    }
    return data.filter(item =>
      String(item[labelField] ?? "")
        .toLocaleLowerCase()
        .includes(normalizedQuery),
    );
  }, [data, labelField, query]);

  const close = () => {
    setVisible(false);
    setQuery("");
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled, expanded: visible }}
        disabled={disabled}
        onPress={() => setVisible(true)}
        style={[
          styles.trigger,
          style,
          {
            backgroundColor: getColors("input"),
            borderColor: getColors("border"),
          },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.triggerText,
            {
              color: selectedItem
                ? getColors("secondaryText")
                : getColors("placeholder"),
            },
          ]}
        >
          {selectedItem ? selectedItem[labelField] : placeholder}
        </Text>
        <Text style={[styles.chevron, { color: getColors("secondaryText") }]}>
          {visible ? "⌃" : "⌄"}
        </Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={visible}
      >
        <Pressable onPress={close} style={styles.backdrop}>
          <Pressable
            onPress={event => event.stopPropagation()}
            style={[
              styles.dialog,
              { backgroundColor: getColors("surface") },
            ]}
          >
            {searchable ? (
              <TextInput
                autoCapitalize="none"
                onChangeText={setQuery}
                placeholder={searchPlaceholder}
                placeholderTextColor={getColors("placeholder")}
                style={[
                  styles.search,
                  {
                    color: getColors("secondaryText"),
                    backgroundColor: getColors("input"),
                    borderColor: getColors("border"),
                  },
                ]}
                value={query}
              />
            ) : null}
            <FlatList
              data={filteredData}
              keyboardShouldPersistTaps="handled"
              keyExtractor={item => String(item[valueField])}
              ListEmptyComponent={
                <Text
                  style={[
                    styles.empty,
                    { color: getColors("secondaryText") },
                  ]}
                >
                  No matching options
                </Text>
              }
              renderItem={({ item }) => {
                const selected = item[valueField] === value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      onChange?.(item);
                      close();
                    }}
                    style={[
                      styles.option,
                      {
                        borderBottomColor: getColors("border"),
                        backgroundColor: selected
                          ? getColors("selected")
                          : getColors("surface"),
                      },
                    ]}
                  >
                    <Text style={{ color: getColors("secondaryText"), fontSize: 16 }}>
                      {String(item[labelField] ?? "")}
                    </Text>
                  </Pressable>
                );
              }}
              style={styles.options}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    width: "100%",
    borderRadius: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  triggerText: {
    flex: 1,
    fontSize: 16,
  },
  chevron: {
    marginLeft: 8,
    fontSize: 18,
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  dialog: {
    maxHeight: "75%",
    borderRadius: 14,
    padding: 12,
    elevation: 8,
  },
  search: {
    height: 46,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
    fontSize: 16,
  },
  options: {
    flexGrow: 0,
  },
  option: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  empty: {
    padding: 16,
    textAlign: "center",
    fontSize: 15,
  },
});

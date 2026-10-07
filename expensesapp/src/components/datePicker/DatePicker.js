import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { formatDisplayDate } from "../../utils/dateFormatting";
import { getColors } from "../../utils/color-picker";
import { getLocalDate } from "../../utils/database_connector";
import { useTheme } from "../../utils/themeContext";

const parseLocalDate = value => {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const formatLocalDate = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function DatePicker({
  value,
  setValue,
  onChange,
  placeholder = "Select date",
  style,
  allowClear = false,
}) {
  useTheme();
  const [visible, setVisible] = useState(false);
  const [displayMonth, setDisplayMonth] = useState(() =>
    value ? parseLocalDate(value) : parseLocalDate(getLocalDate()),
  );
  const selectedDate = value || "";
  const calendarDays = useMemo(() => {
    const first = new Date(
      displayMonth.getFullYear(),
      displayMonth.getMonth(),
      1,
      12,
    );
    const startOffset = first.getDay();
    const count = new Date(
      displayMonth.getFullYear(),
      displayMonth.getMonth() + 1,
      0,
    ).getDate();
    return [
      ...Array(startOffset).fill(null),
      ...Array.from({ length: count }, (_, index) => index + 1),
    ];
  }, [displayMonth]);

  const close = () => setVisible(false);
  const chooseDate = date => {
    if (setValue) {
      setValue(date);
    } else {
      onChange?.(date);
    }
    close();
  };

  const moveMonth = offset =>
    setDisplayMonth(
      current =>
        new Date(
          current.getFullYear(),
          current.getMonth() + offset,
          1,
          12,
        ),
    );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={selectedDate || placeholder}
        onPress={() => {
          setDisplayMonth(
            selectedDate
              ? parseLocalDate(selectedDate)
              : parseLocalDate(getLocalDate()),
          );
          setVisible(true);
        }}
        style={[
          styles.trigger,
          {
            backgroundColor: getColors("input"),
            borderColor: getColors("border"),
          },
          style,
        ]}
      >
        <Text
          style={{
            color: selectedDate
              ? getColors("secondaryText")
              : getColors("placeholder"),
            fontSize: 16,
          }}
        >
          {selectedDate ? formatDisplayDate(selectedDate) : placeholder}
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
            style={[styles.dialog, { backgroundColor: getColors("surface") }]}
          >
            <View style={styles.monthHeader}>
              <Pressable
                accessibilityRole="button"
                onPress={() => moveMonth(-1)}
                style={styles.arrow}
              >
                <Text style={{ color: getColors("secondaryText"), fontSize: 22 }}>
                  ‹
                </Text>
              </Pressable>
              <Text
                style={[
                  styles.monthTitle,
                  { color: getColors("secondaryText") },
                ]}
              >
                {displayMonth.toLocaleDateString(undefined, {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => moveMonth(1)}
                style={styles.arrow}
              >
                <Text style={{ color: getColors("secondaryText"), fontSize: 22 }}>
                  ›
                </Text>
              </Pressable>
            </View>
            <View style={styles.calendarGrid}>
              {WEEK_DAYS.map(day => (
                <View key={`weekday-${day}`} style={styles.dayCell}>
                  <Text style={{ color: getColors("secondaryText"), fontSize: 13 }}>
                    {day}
                  </Text>
                </View>
              ))}
              {calendarDays.map((day, index) => {
                if (day === null) {
                  return <View key={`blank-${index}`} style={styles.dayCell} />;
                }
                const date = formatLocalDate(
                  new Date(
                    displayMonth.getFullYear(),
                    displayMonth.getMonth(),
                    day,
                    12,
                  ),
                );
                const selected = date === selectedDate;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={formatDisplayDate(date)}
                    key={date}
                    onPress={() => chooseDate(date)}
                    style={[
                      styles.dayCell,
                      selected && { backgroundColor: getColors("accent") },
                    ]}
                  >
                    <Text
                      style={{
                        color: selected ? "#FFFFFF" : getColors("secondaryText"),
                        fontSize: 15,
                      }}
                    >
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.actions}>
              {allowClear ? (
                <Pressable onPress={() => chooseDate("")}>
                  <Text style={{ color: getColors("accent"), fontSize: 15 }}>
                    Clear
                  </Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable onPress={() => chooseDate(getLocalDate())}>
                <Text style={{ color: getColors("accent"), fontSize: 15 }}>
                  Today
                </Text>
              </Pressable>
              <Pressable onPress={close}>
                <Text style={{ color: getColors("accent"), fontSize: 15 }}>
                  Cancel
                </Text>
              </Pressable>
            </View>
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
    justifyContent: "center",
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.48)",
  },
  dialog: {
    width: "100%",
    borderRadius: 14,
    padding: 14,
    elevation: 8,
  },
  monthHeader: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  arrow: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 8,
  },
  dayCell: {
    width: "14.2857%",
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
  },
  actions: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#888",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

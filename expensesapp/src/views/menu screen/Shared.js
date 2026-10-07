import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import CustomText from "../../components/customText/customText";
import { getCashflowData } from "../../utils/database_connector";

export const money = (value, currency = "") =>
  `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`.trim();

export const dateOptions = text => (
  <CustomText type="body1" text={text} style={styles.secondaryText} />
);

export function Section({ children, title }) {
  return (
    <View style={styles.section}>
      {title ? <CustomText type="header3" text={title} /> : null}
      {children}
    </View>
  );
}

export function EntryCard({ children, title }) {
  return (
    <View style={styles.card}>
      {title ? <CustomText type="body4" text={title} /> : null}
      {children}
    </View>
  );
}

export function useFinanceData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const result = await getCashflowData();
      setData(result);
      setError(null);
      return result;
    } catch (loadError) {
      console.error("Failed to load finance data:", loadError);
      setError(loadError);
      return null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { data, error, reload };
}
export const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 36,
  },
  intro: {
    marginTop: 10,
  },
  section: {
    marginTop: 26,
  },
  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  secondaryText: {
    marginTop: 6,
  },
  inputSpacing: {
    marginTop: 12,
  },
  actionButton: {
    marginTop: 16,
  },
  inlineButton: {
    alignSelf: "flex-start",
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  smallButton: {
    flex: 1,
  },
  balanceAmount: {
    marginTop: 6,
  },
  savingsList: {
    maxHeight: 360,
    marginTop: 4,
  },
  savingItem: {
    marginTop: 8,
  },
});

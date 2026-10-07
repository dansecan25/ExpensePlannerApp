import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import CustomButton from "../components/customButton/customButton";
import CustomText from "../components/customText/customText";
import ScrollableTile from "../components/scrollableTile/scrollableTile";
import {
  getCashflowData,
  getExpensesForMonth,
  getExpensesForToday,
  getLocalDate,
} from "../utils/database_connector";
import { getCashflowProjection } from "../utils/financeCalculations";

const formatMoney = (amount, currency) =>
  `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || ""}`.trim();

export default function MainScreen({ navigation }) {
  const [todayExpenses, setTodayExpenses] = useState([]);
  const [monthExpenses, setMonthExpenses] = useState([]);
  const [availableBeforePayment, setAvailableBeforePayment] = useState(0);
  const [currency, setCurrency] = useState("");
  const [hasFixedIncome, setHasFixedIncome] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadHome = useCallback(async () => {
    try {
      const data = await getCashflowData();
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const projection = getCashflowProjection(data, now);
      const today = getLocalDate(now);
      const nextPayday = projection.events.find(
        event =>
          event.kind === "income" &&
          event.source === "salary" &&
          event.date > today,
      )?.date;
      const beforePaymentDate = nextPayday
        ? new Date(`${nextPayday}T12:00:00`)
        : null;
      if (beforePaymentDate) {
        beforePaymentDate.setDate(beforePaymentDate.getDate() - 1);
      }
      const beforePaymentKey = beforePaymentDate
        ? getLocalDate(beforePaymentDate)
        : today;
      const balanceBeforePayment =
        projection.balances.find(
          entry => entry.date === beforePaymentKey,
        )?.balance ?? projection.todayBalance;
      const [todayRows, monthRows] = await Promise.all([
        getExpensesForToday(),
        getExpensesForMonth(year, month),
      ]);
      const scheduledExpenses = projection.events
        .filter(event => event.subscription)
        .map(event => ({
          id: `subscription-${event.name}-${event.date}`,
          date: event.date,
          name: event.name,
          value: event.amount,
          kind: "expense",
          isScheduled: true,
        }));
      setTodayExpenses([
        ...todayRows,
        ...scheduledExpenses.filter(expense => expense.date === today),
      ]);
      const monthKey = `${year}-${String(month).padStart(2, "0")}`;
      setMonthExpenses([
        ...monthRows,
        ...scheduledExpenses.filter(expense =>
          expense.date.startsWith(monthKey),
        ),
      ]);
      setAvailableBeforePayment(balanceBeforePayment);
      setCurrency(data.salary?.currency || "");
      setHasFixedIncome(Boolean(data.salary?.fixed));
      setLoadError(false);
    } catch (error) {
      console.error("Failed to load home cash flow:", error);
      setLoadError(true);
      Alert.alert("Could not update Home", "Please try again.");
    }
  }, []);

  useEffect(() => {
    loadHome();
    return navigation.addListener("focus", loadHome);
  }, [loadHome, navigation]);

  const monthLabel = new Date().toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const todayLabels = todayExpenses.map(expense => {
    const prefix = expense.kind === "income" ? "+ " : "";
    const amount =
      expense.kind === "income"
        ? expense.value
        : expense.inflated_value ?? expense.value;
    return `${prefix}${expense.name} · ${formatMoney(amount, currency)}`;
  });
  const monthExpenseRows = monthExpenses.filter(
    expense => expense.kind !== "income",
  );
  const monthTotal = monthExpenseRows.reduce(
    (sum, expense) =>
      sum + Number(expense.inflated_value ?? expense.value ?? 0),
    0,
  );
  const monthLabels = monthExpenseRows.map(expense => {
    const date = expense.date.slice(0, 10);
    const amount = expense.inflated_value ?? expense.value;
    return `${date} · ${expense.name} · ${formatMoney(amount, currency)}`;
  });

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <CustomText type="header1" text="Expenses App" />
      <View style={styles.balanceCard}>
        <CustomText
          type="body3"
          text={
            hasFixedIncome
              ? "Money available before next payment"
              : "Current available balance"
          }
        />
        <CustomText
          type="header2"
          text={formatMoney(availableBeforePayment, currency)}
          style={styles.balanceValue}
        />
      </View>
      <View style={styles.sectionHeading}>
        <CustomText type="header2" text="Today's expenses" style={styles.heading} />
        <CustomButton
          onPress={() => navigation.navigate("Add today expense")}
          text="Add"
          type="secondary"
        />
      </View>
      <ScrollableTile
        data={todayLabels}
        size={Math.max(120, Math.min(220, 44 + todayLabels.length * 34))}
      />
      <View style={styles.monthHeading}>
        <View style={styles.heading}>
          <CustomText type="header2" text="This month's expenses" />
          <CustomText
            type="body3"
            text={`${monthLabel} · ${formatMoney(monthTotal, currency)}`}
          />
        </View>
      </View>
      <ScrollableTile
        data={monthLabels}
        size={220}
        style={styles.monthTile}
      />
      {loadError ? (
        <CustomButton
          onPress={loadHome}
          style={styles.retryButton}
          text="Retry loading Home"
          type="secondary"
        />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    marginTop: 2,
    marginHorizontal: 16,
    paddingBottom: 24,
  },
  balanceCard: {
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  balanceValue: {
    marginTop: 4,
  },
  sectionHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 10,
  },
  heading: {
    flex: 1,
  },
  monthHeading: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 10,
  },
  monthTile: {
    marginBottom: 20,
  },
  retryButton: {
    marginTop: 12,
  },
});

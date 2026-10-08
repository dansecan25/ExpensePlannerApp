import React, { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";

import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import ScrollableTile from "../../components/scrollableTile/scrollableTile";
import {
  getCashflowData,
  getLocalDate,
} from "../../utils/database_connector";
import { formatDisplayDate } from "../../utils/dateFormatting";
import {
  getBalanceBeforeDate,
  getCashflowProjection,
  getSalaryScheduleForDate,
} from "../../utils/financeCalculations";

const formatMoney = (amount, currency) =>
  `${Number(amount || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || ""}`.trim();

export default function HomeScreen({ navigation }) {
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
      const balanceBeforePayment = nextPayday
        ? getBalanceBeforeDate(projection, nextPayday, now)
        : projection.todayBalance;
      const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(
        new Date(year, month, 0).getDate(),
      ).padStart(2, "0")}`;
      const monthStartDate = new Date(year, month - 1, 1, 12);
      const daysInMonth = new Date(year, month, 0).getDate();
      const monthProjection = getCashflowProjection(
        data,
        monthStartDate,
        daysInMonth - 1,
      );
      const monthMovements = monthProjection.events
        .filter(event => event.date >= monthStart && event.date <= monthEnd)
        .filter(
          event =>
            !event.account_transfer || event.kind === "transfer_out",
        )
        .map((event, index) => ({
          ...event,
          id:
            event.id ??
            `${event.date}-${event.name}-${event.kind}-${event.transfer_id ?? event.source_expense_id ?? index}`,
          kind: event.account_transfer
            ? "transfer"
            : Number(event.is_savings) === 1 && event.kind === "expense"
              ? "savings"
              : event.kind,
          name:
            event.kind === "savings_use"
              ? `Savings used · ${event.name}`
              : event.name,
          recurringDeduction:
            Boolean(event.recurring_deduction) ||
            (Boolean(event.recurrence_frequency) &&
              !event.account_transfer),
        }));
      setTodayExpenses(monthMovements.filter(event => event.date === today));
      setMonthExpenses(monthMovements);
      setAvailableBeforePayment(balanceBeforePayment);
      setCurrency(data.salary?.currency || "");
      setHasFixedIncome(
        getSalaryScheduleForDate(data, now)?.income_type === "fixed",
      );
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
    const prefix =
      expense.kind === "income"
        ? "+ "
        : expense.kind === "transfer"
          ? "↔ "
          : "- ";
    const amount =
      expense.kind === "expense"
        ? expense.inflated_value ?? expense.amount ?? expense.value
        : expense.amount ?? expense.value;
    const recurringLabel =
      expense.recurringDeduction || expense.recurrence_frequency
        ? " · Recurring"
        : "";
    const movementName = expense.subscription
      ? `${expense.name} · Subscription`
      : expense.kind === "savings"
        ? `Savings · ${expense.name}`
        : expense.name;
    return `${prefix}${movementName}${recurringLabel} · ${formatMoney(amount, currency)}`;
  });
  const monthOutflowRows = monthExpenses.filter(
    movement => movement.kind === "expense" || movement.kind === "savings",
  );
  const monthTotal = monthOutflowRows.reduce(
    (sum, movement) =>
      sum +
      Number(
        movement.inflated_value ?? movement.amount ?? movement.value ?? 0,
      ),
    0,
  );
  const monthLabels = [...monthExpenses]
    .sort((left, right) => {
      const dateOrder = left.date.localeCompare(right.date);
      return dateOrder || left.name.localeCompare(right.name);
    })
    .map(expense => {
      const date = formatDisplayDate(expense.date);
      const isIncome = expense.kind === "income";
      const isTransfer = expense.kind === "transfer";
      const amount =
        expense.kind === "expense"
          ? expense.inflated_value ?? expense.amount ?? expense.value
          : expense.amount ?? expense.value;
      const movementLabel = expense.subscription
        ? `${expense.name} · Subscription`
        : expense.recurringDeduction || expense.recurrence_frequency
          ? `${expense.name} · Recurring`
          : expense.kind === "savings"
            ? `Savings · ${expense.name}`
            : expense.name;
      const sign = isIncome ? "+" : isTransfer ? "↔ " : "-";
      return `${date} · ${sign}${movementLabel} · ${formatMoney(
        amount,
        currency,
      )}`;
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
        <CustomText type="header2" text="Today's movements" style={styles.heading} />
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
          <CustomText type="header2" text="This month's movements" />
          <CustomText
            type="body3"
            text={`${monthLabel} · Cash outflows ${formatMoney(monthTotal, currency)}`}
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

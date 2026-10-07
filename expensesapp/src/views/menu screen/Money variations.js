import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import {
  deleteExpense,
  getExpensesBy,
  getLocalDate,
  stopExpenseRecurrence,
} from "../../utils/database_connector";
import { formatDisplayDate } from "../../utils/dateFormatting";
import { dateOptions, EntryCard, money, Section, styles, useFinanceData } from "./Shared";
export default function MoneyVariationsScreen({ navigation }) {
  const { data, error } = useFinanceData();
  const [transactions, setTransactions] = useState([]);

  const reloadTransactions = useCallback(async () => {
    try {
      setTransactions(await getExpensesBy());
    } catch (loadError) {
      console.error("Failed to load money variations:", loadError);
      Alert.alert("Could not load transactions", "Please try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadTransactions();
    }, [reloadTransactions]),
  );

  const currency = data?.salary?.currency || "";
  const transactionWindow = useMemo(() => {
    const today = new Date();
    const currentYear = getLocalDate(today).slice(0, 4);
    const firstDate = new Date(today);
    const dayOfMonth = firstDate.getDate();
    firstDate.setDate(1);
    firstDate.setFullYear(firstDate.getFullYear() - 1);
    const lastDayOfMonth = new Date(
      firstDate.getFullYear(),
      firstDate.getMonth() + 1,
      0,
    ).getDate();
    firstDate.setDate(Math.min(dayOfMonth, lastDayOfMonth));
    return {
      from: getLocalDate(firstDate),
      to: `${currentYear}-12-31`,
    };
  }, []);
  const visibleTransactions = useMemo(
    () =>
      transactions.filter(transaction => {
        const date = String(transaction.date).slice(0, 10);
        return date >= transactionWindow.from && date <= transactionWindow.to;
      }),
    [transactions, transactionWindow],
  );
  const recurringTransactions = visibleTransactions.filter(
    transaction => transaction.recurrence_frequency,
  );
  const otherTransactions = visibleTransactions.filter(
    transaction => !transaction.recurrence_frequency,
  );

  const renderTransactionGroups = items => {
    const months = new Map();
    for (const transaction of items) {
      const month = String(transaction.date).slice(0, 7);
      const monthTransactions = months.get(month) || [];
      monthTransactions.push(transaction);
      months.set(month, monthTransactions);
    }

    return [...months.entries()].map(([month, monthTransactions]) => (
      <View key={month}>
        <CustomText
          type="header3"
          text={formatDisplayDate(`${month}-01`).slice(3)}
          style={localStyles.monthHeading}
        />
        {monthTransactions.map(transaction => (
          <EntryCard key={transaction.id} title={transaction.name}>
            {dateOptions(
              `${formatDisplayDate(transaction.date)}  ·  ${
                transaction.kind === "income" ? "+" : "-"
              }${money(
                transaction.inflated_value ?? transaction.value,
                currency,
              )}`,
            )}
            {transaction.inflated_value !== null &&
            transaction.inflated_value !== undefined ? (
              dateOptions(
                `Actual Value: ${money(transaction.value, currency)}`,
              )
            ) : null}
            {transaction.recurrence_frequency
              ? dateOptions(
                  Number(transaction.recurrence_active ?? 1) === 0
                    ? `Repeat stopped · was ${transaction.recurrence_frequency}`
                    : `Repeats ${transaction.recurrence_frequency}${
                        transaction.recurrence_end_date
                          ? ` until ${formatDisplayDate(transaction.recurrence_end_date)}`
                          : ""
                      }`,
                )
              : null}
            {transaction.recurrence_frequency &&
            Number(transaction.recurrence_active ?? 1) === 1 ? (
              <CustomButton
                onPress={() =>
                  Alert.alert(
                    "Stop recurring deduction",
                    `Stop future ${transaction.recurrence_frequency} deductions for ${transaction.name}? The original deduction and occurrences already passed will remain in your history.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Stop repeating",
                        style: "destructive",
                        onPress: async () => {
                          try {
                            await stopExpenseRecurrence(transaction.id);
                            await reloadTransactions();
                          } catch (stopError) {
                            console.error(
                              "Failed to stop recurring deduction:",
                              stopError,
                            );
                            Alert.alert(
                              "Could not stop recurrence",
                              stopError instanceof Error
                                ? stopError.message
                                : "Please try again.",
                            );
                          }
                        },
                      },
                    ],
                  )
                }
                style={styles.inlineButton}
                text="Stop repeating"
                type="secondary"
              />
            ) : null}
            {transaction.tags ? dateOptions(transaction.tags) : null}
            {transaction.description
              ? dateOptions(transaction.description)
              : null}
            <CustomButton
              onPress={() =>
                Alert.alert(
                  "Delete transaction",
                  `Permanently delete "${transaction.name}"?${
                    transaction.recurrence_frequency
                      ? " This also removes its recurring schedule and all projected occurrences. Past occurrences are calculated from this schedule and are not separate saved transactions."
                      : ""
                  } This cannot be undone.`,
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await deleteExpense(transaction.id);
                          await reloadTransactions();
                        } catch (deleteError) {
                          console.error(
                            "Failed to delete money variation:",
                            deleteError,
                          );
                          Alert.alert(
                            "Could not delete transaction",
                            deleteError instanceof Error
                              ? deleteError.message
                              : "Please try again.",
                          );
                        }
                      },
                    },
                  ],
                )
              }
              style={styles.inlineButton}
              text="Delete transaction"
              type="warning"
            />
          </EntryCard>
        ))}
      </View>
    ));
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Money variations" />
        <CustomText
          type="body1"
          text="Add income or deductions on any past, current, or future date."
          style={styles.intro}
        />
        <CustomButton
          onPress={() => navigation.navigate("Add general expense")}
          style={styles.actionButton}
          text="Add money variation"
        />
        <Section title="Repeating transactions">
          {error ? dateOptions("Could not load your account settings.") : null}
          {renderTransactionGroups(recurringTransactions)}
          {recurringTransactions.length === 0
            ? dateOptions("No repeating transactions in this date range.")
            : null}
        </Section>
        <Section title="Other transactions">
          {renderTransactionGroups(otherTransactions)}
          {otherTransactions.length === 0
            ? dateOptions("No other transactions in this date range.")
            : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const localStyles = {
  monthHeading: {
    marginTop: 16,
  },
};

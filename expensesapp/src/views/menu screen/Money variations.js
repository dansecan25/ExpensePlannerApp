import React, { useCallback, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import { getExpensesBy } from "../../utils/database_connector";
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
        <Section title="Transactions">
          {error ? dateOptions("Could not load your account settings.") : null}
          {transactions.map(transaction => (
            <EntryCard key={transaction.id} title={transaction.name}>
              {dateOptions(
                `${formatDisplayDate(transaction.date)}  ·  ${
                  transaction.kind === "income" ? "+" : "-"
                }${money(
                  transaction.inflated_value ?? transaction.value,
                  currency,
                )}`,
              )}
              {transaction.tags ? dateOptions(transaction.tags) : null}
              {transaction.description ? dateOptions(transaction.description) : null}
            </EntryCard>
          ))}
          {transactions.length === 0 ? dateOptions("No transactions recorded yet.") : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

import React, { useCallback, useMemo, useState } from "react";
import { t, useLanguage } from "../../i18n/i18n";
import { Alert, ScrollView } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import { createTag, getExpensesBy } from "../../utils/database_connector";
import { dateOptions, EntryCard, money, Section, styles, useFinanceData } from "./Shared";
export default function ExpenseGroupsScreen() {
  useLanguage();
  const { data, error, reload } = useFinanceData();
  const [expenses, setExpenses] = useState([]);
  const [tagName, setTagName] = useState("");
  const currency = data?.salary?.currency || "";

  const reloadExpenses = useCallback(async () => {
    try {
      setExpenses(await getExpensesBy({ kind: "expense" }));
    } catch (loadError) {
      console.error("Failed to load grouped expenses:", loadError);
      Alert.alert(t("Could not load expenses"), t("Please try again."));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadExpenses();
    }, [reloadExpenses]),
  );

  const groups = useMemo(() => {
    const result = new Map();
    for (const expense of expenses) {
      const names = expense.tags ? expense.tags.split(", ") : [t("Ungrouped")];
      for (const name of names) {
        result.set(
          name,
          (result.get(name) || 0) + Number(expense.value || 0),
        );
      }
    }
    return [...result.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [expenses]);

  const addGroup = async () => {
    try {
      await createTag(tagName);
      setTagName("");
      await reload();
    } catch (saveError) {
      console.error("Failed to add expense group:", saveError);
      Alert.alert(
        t("Could not add group"),
        saveError instanceof Error ? saveError.message : t("Please try again."),
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text={t("Expenses by groups")} />
        <CustomText
          type="body1"
          text={t("Tags bring related spending and savings goals together.")}
          style={styles.intro}
        />
        <Section title={t("Spending totals")}>
          {error ? dateOptions(t("Could not load grouped expenses.")) : null}
          {groups.map(([name, total]) => (
            <EntryCard key={name} title={name}>
              {dateOptions(money(total, currency))}
            </EntryCard>
          ))}
          {groups.length === 0 ? dateOptions(t("No tagged expenses yet.")) : null}
        </Section>
        <Section title={t("Create a group or savings goal")}>
          <CustomTextInput
            placeholder={t("e.g. Groceries, Travel fund")}
            setValue={setTagName}
            value={tagName}
          />
          <CustomButton
            onPress={addGroup}
            style={styles.actionButton}
            text={t("Add group")}
          />
        </Section>
        <Section title={t("Available groups")}>
          {data?.tags?.map(tag => (
            <EntryCard key={tag.id} title={tag.name} />
          ))}
          {data?.tags?.length === 0 ? dateOptions(t("No groups created yet.")) : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

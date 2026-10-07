import React, { useMemo, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import { createAccount, deleteAccount } from "../../utils/database_connector";
import { getCashflowProjection } from "../../utils/financeCalculations";
import { dateOptions, EntryCard, money, Section, styles, useFinanceData } from "./Shared";
export default function AccountsScreen() {
  const { data, error, reload } = useFinanceData();
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const currency = data?.salary?.currency || "";
  const projection = useMemo(
    () => (data ? getCashflowProjection(data) : null),
    [data],
  );
  const save = async () => {
    if (!name.trim() || !Number.isFinite(Number(openingBalance))) {
      console.warn("[Account warning] Invalid account details.", {
        name,
        openingBalance,
      });
      Alert.alert("Check account details", "Enter a name and valid opening balance.");
      return;
    }
    try {
      await createAccount(name, "#4261a0", Number(openingBalance));
      setName("");
      setOpeningBalance("0");
      await reload();
    } catch (saveError) {
      console.error("Failed to save account:", saveError);
      Alert.alert(
        "Could not add account",
        saveError instanceof Error ? saveError.message : "Please try again.",
      );
    }
  };

  const confirmDelete = account =>
    Alert.alert(
      "Delete account",
      `Delete ${account.name}? Its opening balance, transactions, and scheduled charges will be moved to another account if one exists.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount(account.id);
              await reload();
            } catch (deleteError) {
              console.error("Failed to delete account:", deleteError);
              Alert.alert("Could not delete account", "Please try again.");
            }
          },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Accounts" />
        <CustomText
          type="body1"
          text="Keep balances separate for each bank account, card, or cash wallet."
          style={styles.intro}
        />
        <Section title="Your accounts">
          {error ? dateOptions("Could not load accounts. Reopen this section to retry.") : null}
          {data?.accounts.map(account => {
            const accountBalance = projection?.accountBalances.find(
              row => row.id === account.id,
            )?.balance;
            return (
              <EntryCard key={account.id} title={account.name}>
                {dateOptions(money(accountBalance, currency))}
                <CustomButton
                  onPress={() => confirmDelete(account)}
                  style={styles.inlineButton}
                  text="Delete"
                  type="warning"
                />
              </EntryCard>
            );
          })}
          {data?.accounts.length === 0
            ? dateOptions("No accounts yet. Add one below.")
            : null}
        </Section>
        <Section title="Add an account">
          <CustomTextInput
            placeholder="Account name"
            setValue={setName}
            value={name}
          />
          <CustomTextInput
            keyboardType="decimal-pad"
            placeholder="Opening balance"
            setValue={setOpeningBalance}
            style={styles.inputSpacing}
            value={openingBalance}
          />
          <CustomButton onPress={save} style={styles.actionButton} text="Add account" />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

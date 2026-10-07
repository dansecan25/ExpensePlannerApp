import React, { useMemo, useState } from "react";
import { Alert, ScrollView } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import CustomButton from "../../components/customButton/customButton";
import CustomCheckbox from "../../components/customCheckbox/customCheckbox";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import {
  createAccount,
  createAccountTransfer,
  deleteAccountTransfer,
  deleteAccount,
  getLocalDate,
  isValidLocalDate,
  stopAccountTransferRecurrence,
} from "../../utils/database_connector";
import {
  getAccountBalancesOnDate,
  getCashflowProjection,
} from "../../utils/financeCalculations";
import { formatDisplayDate } from "../../utils/dateFormatting";
import { dateOptions, EntryCard, money, Section, styles, useFinanceData } from "./Shared";
export default function AccountsScreen() {
  const { data, error, reload } = useFinanceData();
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [transferDate, setTransferDate] = useState(getLocalDate());
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [fromAccountId, setFromAccountId] = useState(null);
  const [toAccountId, setToAccountId] = useState(null);
  const [isSavingTransfer, setIsSavingTransfer] = useState(false);
  const [isRecurringTransfer, setIsRecurringTransfer] = useState(false);
  const [transferFrequency, setTransferFrequency] = useState("monthly");
  const [transferEndDate, setTransferEndDate] = useState("");
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

  const accounts = data?.accounts || [];
  const accountOptions = accounts.map(account => ({
    label: account.name,
    value: account.id,
  }));
  const saveTransfer = async () => {
    const sourceId = fromAccountId ?? accounts[0]?.id;
    const destinationId =
      toAccountId ?? accounts.find(account => account.id !== sourceId)?.id;
    const amount = Number(transferAmount);
    if (
      !isValidLocalDate(transferDate) ||
      (isRecurringTransfer &&
        transferEndDate &&
        (!isValidLocalDate(transferEndDate) ||
          transferEndDate < transferDate)) ||
      !Number.isFinite(amount) ||
      amount <= 0 ||
      sourceId === undefined ||
      destinationId === undefined ||
      sourceId === destinationId
    ) {
      Alert.alert(
        "Check transfer details",
        "Choose two different accounts, a valid date, and a positive amount.",
      );
      return;
    }

    setIsSavingTransfer(true);
    try {
      const today = new Date();
      const target = new Date(`${transferDate}T12:00:00`);
      const days = Math.max(
        730,
        Math.ceil((target.getTime() - today.getTime()) / 86400000) + 1,
      );
      const transferProjection =
        projection && transferDate <= projection.throughDate
          ? projection
          : getCashflowProjection(data, today, days);
      const balances = getAccountBalancesOnDate(
        transferProjection,
        transferDate,
      ).accounts;
      const sourceBalance = Number(
        balances.find(account => account.id === sourceId)?.balance || 0,
      );
      if (sourceBalance < amount) {
        Alert.alert(
          "Insufficient funds",
          `Only ${money(sourceBalance, currency)} is projected in ${
            accounts.find(account => account.id === sourceId)?.name || "the source account"
          } on ${formatDisplayDate(transferDate)}.`,
        );
        return;
      }
      const recurrenceFrequency = isRecurringTransfer
        ? transferFrequency
        : null;
      if (recurrenceFrequency && transferDate >= getLocalDate()) {
        const candidateTransfer = {
          id: "candidate-transfer-check",
          date: transferDate,
          amount,
          from_account_id: sourceId,
          to_account_id: destinationId,
          from_account_name:
            accounts.find(account => account.id === sourceId)?.name,
          to_account_name:
            accounts.find(account => account.id === destinationId)?.name,
          recurrence_frequency: recurrenceFrequency,
          recurrence_end_date: transferEndDate || null,
        };
        const recurringProjection = getCashflowProjection(
          {
            ...data,
            accountTransfers: [
              ...(data.accountTransfers || []),
              candidateTransfer,
            ],
          },
          today,
          days,
        );
        const occurrenceDates = recurringProjection.events
          .filter(
            event =>
              event.kind === "transfer_out" &&
              event.transfer_id === candidateTransfer.id &&
              event.account_id === sourceId &&
              event.date >= transferDate,
          )
          .map(event => event.date);
        const firstUnaffordableDate = occurrenceDates.find(date => {
          const accountBalance = getAccountBalancesOnDate(
            recurringProjection,
            date,
            today,
          ).accounts.find(account => account.id === sourceId)?.balance;
          return Number(accountBalance || 0) < 0;
        });
        if (firstUnaffordableDate) {
          Alert.alert(
            "Insufficient funds",
            `This recurring transfer would overdraw the source account on ${formatDisplayDate(firstUnaffordableDate)}.`,
          );
          return;
        }
      }
      await createAccountTransfer({
        date: transferDate,
        fromAccountId: sourceId,
        toAccountId: destinationId,
        amount,
        availableBalance: sourceBalance,
        recurrenceFrequency,
        recurrenceEndDate:
          isRecurringTransfer && transferEndDate ? transferEndDate : null,
        description: transferDescription,
      });
      setTransferAmount("");
      setTransferDescription("");
      setTransferEndDate("");
      await reload();
    } catch (transferError) {
      console.error("Failed to save account transfer:", transferError);
      Alert.alert(
        "Could not transfer money",
        transferError instanceof Error
          ? transferError.message
          : "Please try again.",
      );
    } finally {
      setIsSavingTransfer(false);
    }
  };

  const confirmDeleteTransfer = transfer =>
    Alert.alert(
      "Delete account transfer",
      `Delete the ${money(transfer.amount, currency)} transfer from ${
        transfer.from_account_name || "the source account"
      } to ${transfer.to_account_name || "the destination account"}?${
        transfer.recurrence_frequency
          ? " This will remove the recurring transfer, its historical record, and all derived occurrences."
          : ""
      }`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccountTransfer(transfer.id);
              await reload();
            } catch (deleteError) {
              console.error("Failed to delete account transfer:", deleteError);
              Alert.alert(
                "Could not delete transfer",
                deleteError instanceof Error
                  ? deleteError.message
                  : "Please try again.",
              );
            }
          },
        },
      ],
    );

  const confirmStopTransfer = transfer =>
    Alert.alert(
      "Stop recurring transfer",
      `Stop future occurrences of the transfer from ${
        transfer.from_account_name || "the source account"
      } to ${transfer.to_account_name || "the destination account"}? Transfers due on or before ${formatDisplayDate(
        getLocalDate(),
      )} will remain in its history. This cannot be resumed; create a new transfer if needed.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop transfer",
          style: "destructive",
          onPress: async () => {
            try {
              await stopAccountTransferRecurrence(transfer.id);
              await reload();
            } catch (stopError) {
              console.error("Failed to stop recurring transfer:", stopError);
              Alert.alert(
                "Could not stop transfer",
                stopError instanceof Error
                  ? stopError.message
                  : "Please try again.",
              );
            }
          },
        },
      ],
    );

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
        <Section title="Move money between accounts">
          {accounts.length < 2 ? (
            dateOptions("Add at least two accounts to move money between them.")
          ) : (
            <>
              <CustomTextInput
                autoCapitalize="none"
                placeholder="Date (YYYY-MM-DD)"
                setValue={setTransferDate}
                value={transferDate}
              />
              <Dropdown
                data={accountOptions}
                labelField="label"
                onChange={item => setFromAccountId(item.value)}
                placeholder="From account"
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                dropdownPosition="bottom"
                style={styles.inputSpacing}
                value={fromAccountId}
                valueField="value"
              />
              <Dropdown
                data={accountOptions.filter(account => account.value !== fromAccountId)}
                labelField="label"
                onChange={item => setToAccountId(item.value)}
                placeholder="To account"
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                dropdownPosition="bottom"
                style={styles.inputSpacing}
                value={toAccountId}
                valueField="value"
              />
              <CustomTextInput
                keyboardType="decimal-pad"
                placeholder="Amount"
                setValue={setTransferAmount}
                style={styles.inputSpacing}
                value={transferAmount}
              />
              <CustomTextInput
                placeholder="Description (optional)"
                setValue={setTransferDescription}
                style={styles.inputSpacing}
                value={transferDescription}
              />
              <CustomCheckbox
                checked={isRecurringTransfer}
                containerStyles={styles.inputSpacing}
                label="Recurring transfer"
                onToggle={() => setIsRecurringTransfer(value => !value)}
              />
              {isRecurringTransfer ? (
                <>
                  <Dropdown
                    data={[
                      { label: "Weekly", value: "weekly" },
                      { label: "Monthly", value: "monthly" },
                      { label: "Yearly", value: "yearly" },
                    ]}
                    labelField="label"
                    onChange={item => setTransferFrequency(item.value)}
                    placeholder="Repeat frequency"
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}
                    dropdownPosition="bottom"
                    style={styles.inputSpacing}
                    value={transferFrequency}
                    valueField="value"
                  />
                  <CustomTextInput
                    autoCapitalize="none"
                    placeholder="End date (optional, YYYY-MM-DD)"
                    setValue={setTransferEndDate}
                    style={styles.inputSpacing}
                    value={transferEndDate}
                  />
                </>
              ) : null}
              <CustomButton
                disabled={isSavingTransfer}
                onPress={saveTransfer}
                style={styles.actionButton}
                text={isSavingTransfer ? "Transferring..." : "Transfer money"}
              />
            </>
          )}
        </Section>
        <Section title="Account transfers">
          {(data?.accountTransfers || []).map(transfer => (
            <EntryCard
              key={transfer.id}
              title={`${transfer.from_account_name || "Account"} → ${transfer.to_account_name || "Account"}`}
            >
              {dateOptions(
                `${formatDisplayDate(transfer.date)} · ${money(transfer.amount, currency)}${
                  transfer.recurrence_frequency
                    ? Number(transfer.recurrence_active ?? 1) !== 1
                      ? ` · Stopped ${transfer.recurrence_stopped_date ? formatDisplayDate(transfer.recurrence_stopped_date) : ""}`
                      : ` · Repeats ${transfer.recurrence_frequency}${
                          transfer.recurrence_end_date
                            ? ` until ${formatDisplayDate(transfer.recurrence_end_date)}`
                            : ""
                        }`
                    : ""
                }${
                  transfer.description ? ` · ${transfer.description}` : ""
                }`,
              )}
              {transfer.recurrence_frequency &&
              Number(transfer.recurrence_active ?? 1) === 1 ? (
                <CustomButton
                  onPress={() => confirmStopTransfer(transfer)}
                  style={styles.inlineButton}
                  text="Stop repeating"
                  type="secondary"
                />
              ) : null}
              <CustomButton
                onPress={() => confirmDeleteTransfer(transfer)}
                style={styles.inlineButton}
                text="Delete transfer"
                type="warning"
              />
            </EntryCard>
          ))}
          {!data?.accountTransfers?.length
            ? dateOptions("No account transfers yet.")
            : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

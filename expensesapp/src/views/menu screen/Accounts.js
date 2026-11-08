import React, { useMemo, useState } from "react";
import { accountLabel, t, useLanguage } from "../../i18n/i18n";
import { Alert, ScrollView, View } from "react-native";
import Dropdown from "../../components/customDropdown/CustomDropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import CustomButton from "../../components/customButton/customButton";
import CustomCheckbox from "../../components/customCheckbox/customCheckbox";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import DatePicker from "../../components/datePicker/DatePicker";
import {
  createAccount,
  createAccountTransfer,
  deleteAccountTransfer,
  deleteAccount,
  getLocalDate,
  isValidLocalDate,
  stopAccountTransferRecurrence,
  updateCreditAccountDates,
} from "../../utils/database_connector";
import {
  getCreditAccountStatus,
  isCreditAccount,
} from "../../utils/creditAccountSchedule";
import {
  getAccountBalancesOnDate,
  getCashflowProjection,
} from "../../utils/financeCalculations";
import { formatDisplayDate } from "../../utils/dateFormatting";
import { dateOptions, EntryCard, money, Section, styles, useFinanceData } from "./Shared";

const isValidCreditDay = value => {
  const day = Number(value);
  return value.trim() !== "" && Number.isInteger(day) && day >= 1 && day <= 31;
};

const describeDaysLeft = days =>
  days === 0
    ? t("today")
    : days === 1
      ? t("tomorrow")
      : t("in {days} days", { days });

export default function AccountsScreen() {
  useLanguage();
  const { data, error, reload } = useFinanceData();
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [accountType, setAccountType] = useState("bank");
  const [cutDay, setCutDay] = useState("");
  const [paymentDay, setPaymentDay] = useState("");
  const [editingCreditId, setEditingCreditId] = useState(null);
  const [editCutDay, setEditCutDay] = useState("");
  const [editPaymentDay, setEditPaymentDay] = useState("");
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
      Alert.alert(t("Check account details"), t("Enter a name and valid opening balance."));
      return;
    }
    const isCredit = accountType === "credit";
    if (isCredit && (!isValidCreditDay(cutDay) || !isValidCreditDay(paymentDay))) {
      Alert.alert(
        t("Check credit dates"),
        t("Enter the cut date and last payment date as days of the month, from 1 to 31."),
      );
      return;
    }
    try {
      await createAccount(
        name,
        "#4261a0",
        isCredit ? -Math.abs(Number(openingBalance)) : Number(openingBalance),
        isCredit
          ? { accountType: "credit", cutDay, paymentDay }
          : undefined,
      );
      setName("");
      setOpeningBalance("0");
      setCutDay("");
      setPaymentDay("");
      setAccountType("bank");
      await reload();
    } catch (saveError) {
      console.error("Failed to save account:", saveError);
      Alert.alert(
        t("Could not add account"),
        saveError instanceof Error ? saveError.message : t("Please try again."),
      );
    }
  };

  const startEditingCredit = account => {
    setEditingCreditId(account.id);
    setEditCutDay(String(account.credit_cut_day ?? ""));
    setEditPaymentDay(String(account.credit_payment_day ?? ""));
  };

  const saveCreditDates = async account => {
    if (!isValidCreditDay(editCutDay) || !isValidCreditDay(editPaymentDay)) {
      Alert.alert(
        t("Check credit dates"),
        t("Enter the cut date and last payment date as days of the month, from 1 to 31."),
      );
      return;
    }
    try {
      await updateCreditAccountDates(account.id, editCutDay, editPaymentDay);
      setEditingCreditId(null);
      await reload();
    } catch (saveError) {
      console.error("Failed to update credit dates:", saveError);
      Alert.alert(
        t("Could not update credit dates"),
        saveError instanceof Error ? saveError.message : t("Please try again."),
      );
    }
  };

  const renderCreditDetails = account => {
    const status = projection
      ? getCreditAccountStatus(account, projection)
      : null;
    return (
      <>
        {status ? (
          <>
            {dateOptions(t("Owed now: {amount}", { amount: money(status.owedNow, currency) }))}
            {dateOptions(t("Next cut: {date}", { date: formatDisplayDate(status.nextCutDate) }))}
            {dateOptions(
              t("Pay by: {date} ({daysLeft})", {
                date: formatDisplayDate(status.dueDate),
                daysLeft: describeDaysLeft(status.daysUntilDue),
              }),
            )}
            {dateOptions(
              !status.statementClosed
                ? t("Projected statement: {amount}", { amount: money(status.amountDue, currency) })
                : status.amountDue > 0.005
                  ? t("Amount due: {amount}", { amount: money(status.amountDue, currency) })
                  : t("Current statement paid"),
            )}
            {status.pastDueDate
              ? dateOptions(
                  t("Past due since {date}: {amount}", {
                    date: formatDisplayDate(status.pastDueDate),
                    amount: money(status.pastDueAmount, currency),
                  }),
                )
              : null}
          </>
        ) : null}
        {editingCreditId === account.id ? (
          <>
            <CustomTextInput
              keyboardType="number-pad"
              placeholder={t("Cut date (day of month)")}
              setValue={setEditCutDay}
              style={styles.inputSpacing}
              value={editCutDay}
            />
            <CustomTextInput
              keyboardType="number-pad"
              placeholder={t("Last payment date (day of month)")}
              setValue={setEditPaymentDay}
              style={styles.inputSpacing}
              value={editPaymentDay}
            />
            <View style={styles.buttonRow}>
              <CustomButton
                onPress={() => saveCreditDates(account)}
                style={styles.smallButton}
                text={t("Save dates")}
              />
              <CustomButton
                onPress={() => setEditingCreditId(null)}
                style={styles.smallButton}
                text={t("Cancel")}
                type="secondary"
              />
            </View>
          </>
        ) : (
          <CustomButton
            onPress={() => startEditingCredit(account)}
            style={styles.inlineButton}
            text={t("Edit credit dates")}
            type="secondary"
          />
        )}
      </>
    );
  };

  const accounts = data?.accounts || [];
  const accountOptions = accounts.map(account => ({
    label: accountLabel(account.name),
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
        t("Check transfer details"),
        t("Choose two different accounts, a valid date, and a positive amount."),
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
          t("Insufficient funds"),
          t("Only {amount} is projected in {account} on {date}.", {
            amount: money(sourceBalance, currency),
            account:
              accountLabel(accounts.find(account => account.id === sourceId)?.name) ||
              t("the source account"),
            date: formatDisplayDate(transferDate),
          }),
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
            t("Insufficient funds"),
            t("This recurring transfer would overdraw the source account on {date}.", {
              date: formatDisplayDate(firstUnaffordableDate),
            }),
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
        t("Could not transfer money"),
        transferError instanceof Error
          ? transferError.message
          : t("Please try again."),
      );
    } finally {
      setIsSavingTransfer(false);
    }
  };

  const confirmDeleteTransfer = transfer =>
    Alert.alert(
      t("Delete account transfer"),
      `${t("Delete the {amount} transfer from {from} to {to}?", {
        amount: money(transfer.amount, currency),
        from: accountLabel(transfer.from_account_name) || t("the source account"),
        to: accountLabel(transfer.to_account_name) || t("the destination account"),
      })}${
        transfer.recurrence_frequency
          ? ` ${t("This will remove the recurring transfer, its historical record, and all derived occurrences.")}`
          : ""
      }`,
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccountTransfer(transfer.id);
              await reload();
            } catch (deleteError) {
              console.error("Failed to delete account transfer:", deleteError);
              Alert.alert(
                t("Could not delete transfer"),
                deleteError instanceof Error
                  ? deleteError.message
                  : t("Please try again."),
              );
            }
          },
        },
      ],
    );

  const confirmStopTransfer = transfer =>
    Alert.alert(
      t("Stop recurring transfer"),
      t("Stop future occurrences of the transfer from {from} to {to}? Transfers due on or before {date} will remain in its history. This cannot be resumed; create a new transfer if needed.", {
        from: accountLabel(transfer.from_account_name) || t("the source account"),
        to: accountLabel(transfer.to_account_name) || t("the destination account"),
        date: formatDisplayDate(getLocalDate()),
      }),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Stop transfer"),
          style: "destructive",
          onPress: async () => {
            try {
              await stopAccountTransferRecurrence(transfer.id);
              await reload();
            } catch (stopError) {
              console.error("Failed to stop recurring transfer:", stopError);
              Alert.alert(
                t("Could not stop transfer"),
                stopError instanceof Error
                  ? stopError.message
                  : t("Please try again."),
              );
            }
          },
        },
      ],
    );

  const confirmDelete = account =>
    Alert.alert(
      t("Delete account"),
      t("Delete {name}? Its opening balance, transactions, and scheduled charges will be moved to another account if one exists.", {
        name: accountLabel(account.name),
      }),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Delete"),
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount(account.id);
              await reload();
            } catch (deleteError) {
              console.error("Failed to delete account:", deleteError);
              Alert.alert(t("Could not delete account"), t("Please try again."));
            }
          },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text={t("Accounts")} />
        <CustomText
          type="body1"
          text={t("Keep balances separate for each bank account, card, or cash wallet.")}
          style={styles.intro}
        />
        <Section title={t("Your accounts")}>
          {error ? dateOptions(t("Could not load accounts. Reopen this section to retry.")) : null}
          {data?.accounts.map(account => {
            const accountBalance = projection?.accountBalances.find(
              row => row.id === account.id,
            )?.balance;
            return (
              <EntryCard
                key={account.id}
                title={
                  isCreditAccount(account)
                    ? t("{name} · Credit", { name: account.name })
                    : accountLabel(account.name)
                }
              >
                {isCreditAccount(account)
                  ? renderCreditDetails(account)
                  : dateOptions(money(accountBalance, currency))}
                <CustomButton
                  onPress={() => confirmDelete(account)}
                  style={styles.inlineButton}
                  text={t("Delete")}
                  type="warning"
                />
              </EntryCard>
            );
          })}
          {data?.accounts.length === 0
            ? dateOptions(t("No accounts yet. Add one below."))
            : null}
        </Section>
        <Section title={t("Add an account")}>
          <View style={styles.buttonRow}>
            <CustomButton
              onPress={() => setAccountType("bank")}
              style={styles.smallButton}
              text={t("Bank or cash")}
              type={accountType === "bank" ? "primary" : "secondary"}
            />
            <CustomButton
              onPress={() => setAccountType("credit")}
              style={styles.smallButton}
              text={t("Credit")}
              type={accountType === "credit" ? "primary" : "secondary"}
            />
          </View>
          <CustomTextInput
            placeholder={t("Account name")}
            setValue={setName}
            style={styles.inputSpacing}
            value={name}
          />
          <CustomTextInput
            keyboardType="decimal-pad"
            placeholder={
              accountType === "credit"
                ? t("Amount currently owed")
                : t("Opening balance")
            }
            setValue={setOpeningBalance}
            style={styles.inputSpacing}
            value={openingBalance}
          />
          {accountType === "credit" ? (
            <>
              <CustomTextInput
                keyboardType="number-pad"
                placeholder={t("Cut date (day of month)")}
                setValue={setCutDay}
                style={styles.inputSpacing}
                value={cutDay}
              />
              <CustomTextInput
                keyboardType="number-pad"
                placeholder={t("Last payment date (day of month)")}
                setValue={setPaymentDay}
                style={styles.inputSpacing}
                value={paymentDay}
              />
              {dateOptions(
                t("Record purchases against this account, and pay it with a transfer from another account."),
              )}
            </>
          ) : null}
          <CustomButton onPress={save} style={styles.actionButton} text={t("Add account")} />
        </Section>
        <Section title={t("Move money between accounts")}>
          {accounts.length < 2 ? (
            dateOptions(t("Add at least two accounts to move money between them."))
          ) : (
            <>
              <DatePicker
                placeholder={t("Transfer date")}
                setValue={setTransferDate}
                value={transferDate}
              />
              <Dropdown
                data={accountOptions}
                labelField="label"
                onChange={item => setFromAccountId(item.value)}
                placeholder={t("From account")}
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
                placeholder={t("To account")}
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                dropdownPosition="bottom"
                style={styles.inputSpacing}
                value={toAccountId}
                valueField="value"
              />
              <CustomTextInput
                keyboardType="decimal-pad"
                placeholder={t("Amount")}
                setValue={setTransferAmount}
                style={styles.inputSpacing}
                value={transferAmount}
              />
              <CustomTextInput
                placeholder={t("Description (optional)")}
                setValue={setTransferDescription}
                style={styles.inputSpacing}
                value={transferDescription}
              />
              <CustomCheckbox
                checked={isRecurringTransfer}
                containerStyles={styles.inputSpacing}
                label={t("Recurring transfer")}
                onToggle={() => setIsRecurringTransfer(value => !value)}
              />
              {isRecurringTransfer ? (
                <>
                  <Dropdown
                    data={[
                      { label: t("Weekly"), value: "weekly" },
                      { label: t("Monthly"), value: "monthly" },
                      { label: t("Yearly"), value: "yearly" },
                    ]}
                    labelField="label"
                    onChange={item => setTransferFrequency(item.value)}
                    placeholder={t("Repeat frequency")}
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}
                    dropdownPosition="bottom"
                    style={styles.inputSpacing}
                    value={transferFrequency}
                    valueField="value"
                  />
                  <DatePicker
                    allowClear
                    placeholder={t("End date (optional)")}
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
                text={isSavingTransfer ? t("Transferring...") : t("Transfer money")}
              />
            </>
          )}
        </Section>
        <Section title={t("Account transfers")}>
          {(data?.accountTransfers || []).map(transfer => (
            <EntryCard
              key={transfer.id}
              title={`${accountLabel(transfer.from_account_name) || t("Account")} → ${accountLabel(transfer.to_account_name) || t("Account")}`}
            >
              {dateOptions(
                `${formatDisplayDate(transfer.date)} · ${money(transfer.amount, currency)}${
                  transfer.recurrence_frequency
                    ? Number(transfer.recurrence_active ?? 1) !== 1
                      ? ` · ${t("Stopped {date}", { date: transfer.recurrence_stopped_date ? formatDisplayDate(transfer.recurrence_stopped_date) : "" })}`
                      : ` · ${t("Repeats {frequency}", { frequency: t(transfer.recurrence_frequency) })}${
                          transfer.recurrence_end_date
                            ? ` ${t("until {date}", { date: formatDisplayDate(transfer.recurrence_end_date) })}`
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
                  text={t("Stop repeating")}
                  type="secondary"
                />
              ) : null}
              <CustomButton
                onPress={() => confirmDeleteTransfer(transfer)}
                style={styles.inlineButton}
                text={t("Delete transfer")}
                type="warning"
              />
            </EntryCard>
          ))}
          {!data?.accountTransfers?.length
            ? dateOptions(t("No account transfers yet."))
            : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

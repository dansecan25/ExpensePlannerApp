import React, { useEffect, useMemo, useState } from "react";
import { accountLabel, t, useLanguage } from "../i18n/i18n";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Dropdown from "../components/customDropdown/CustomDropdown";

import CustomButton from "../components/customButton/customButton";
import CustomCheckbox from "../components/customCheckbox/customCheckbox";
import CustomText from "../components/customText/customText";
import CustomTextInput from "../components/customTextInput/customTextInput";
import DatePicker from "../components/datePicker/DatePicker";
import { dropdownStyles } from "../components/customDropdown/dropdownStylesCustom";
import {
  createTag,
  deleteMovement,
  getCashflowData,
  isValidLocalDate,
  saveMovementEdit,
  saveSalaryScheduleChange,
} from "../utils/database_connector";
import {
  getAccountBalancesOnDate,
  getCashflowProjection,
  getSalaryDeductions,
  getSalaryScheduleForDate,
} from "../utils/financeCalculations";
import { formatDisplayDate } from "../utils/dateFormatting";
import { getColors } from "../utils/color-picker";
import { useTheme } from "../utils/themeContext";
import { useKeyboardReveal } from "../utils/useKeyboardReveal";

const getKindLabels = () => ({
  expense: t("Deduction"),
  savings: t("Savings"),
  income: t("Income"),
  savings_use: t("Savings used"),
});

const getRepeatOptions = () => [
  { label: t("Weekly"), value: "weekly" },
  { label: t("Monthly"), value: "monthly" },
  { label: t("Yearly"), value: "yearly" },
];

const getSubscriptionOptions = () => [
  { label: t("Monthly"), value: "monthly" },
  { label: t("Annual"), value: "annual" },
  { label: t("Custom (days)"), value: "custom" },
];

const dayDifference = (from, to) => {
  const [fromYear, fromMonth, fromDay] = from.slice(0, 10).split("-").map(Number);
  const [toYear, toMonth, toDay] = to.slice(0, 10).split("-").map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86400000,
  );
};

const shiftDate = (value, days) => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  const date = new Date(year, month - 1, day + days, 12);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
};

// Finds the gross monthly salary whose estimated net pay equals targetNet.
const solveGrossSalary = (targetNet, data) => {
  const savingsAmount =
    data.salary?.savings_mode_enabled === true ||
    Number(data.salary?.savings_mode_enabled) === 1
      ? Math.max(0, Number(data.salary?.savings_mode_amount || 0))
      : 0;
  const netOf = gross =>
    Math.max(
      0,
      gross -
        getSalaryDeductions(gross, data.salaryDeductions, data.otherTaxes) -
        savingsAmount,
    );
  let low = 0;
  let high = Math.max(targetNet, 1);
  for (let step = 0; step < 60 && netOf(high) < targetNet; step += 1) {
    high *= 2;
  }
  for (let step = 0; step < 60; step += 1) {
    const middle = (low + high) / 2;
    if (netOf(middle) < targetNet) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return Math.round(high * 100) / 100;
};

const parseTagNames = text =>
  text
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

function Field({ children, label, onLayout }) {
  return (
    <View onLayout={onLayout} style={styles.field}>
      <CustomText type="body4" text={label} style={styles.fieldLabel} />
      {children}
    </View>
  );
}

export default function EditMovementScreen({ navigation, route }) {
  useLanguage();
  useTheme();
  const { contentInsetStyle, recordFieldLayout, revealField, scrollRef } =
    useKeyboardReveal();
  const target = route?.params?.movement;
  const sourceType = target?.sourceType;
  const occurrenceDate = target?.occurrenceDate;

  const [data, setData] = useState(null);
  const [source, setSource] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(occurrenceDate || "");
  const [kind, setKind] = useState("expense");
  const [accountId, setAccountId] = useState(null);
  const [fromAccountId, setFromAccountId] = useState(null);
  const [toAccountId, setToAccountId] = useState(null);
  const [isInflated, setIsInflated] = useState(false);
  const [inflatedAmount, setInflatedAmount] = useState("");
  const [isRepeat, setIsRepeat] = useState(false);
  const [repeatFrequency, setRepeatFrequency] = useState("monthly");
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [subscriptionFrequency, setSubscriptionFrequency] = useState("monthly");
  const [intervalDays, setIntervalDays] = useState("");
  const [tagText, setTagText] = useState("");
  const [tagTouched, setTagTouched] = useState(false);
  const [originalTagIds, setOriginalTagIds] = useState([]);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        if (!target || !sourceType || !occurrenceDate) {
          throw new Error(t("Missing movement."));
        }
        const financeData = await getCashflowData();
        let row = null;
        if (sourceType === "expense") {
          row = financeData.expenses.find(
            item => String(item.id) === String(target.sourceId),
          );
        } else if (sourceType === "subscription") {
          row = financeData.subscriptions.find(
            item => String(item.id) === String(target.sourceId),
          );
        } else if (sourceType === "transfer") {
          row = (financeData.accountTransfers || []).find(
            item => String(item.id) === String(target.sourceId),
          );
        } else if (sourceType === "salary") {
          row = financeData.salary;
        }
        if (!row) {
          throw new Error(t("Movement not found."));
        }
        if (!isMounted) {
          return;
        }
        const defaultAccount =
          financeData.accounts.find(
            account =>
              account.name.trim().toLocaleLowerCase() === "main account",
          ) || financeData.accounts[0];

        if (sourceType === "expense") {
          setName(row.name || "");
          setAmount(String(row.value));
          setDescription(row.description || "");
          setKind(row.kind || "expense");
          setAccountId(row.account_id ?? defaultAccount?.id ?? null);
          if (row.inflated_value !== null && row.inflated_value !== undefined) {
            setIsInflated(true);
            setInflatedAmount(String(row.inflated_value));
          }
          setIsRepeat(Boolean(row.recurrence_frequency));
          setRepeatFrequency(row.recurrence_frequency || "monthly");
          setRepeatEndDate(row.recurrence_end_date || "");
          setTagText(row.tags || "");
          setOriginalTagIds(
            String(row.tag_ids || "")
              .split(",")
              .filter(Boolean)
              .map(Number),
          );
        } else if (sourceType === "subscription") {
          setName(row.name || "");
          setAmount(String(row.amount));
          setDescription(row.description || "");
          setKind(Number(row.is_savings) === 1 ? "savings" : "expense");
          setAccountId(row.account_id ?? defaultAccount?.id ?? null);
          if (row.inflated_value !== null && row.inflated_value !== undefined) {
            setIsInflated(true);
            setInflatedAmount(String(row.inflated_value));
          }
          setSubscriptionFrequency(row.frequency || "monthly");
          setIntervalDays(row.interval_days ? String(row.interval_days) : "");
          setTagText(row.tag_name || "");
          setOriginalTagIds(row.tag_id ? [Number(row.tag_id)] : []);
        } else if (sourceType === "transfer") {
          setAmount(String(row.amount));
          setDescription(row.description || "");
          setFromAccountId(row.from_account_id);
          setToAccountId(row.to_account_id);
          setIsRepeat(Boolean(row.recurrence_frequency));
          setRepeatFrequency(row.recurrence_frequency || "monthly");
          setRepeatEndDate(row.recurrence_end_date || "");
        } else if (sourceType === "salary") {
          setName(t("Salary"));
          setAmount(String(target.occurrenceAmount ?? 0));
          setKind("income");
          setAccountId(
            target.occurrenceAccountId ?? defaultAccount?.id ?? null,
          );
          setTagText("Salary");
          setTagTouched(true);
        }
        setSource(row);
        setData(financeData);
      } catch (error) {
        console.error("Failed to load movement for editing:", error);
        if (isMounted) {
          setLoadFailed(true);
        }
      }
    };
    load();
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isTransfer = sourceType === "transfer";
  const isSubscription = sourceType === "subscription";
  const isSalary = sourceType === "salary";
  const isSeries =
    isSalary ||
    isSubscription ||
    (source && Boolean(source.recurrence_frequency));
  const canRepeat =
    isTransfer ||
    (sourceType === "expense" && (kind === "expense" || kind === "savings"));
  const kindChoices =
    isSubscription || (sourceType === "expense" && isSeries)
      ? ["expense", "savings"]
      : isSalary
        ? ["income", "expense", "savings"]
        : ["expense", "savings", "income", "savings_use"];

  const accounts = useMemo(
    () =>
      (data?.accounts || []).map(account => ({
        label: accountLabel(account.name),
        value: account.id,
      })),
    [data],
  );
  const tags = data?.tags || [];
  const currency = data?.salary?.currency || "";

  const numericAmount = Number(amount);
  const numericInflated = Number(inflatedAmount);
  const showInflate = kind === "expense" && !isTransfer;
  const inflationValid =
    !showInflate ||
    !isInflated ||
    (inflatedAmount.trim() !== "" &&
      Number.isFinite(numericInflated) &&
      numericInflated >= numericAmount);
  const repeatEndValid =
    !(isRepeat && canRepeat) ||
    !repeatEndDate ||
    (isValidLocalDate(repeatEndDate) && repeatEndDate >= date);
  const intervalValid =
    !isSubscription ||
    subscriptionFrequency !== "custom" ||
    (Number.isInteger(Number(intervalDays)) && Number(intervalDays) >= 1);
  const transferValid =
    !isTransfer ||
    (fromAccountId !== null && toAccountId !== null && fromAccountId !== toAccountId);
  const canSave =
    (isTransfer || name.trim().length > 0) &&
    amount.trim().length > 0 &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    isValidLocalDate(date) &&
    inflationValid &&
    repeatEndValid &&
    intervalValid &&
    transferValid;

  const tagSegment = tagText.split(",").pop().trim().toLocaleLowerCase();
  const chosenTagNames = parseTagNames(tagText.split(",").slice(0, -1).join(","))
    .map(tag => tag.toLocaleLowerCase());
  const suggestedTags = tagTouched
    ? tags
        .filter(
          tag =>
            tag.name.toLocaleLowerCase().includes(tagSegment) &&
            !chosenTagNames.includes(tag.name.toLocaleLowerCase()),
        )
        .slice(0, 6)
    : [];

  const pickTag = tag => {
    const prefix = tagText.split(",").slice(0, -1).map(part => part.trim());
    setTagText([...prefix, tag.name].join(", "));
    setTagTouched(true);
  };

  const resolveTagIds = async () => {
    if (!tagTouched) {
      return originalTagIds;
    }
    const ids = [];
    for (const tagName of parseTagNames(tagText)) {
      const tag = await createTag(tagName);
      if (!ids.includes(tag.id)) {
        ids.push(tag.id);
      }
    }
    return ids;
  };

  const checkTransferAffordability = async (scope, values) => {
    const original = (data.accountTransfers || []).find(
      item => String(item.id) === String(target.sourceId),
    );
    const accountName = id =>
      data.accounts.find(account => account.id === id)?.name;
    const recurring = Boolean(original.recurrence_frequency);
    const editedId = recurring && scope === "instance" ? "edited-transfer" : original.id;
    const edited = {
      ...original,
      id: editedId,
      date:
        recurring && scope === "all"
          ? shiftDate(original.date, dayDifference(occurrenceDate, values.date))
          : values.date,
      amount: values.amount,
      from_account_id: values.fromAccountId,
      to_account_id: values.toAccountId,
      from_account_name: accountName(values.fromAccountId),
      to_account_name: accountName(values.toAccountId),
      recurrence_frequency:
        recurring && scope === "instance"
          ? null
          : values.recurrenceFrequency,
      recurrence_end_date:
        recurring && scope === "instance" ? null : values.recurrenceEndDate,
      excluded_dates: recurring && scope === "instance" ? null : original.excluded_dates,
    };
    const accountTransfers = (data.accountTransfers || [])
      .map(item =>
        recurring && scope === "instance" && item.id === original.id
          ? {
              ...item,
              excluded_dates: [
                ...String(item.excluded_dates || "").split(",").filter(Boolean),
                occurrenceDate,
              ].join(","),
            }
          : item,
      )
      .filter(item => recurring && scope === "instance" ? true : item.id !== original.id);
    accountTransfers.push(edited);

    const today = new Date();
    const days = Math.max(
      730,
      Math.ceil(
        (new Date(`${values.date}T12:00:00`).getTime() - today.getTime()) /
          86400000,
      ) + 1,
    );
    const projection = getCashflowProjection(
      { ...data, accountTransfers },
      today,
      days,
    );
    const dates = projection.events
      .filter(
        event =>
          event.kind === "transfer_out" &&
          event.transfer_id === editedId &&
          event.date >= values.date,
      )
      .map(event => event.date);
    for (const checkDate of dates.length ? dates : [values.date]) {
      const balance = Number(
        getAccountBalancesOnDate(projection, checkDate, today).accounts.find(
          account => account.id === values.fromAccountId,
        )?.balance || 0,
      );
      if (balance < -0.005) {
        Alert.alert(
          t("Insufficient funds"),
          t("{account} would be overdrawn on {date} after this change.", {
            account: accountLabel(accountName(values.fromAccountId)) || t("The source account"),
            date: formatDisplayDate(checkDate),
          }),
        );
        return false;
      }
    }
    return true;
  };

  const saveSalaryForAllInstances = async () => {
    if (kind !== "income") {
      throw new Error(
        'Salary deposits must stay as income when changing all instances. Use "this instance only" to convert a single deposit.',
      );
    }
    const schedule = getSalaryScheduleForDate(data, occurrenceDate);
    if (!schedule || schedule.income_type !== "fixed") {
      throw new Error(t("The fixed salary schedule for this deposit could not be found."));
    }
    const dateChanged = date !== occurrenceDate;
    if (dateChanged && schedule.deposits_date === "Quincenal") {
      throw new Error(
        'Twice-monthly (quincenal) deposits cannot use a custom date for all instances. Use "this instance only", or change the pay schedule in Settings.',
      );
    }
    const netMonthly =
      schedule.deposits_date === "Quincenal"
        ? numericAmount * 2
        : numericAmount;
    const firstOfMonth = `${occurrenceDate.slice(0, 7)}-01`;
    const initialDate = String(data.salary?.last_deposit || "").slice(0, 10);
    await saveSalaryScheduleChange({
      effectiveDate:
        schedule.deposits_date !== "Quincenal" && firstOfMonth > initialDate
          ? firstOfMonth
          : occurrenceDate,
      amount: solveGrossSalary(netMonthly, data),
      incomeType: "fixed",
      depositsDate: dateChanged ? "Fixed date" : schedule.deposits_date,
      fixedDay: dateChanged ? Number(date.slice(8, 10)) : schedule.fixed_day,
      accountId: accountId ?? schedule.account_id ?? null,
    });
  };

  const save = async scope => {
    if (!canSave) {
      Alert.alert(
        t("Check the details"),
        t("Enter a name, a positive amount, a valid date and valid repeat or projection values."),
      );
      return;
    }
    setIsBusy(true);
    try {
      if (isSalary && scope === "all") {
        await saveSalaryForAllInstances();
      } else {
        const repeats = canRepeat && isRepeat;
        const values = {
          name: name.trim(),
          amount: numericAmount,
          inflatedValue: showInflate && isInflated ? numericInflated : null,
          description,
          date,
          accountId,
          kind,
          tagIds: isTransfer ? [] : await resolveTagIds(),
          recurrenceFrequency: repeats ? repeatFrequency : null,
          recurrenceEndDate: repeats && repeatEndDate ? repeatEndDate : null,
          fromAccountId,
          toAccountId,
          frequency: subscriptionFrequency,
          intervalDays: Number(intervalDays),
        };
        if (isTransfer && !(await checkTransferAffordability(scope, values))) {
          return;
        }
        await saveMovementEdit({
          sourceType,
          sourceId: isSalary ? data.salary.id : target.sourceId,
          scope,
          occurrenceDate,
          values,
        });
      }
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save movement:", error);
      Alert.alert(
        t("Could not save changes"),
        error instanceof Error ? error.message : t("Please try again."),
      );
    } finally {
      setIsBusy(false);
    }
  };

  const runDelete = async scope => {
    setIsBusy(true);
    try {
      await deleteMovement({
        sourceType,
        sourceId: isSalary ? data.salary.id : target.sourceId,
        scope,
        occurrenceDate,
      });
      navigation.goBack();
    } catch (error) {
      console.error("Failed to delete movement:", error);
      Alert.alert(
        t("Could not delete"),
        error instanceof Error ? error.message : t("Please try again."),
      );
    } finally {
      setIsBusy(false);
    }
  };

  const confirmDelete = () => {
    const label = isTransfer ? t("this transfer") : `"${name}"`;
    if (isSalary) {
      Alert.alert(
        t("Delete salary deposit"),
        t("Remove only the deposit on {date}? Your salary schedule keeps generating the other deposits. This cannot be undone.", { date: formatDisplayDate(occurrenceDate) }),
        [
          { text: t("Cancel"), style: "cancel" },
          { text: t("Delete"), style: "destructive", onPress: () => runDelete("instance") },
        ],
      );
      return;
    }
    if (isSeries) {
      Alert.alert(
        t("Delete recurring movement"),
        t("Delete only the {date} occurrence of {label}, or the whole recurring schedule and all its occurrences? This cannot be undone.", { date: formatDisplayDate(occurrenceDate), label }),
        [
          { text: t("Cancel"), style: "cancel" },
          { text: t("This instance only"), onPress: () => runDelete("instance") },
          { text: t("All instances"), style: "destructive", onPress: () => runDelete("all") },
        ],
      );
      return;
    }
    Alert.alert(
      t("Delete movement"),
      t("Permanently delete {label}? This cannot be undone.", { label }),
      [
        { text: t("Cancel"), style: "cancel" },
        { text: t("Delete"), style: "destructive", onPress: () => runDelete("all") },
      ],
    );
  };

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <CustomText type="header2" text={t("Movement not found")} />
          <CustomText
            type="body1"
            text={t("This movement could not be loaded. It may have been changed or deleted.")}
            style={styles.field}
          />
          <CustomButton
            onPress={() => navigation.goBack()}
            style={styles.saveButton}
            text={t("Go back")}
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <CustomText type="body1" text={t("Loading...")} />
        </View>
      </SafeAreaView>
    );
  }

  const inputColors = {
    backgroundColor: getColors("input"),
    borderColor: getColors("border"),
    color: getColors("secondaryText"),
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.content, contentInsetStyle]}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
      >
        <CustomText type="header2" text={t("Edit movement")} />
        <CustomText
          type="body1"
          text={
            isSeries
              ? t("Recurring · opened from the {date} occurrence", { date: formatDisplayDate(occurrenceDate) })
              : t("One-time movement")
          }
          style={styles.subtitle}
        />

        {!isTransfer && (
          <>
            <CustomText type="body3" text={t("Type")} style={styles.field} />
            <View style={styles.choiceRow}>
              {kindChoices.map(choice => (
                <CustomButton
                  key={choice}
                  onPress={() => {
                    setKind(choice);
                    if (choice !== "expense") {
                      setIsInflated(false);
                    }
                  }}
                  style={styles.choice}
                  text={getKindLabels()[choice]}
                  type={kind === choice ? "primary" : "secondary"}
                />
              ))}
            </View>
          </>
        )}

        <Field label={isSeries ? t("Date of this occurrence") : t("Date")}>
          <DatePicker
            placeholder={t("Select date")}
            setValue={setDate}
            value={date}
          />
        </Field>

        {!isTransfer && (
          <Field label={t("Name")}>
            <CustomTextInput
              placeholder={t("What was it?")}
              setValue={setName}
              value={name}
            />
          </Field>
        )}
        <Field
          label={
            isSalary
              ? `${t("Net deposit amount")}${currency ? ` (${currency})` : ""}`
              : t("Amount")
          }
        >
          <CustomTextInput
            keyboardType="decimal-pad"
            placeholder="0.00"
            setValue={setAmount}
            value={amount}
          />
        </Field>

        {showInflate && (
          <>
            <View style={styles.checkRow}>
              <CustomText type="body4" text={t("Inflate planned amount")} />
              <CustomCheckbox
                checked={isInflated}
                label={t("Inflate")}
                onToggle={() => setIsInflated(value => !value)}
              />
            </View>
            {isInflated && (
              <Field label={t("Amount to include in projections")}>
                <CustomTextInput
                  keyboardType="decimal-pad"
                  placeholder={t("Must be at least the actual amount")}
                  setValue={setInflatedAmount}
                  value={inflatedAmount}
                />
              </Field>
            )}
          </>
        )}

        {isSubscription && (
          <>
            <Field label={t("Repeats (applies to all instances)")}>
              <Dropdown
                data={getSubscriptionOptions()}
                labelField="label"
                onChange={item => setSubscriptionFrequency(item.value)}
                placeholder={t("Repeat frequency")}
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                style={dropdownStyles.input}
                value={subscriptionFrequency}
                valueField="value"
              />
            </Field>
            {subscriptionFrequency === "custom" && (
              <Field label={t("Repeat every (days)")}>
                <CustomTextInput
                  keyboardType="number-pad"
                  placeholder="30"
                  setValue={setIntervalDays}
                  value={intervalDays}
                />
              </Field>
            )}
          </>
        )}

        {canRepeat && (
          <>
            <View style={styles.checkRow}>
              <CustomText
                type="body4"
                text={
                  isSeries
                    ? t("Repeats (applies to all instances)")
                    : t("Repeat this movement")
                }
              />
              <CustomCheckbox
                checked={isRepeat}
                label={t("Repeat")}
                onToggle={() => setIsRepeat(value => !value)}
              />
            </View>
            {isRepeat && (
              <>
                <Field label={t("Repeat")}>
                  <Dropdown
                    data={getRepeatOptions()}
                    labelField="label"
                    onChange={item => setRepeatFrequency(item.value)}
                    placeholder={t("Repeat frequency")}
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}
                    style={dropdownStyles.input}
                    value={repeatFrequency}
                    valueField="value"
                  />
                </Field>
                <Field label={t("End date (optional)")}>
                  <DatePicker
                    allowClear
                    placeholder={t("Leave blank to repeat until stopped")}
                    setValue={setRepeatEndDate}
                    value={repeatEndDate}
                  />
                </Field>
                {!repeatEndValid && (
                  <CustomText
                    type="body5"
                    text={t("Enter a valid end date on or after the movement date.")}
                    style={styles.validationMessage}
                  />
                )}
              </>
            )}
          </>
        )}

        <Field label={t("Description (optional)")}>
          <CustomTextInput
            placeholder={t("Extra information")}
            setValue={setDescription}
            value={description}
          />
        </Field>

        {isTransfer ? (
          <>
            <Field label={t("From account")}>
              <Dropdown
                data={accounts}
                labelField="label"
                onChange={item => setFromAccountId(item.value)}
                placeholder={t("Select source account")}
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                style={dropdownStyles.input}
                value={fromAccountId}
                valueField="value"
              />
            </Field>
            <Field label={t("To account")}>
              <Dropdown
                data={accounts}
                labelField="label"
                onChange={item => setToAccountId(item.value)}
                placeholder={t("Select destination account")}
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                style={dropdownStyles.input}
                value={toAccountId}
                valueField="value"
              />
            </Field>
            {!transferValid && (
              <CustomText
                type="body5"
                text={t("Choose two different accounts.")}
                style={styles.validationMessage}
              />
            )}
          </>
        ) : (
          <Field label={t("Account")}>
            <Dropdown
              data={accounts}
              labelField="label"
              onChange={item => setAccountId(item.value)}
              placeholder={t("Select account")}
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={dropdownStyles.input}
              value={accountId}
              valueField="value"
            />
          </Field>
        )}

        {!isTransfer && (
          <Field
            label={t("Tags (optional, separate with commas)")}
            onLayout={recordFieldLayout}
          >
            <TextInput
              autoCapitalize="sentences"
              onChangeText={value => {
                setTagText(value);
                setTagTouched(true);
              }}
              onFocus={revealField}
              placeholder={t("Search or create a tag")}
              placeholderTextColor={getColors("placeholder")}
              style={[styles.tagInput, inputColors]}
              value={tagText}
            />
            {suggestedTags.length > 0 && (
              <View style={styles.tagSuggestions}>
                {suggestedTags.map(tag => (
                  <Pressable
                    accessibilityRole="button"
                    key={tag.id}
                    onPress={() => pickTag(tag)}
                    style={[
                      styles.tagChip,
                      {
                        backgroundColor: getColors("surface"),
                        borderColor: getColors("border"),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.tagDot,
                        { backgroundColor: tag.color || "#4261a0" },
                      ]}
                    />
                    <CustomText
                      type="body5"
                      text={tag.name}
                      style={{ color: getColors("secondaryText") }}
                    />
                  </Pressable>
                ))}
              </View>
            )}
          </Field>
        )}

        {isSalary && (
          <CustomText
            type="body5"
            text={t("For all instances, the net deposit, deposit day and account are applied from this deposit forward. Name, type, description and tags apply to this instance only.")}
            style={styles.note}
          />
        )}
        {isSubscription && (
          <CustomText
            type="body5"
            text={t("A subscription keeps one tag; the first tag listed is used when saving for all instances.")}
            style={styles.note}
          />
        )}

        {isSeries ? (
          <>
            <CustomButton
              disabled={!canSave || isBusy}
              onPress={() => save("instance")}
              style={styles.saveButton}
              text={isBusy ? t("Saving...") : t("Save changes for this instance only")}
            />
            <CustomButton
              disabled={!canSave || isBusy}
              onPress={() => save("all")}
              style={styles.secondButton}
              text={t("Save changes for all instances")}
              type="secondary"
            />
          </>
        ) : (
          <CustomButton
            disabled={!canSave || isBusy}
            onPress={() => save("all")}
            style={styles.saveButton}
            text={isBusy ? t("Saving...") : t("Save changes")}
          />
        )}
        <CustomButton
          disabled={isBusy}
          onPress={confirmDelete}
          style={styles.deleteButton}
          text={t("Delete")}
          type="warning"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  content: {
    paddingTop: 22,
    paddingBottom: 40,
  },
  subtitle: {
    marginTop: 6,
  },
  field: {
    marginTop: 16,
  },
  fieldLabel: {
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  choice: {
    flexGrow: 1,
    minWidth: "45%",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  tagInput: {
    height: 48,
    borderWidth: 2,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  tagSuggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  tagChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 16,
  },
  tagDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  note: {
    marginTop: 14,
  },
  validationMessage: {
    marginTop: 6,
    color: "#B54747",
  },
  saveButton: {
    marginTop: 28,
  },
  secondButton: {
    marginTop: 12,
  },
  deleteButton: {
    marginTop: 24,
  },
});
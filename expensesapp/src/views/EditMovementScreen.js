import React, { useEffect, useMemo, useState } from "react";
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

const KIND_LABELS = {
  expense: "Deduction",
  savings: "Savings",
  income: "Income",
  savings_use: "Savings used",
};

const REPEAT_OPTIONS = [
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" },
];

const SUBSCRIPTION_OPTIONS = [
  { label: "Monthly", value: "monthly" },
  { label: "Annual", value: "annual" },
  { label: "Custom (days)", value: "custom" },
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

function Field({ children, label }) {
  return (
    <View style={styles.field}>
      <CustomText type="body4" text={label} style={styles.fieldLabel} />
      {children}
    </View>
  );
}

export default function EditMovementScreen({ navigation, route }) {
  useTheme();
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
          throw new Error("Missing movement.");
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
          throw new Error("Movement not found.");
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
          setName("Salary");
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
        label: account.name,
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
          "Insufficient funds",
          `${accountName(values.fromAccountId) || "The source account"} would be overdrawn on ${formatDisplayDate(checkDate)} after this change.`,
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
      throw new Error("The fixed salary schedule for this deposit could not be found.");
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
        "Check the details",
        "Enter a name, a positive amount, a valid date and valid repeat or projection values.",
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
        "Could not save changes",
        error instanceof Error ? error.message : "Please try again.",
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
        "Could not delete",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsBusy(false);
    }
  };

  const confirmDelete = () => {
    const label = isTransfer ? "this transfer" : `"${name}"`;
    if (isSalary) {
      Alert.alert(
        "Delete salary deposit",
        `Remove only the deposit on ${formatDisplayDate(occurrenceDate)}? Your salary schedule keeps generating the other deposits. This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: () => runDelete("instance") },
        ],
      );
      return;
    }
    if (isSeries) {
      Alert.alert(
        "Delete recurring movement",
        `Delete only the ${formatDisplayDate(occurrenceDate)} occurrence of ${label}, or the whole recurring schedule and all its occurrences? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "This instance only", onPress: () => runDelete("instance") },
          { text: "All instances", style: "destructive", onPress: () => runDelete("all") },
        ],
      );
      return;
    }
    Alert.alert(
      "Delete movement",
      `Permanently delete ${label}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => runDelete("all") },
      ],
    );
  };

  if (loadFailed) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <CustomText type="header2" text="Movement not found" />
          <CustomText
            type="body1"
            text="This movement could not be loaded. It may have been changed or deleted."
            style={styles.field}
          />
          <CustomButton
            onPress={() => navigation.goBack()}
            style={styles.saveButton}
            text="Go back"
          />
        </View>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <CustomText type="body1" text="Loading..." />
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
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CustomText type="header2" text="Edit movement" />
        <CustomText
          type="body1"
          text={
            isSeries
              ? `Recurring · opened from the ${formatDisplayDate(occurrenceDate)} occurrence`
              : "One-time movement"
          }
          style={styles.subtitle}
        />

        {!isTransfer && (
          <>
            <CustomText type="body3" text="Type" style={styles.field} />
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
                  text={KIND_LABELS[choice]}
                  type={kind === choice ? "primary" : "secondary"}
                />
              ))}
            </View>
          </>
        )}

        <Field label={isSeries ? "Date of this occurrence" : "Date"}>
          <DatePicker
            placeholder="Select date"
            setValue={setDate}
            value={date}
          />
        </Field>

        {!isTransfer && (
          <Field label="Name">
            <CustomTextInput
              placeholder="What was it?"
              setValue={setName}
              value={name}
            />
          </Field>
        )}
        <Field
          label={
            isSalary
              ? `Net deposit amount${currency ? ` (${currency})` : ""}`
              : "Amount"
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
              <CustomText type="body4" text="Inflate planned amount" />
              <CustomCheckbox
                checked={isInflated}
                label="Inflate"
                onToggle={() => setIsInflated(value => !value)}
              />
            </View>
            {isInflated && (
              <Field label="Amount to include in projections">
                <CustomTextInput
                  keyboardType="decimal-pad"
                  placeholder="Must be at least the actual amount"
                  setValue={setInflatedAmount}
                  value={inflatedAmount}
                />
              </Field>
            )}
          </>
        )}

        {isSubscription && (
          <>
            <Field label="Repeats (applies to all instances)">
              <Dropdown
                data={SUBSCRIPTION_OPTIONS}
                labelField="label"
                onChange={item => setSubscriptionFrequency(item.value)}
                placeholder="Repeat frequency"
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                style={dropdownStyles.input}
                value={subscriptionFrequency}
                valueField="value"
              />
            </Field>
            {subscriptionFrequency === "custom" && (
              <Field label="Repeat every (days)">
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
                    ? "Repeats (applies to all instances)"
                    : "Repeat this movement"
                }
              />
              <CustomCheckbox
                checked={isRepeat}
                label="Repeat"
                onToggle={() => setIsRepeat(value => !value)}
              />
            </View>
            {isRepeat && (
              <>
                <Field label="Repeat">
                  <Dropdown
                    data={REPEAT_OPTIONS}
                    labelField="label"
                    onChange={item => setRepeatFrequency(item.value)}
                    placeholder="Repeat frequency"
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}
                    style={dropdownStyles.input}
                    value={repeatFrequency}
                    valueField="value"
                  />
                </Field>
                <Field label="End date (optional)">
                  <DatePicker
                    allowClear
                    placeholder="Leave blank to repeat until stopped"
                    setValue={setRepeatEndDate}
                    value={repeatEndDate}
                  />
                </Field>
                {!repeatEndValid && (
                  <CustomText
                    type="body5"
                    text="Enter a valid end date on or after the movement date."
                    style={styles.validationMessage}
                  />
                )}
              </>
            )}
          </>
        )}

        <Field label="Description (optional)">
          <CustomTextInput
            placeholder="Extra information"
            setValue={setDescription}
            value={description}
          />
        </Field>

        {isTransfer ? (
          <>
            <Field label="From account">
              <Dropdown
                data={accounts}
                labelField="label"
                onChange={item => setFromAccountId(item.value)}
                placeholder="Select source account"
                placeholderStyle={dropdownStyles.placeholderText}
                selectedTextStyle={dropdownStyles.selectedText}
                style={dropdownStyles.input}
                value={fromAccountId}
                valueField="value"
              />
            </Field>
            <Field label="To account">
              <Dropdown
                data={accounts}
                labelField="label"
                onChange={item => setToAccountId(item.value)}
                placeholder="Select destination account"
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
                text="Choose two different accounts."
                style={styles.validationMessage}
              />
            )}
          </>
        ) : (
          <Field label="Account">
            <Dropdown
              data={accounts}
              labelField="label"
              onChange={item => setAccountId(item.value)}
              placeholder="Select account"
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={dropdownStyles.input}
              value={accountId}
              valueField="value"
            />
          </Field>
        )}

        {!isTransfer && (
          <Field label="Tags (optional, separate with commas)">
            <TextInput
              autoCapitalize="sentences"
              onChangeText={value => {
                setTagText(value);
                setTagTouched(true);
              }}
              placeholder="Search or create a tag"
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
            text="For all instances, the net deposit, deposit day and account are applied from this deposit forward. Name, type, description and tags apply to this instance only."
            style={styles.note}
          />
        )}
        {isSubscription && (
          <CustomText
            type="body5"
            text="A subscription keeps one tag; the first tag listed is used when saving for all instances."
            style={styles.note}
          />
        )}

        {isSeries ? (
          <>
            <CustomButton
              disabled={!canSave || isBusy}
              onPress={() => save("instance")}
              style={styles.saveButton}
              text={isBusy ? "Saving..." : "Save changes for this instance only"}
            />
            <CustomButton
              disabled={!canSave || isBusy}
              onPress={() => save("all")}
              style={styles.secondButton}
              text="Save changes for all instances"
              type="secondary"
            />
          </>
        ) : (
          <CustomButton
            disabled={!canSave || isBusy}
            onPress={() => save("all")}
            style={styles.saveButton}
            text={isBusy ? "Saving..." : "Save changes"}
          />
        )}
        <CustomButton
          disabled={isBusy}
          onPress={confirmDelete}
          style={styles.deleteButton}
          text="Delete"
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
import React, { useContext, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../../components/customButton/customButton";
import CustomCheckbox from "../../components/customCheckbox/customCheckbox";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import {
  getLocalDate,
  getSalaryRow,
  getSalaryScheduleChanges,
  isValidLocalDate,
  resetDatabase,
  saveSalaryScheduleChange,
  updateSalarySavingsMode,
} from "../../utils/database_connector";
import { Context } from "../../utils/store";

const payDateOptions = [
  { label: "Every 15 days", value: "Quincenal" },
  { label: "Last day of month", value: "Last day of month" },
  { label: "Pre-last day of month", value: "Pre last day of month" },
  { label: "Specific day of month", value: "Fixed date" },
];

const payDayOptions = Array.from({ length: 31 }, (_, index) => ({
  label: String(index + 1),
  value: index + 1,
}));

export default function SettingsScreen({ navigation }) {
  const { clear, pullFromDB, salaryStore } = useContext(Context);
  const [isResetting, setIsResetting] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [isSavingSalary, setIsSavingSalary] = useState(false);
  const [incomeType, setIncomeType] = useState("fixed");
  const [payDate, setPayDate] = useState("Pre last day of month");
  const [payDay, setPayDay] = useState(15);
  const [effectiveMode, setEffectiveMode] = useState("immediate");
  const [effectiveDate, setEffectiveDate] = useState(getLocalDate());
  const [savingsModeEnabled, setSavingsModeEnabled] = useState(false);
  const [savingsModeAmount, setSavingsModeAmount] = useState("0");
  const [isSavingSavingsMode, setIsSavingSavingsMode] = useState(false);

  useEffect(() => {
    let isMounted = true;
    Promise.all([getSalaryRow(), getSalaryScheduleChanges()])
      .then(([salary, changes]) => {
        if (!salary) {
          return;
        }
        const today = getLocalDate();
        const currentChange = [...changes]
          .filter(change => change.effective_date <= today)
          .sort((left, right) =>
            right.effective_date.localeCompare(left.effective_date),
          )[0];
        const activeSchedule = currentChange || {
          amount: salary.amount,
          income_type: salary.fixed ? "fixed" : "variable",
          deposits_date: salary.deposits_date,
          fixed_day: salary.fixed_day,
        };
        if (isMounted && salary?.amount !== null && salary?.amount !== undefined) {
          setSalaryAmount(
            activeSchedule.amount === null ||
              activeSchedule.amount === undefined
              ? ""
              : String(activeSchedule.amount),
          );
        }
        if (isMounted && salary) {
          setSavingsModeEnabled(Boolean(salary.savings_mode_enabled));
          setSavingsModeAmount(String(salary.savings_mode_amount ?? 0));
          setIncomeType(activeSchedule.income_type);
          setPayDate(activeSchedule.deposits_date || "Pre last day of month");
          setPayDay(activeSchedule.fixed_day || 15);
        }
      })
      .catch(error => {
        console.error("Failed to load salary settings:", error);
        Alert.alert("Could not load salary settings", "Please try again.");
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const saveSalaryAmount = async () => {
    const selectedDate =
      effectiveMode === "immediate" ? getLocalDate() : effectiveDate;
    if (
      (incomeType === "fixed" &&
        (!salaryAmount.trim() ||
          !Number.isFinite(Number(salaryAmount)) ||
          Number(salaryAmount) <= 0)) ||
      (effectiveMode === "specific" &&
        (!isValidLocalDate(selectedDate) || selectedDate < getLocalDate()))
    ) {
      console.warn("[Settings warning] Invalid salary schedule change.", {
        salaryAmount,
        incomeType,
        effectiveMode,
        effectiveDate: selectedDate,
      });
      Alert.alert(
        "Check salary change",
        "Enter a valid salary and a valid effective date that is today or later.",
      );
      return;
    }
    setIsSavingSalary(true);
    try {
      await saveSalaryScheduleChange({
        effectiveDate: selectedDate,
        amount: incomeType === "fixed" ? Number(salaryAmount) : null,
        incomeType,
        depositsDate: incomeType === "fixed" ? payDate : null,
        fixedDay: incomeType === "fixed" ? payDay : null,
      });
      await pullFromDB();
      Alert.alert(
        "Salary schedule saved",
        `This change will apply ${effectiveMode === "immediate" ? "immediately" : `from ${selectedDate}`}.`,
      );
    } catch (error) {
      console.error("Failed to update salary:", error);
      Alert.alert(
        "Could not update salary",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSavingSalary(false);
    }
  };

  const saveSavingsMode = async () => {
    if (
      !savingsModeAmount.trim() ||
      !Number.isFinite(Number(savingsModeAmount)) ||
      Number(savingsModeAmount) < 0
    ) {
      console.warn("[Settings warning] Invalid Savings mode amount.", {
        savingsModeAmount,
      });
      Alert.alert(
        "Check savings amount",
        "Enter a monthly amount of zero or more.",
      );
      return;
    }
    setIsSavingSavingsMode(true);
    try {
      await updateSalarySavingsMode(
        savingsModeEnabled,
        Number(savingsModeAmount),
      );
      await pullFromDB();
      Alert.alert(
        "Savings mode updated",
        savingsModeEnabled
          ? "Future projected salary deposits will be reduced by this monthly amount."
          : "Savings mode is off. Future projected salary deposits will use the full net salary.",
      );
    } catch (error) {
      console.error("Failed to update Savings mode:", error);
      Alert.alert(
        "Could not update Savings mode",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSavingSavingsMode(false);
    }
  };

  const confirmFactoryReset = () => {
    Alert.alert(
      "Reset app",
      "This permanently deletes your settings, accounts, expenses, and other saved data. You will need to set up the app again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset app",
          style: "destructive",
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetDatabase();
              clear();
            } catch (error) {
              console.error("Factory reset failed:", error);
              Alert.alert(
                "Reset failed",
                error instanceof Error
                  ? error.message
                  : "The app data could not be reset.",
              );
            } finally {
              setIsResetting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Settings" />
        <CustomText
          type="body3"
          text="Manage your app configuration and saved data."
          style={styles.description}
        />
        {salaryStore.profileExists ? (
          <View style={styles.section}>
            <CustomText type="header3" text="Income and pay schedule" />
            <CustomText
              type="body1"
              text="Change your salary, deposit schedule, or employment status. Fixed salary deposits are projected automatically; variable income must be recorded manually."
              style={styles.resetDescription}
            />
            <Dropdown
              data={[
                { label: "Fixed salary", value: "fixed" },
                { label: "Variable income", value: "variable" },
                { label: "Unemployed (no future salary)", value: "unemployed" },
              ]}
              labelField="label"
              onChange={item => setIncomeType(item.value)}
              placeholder="Income status"
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={styles.input}
              value={incomeType}
              valueField="value"
            />
            {incomeType === "fixed" ? (
              <>
                <CustomText
                  type="body3"
                  text={`Gross monthly salary (${salaryStore.currency || "CRC"})`}
                  style={styles.inputLabel}
                />
                <CustomTextInput
                  keyboardType="decimal-pad"
                  placeholder="Monthly gross salary"
                  setValue={setSalaryAmount}
                  value={salaryAmount}
                />
                <CustomText
                  type="body3"
                  text="Salary deposit schedule"
                  style={styles.inputLabel}
                />
                <Dropdown
                  data={payDateOptions}
                  labelField="label"
                  onChange={item => setPayDate(item.value)}
                  placeholder="Pay schedule"
                  placeholderStyle={dropdownStyles.placeholderText}
                  selectedTextStyle={dropdownStyles.selectedText}
                  style={styles.input}
                  value={payDate}
                  valueField="value"
                />
                {payDate === "Fixed date" ? (
                  <Dropdown
                    data={payDayOptions}
                    labelField="label"
                    onChange={item => setPayDay(item.value)}
                    placeholder="Day of month"
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}
                    style={styles.input}
                    value={payDay}
                    valueField="value"
                  />
                ) : null}
              </>
            ) : (
              <CustomText
                type="body1"
                text={
                  incomeType === "unemployed"
                    ? "No future salary deposits will be projected until you set an income schedule again."
                    : "No automatic salary deposits will be projected. Record received income under Money variations."
                }
                style={styles.resetDescription}
              />
            )}
            <CustomText
              type="body3"
              text="When should this change apply?"
              style={styles.inputLabel}
            />
            <Dropdown
              data={[
                { label: "Immediately", value: "immediate" },
                { label: "From a specific date", value: "specific" },
              ]}
              labelField="label"
              onChange={item => setEffectiveMode(item.value)}
              placeholder="Effective date"
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={styles.input}
              value={effectiveMode}
              valueField="value"
            />
            {effectiveMode === "specific" ? (
              <CustomTextInput
                autoCapitalize="none"
                placeholder="Effective date (YYYY-MM-DD)"
                setValue={setEffectiveDate}
                value={effectiveDate}
              />
            ) : null}
            <CustomButton
              disabled={isSavingSalary}
              onPress={saveSalaryAmount}
              style={styles.salaryButton}
              text={isSavingSalary ? "Saving..." : "Save income schedule"}
              type="secondary"
            />
          </View>
        ) : null}
        {salaryStore.profileExists && incomeType === "fixed" ? (
          <View style={styles.section}>
            <CustomText type="header3" text="Savings mode" />
            <CustomText
              type="body1"
              text="Reduce projected salary income to make your available balance appear lower. The withheld amount is monthly and does not create a separate account or transaction."
              style={styles.resetDescription}
            />
            <CustomCheckbox
              checked={savingsModeEnabled}
              label="Savings mode"
              onToggle={() =>
                setSavingsModeEnabled(enabled => !enabled)
              }
            />
            <CustomText
              type="body3"
              text="Amount to remove from salary:"
              style={styles.savingsModeLabel}
            />
            <CustomTextInput
              keyboardType="decimal-pad"
              placeholder="Monthly amount"
              setValue={setSavingsModeAmount}
              value={savingsModeAmount}
            />
            <CustomButton
              disabled={isSavingSavingsMode}
              onPress={saveSavingsMode}
              style={styles.salaryButton}
              text={isSavingSavingsMode ? "Saving..." : "Save Savings mode"}
              type="secondary"
            />
          </View>
        ) : null}
        <View style={styles.section}>
          <CustomText type="header3" text="Income deductions" />
          <CustomText
            type="body1"
            text="Review your Hacienda brackets and other configured salary deductions."
            style={styles.resetDescription}
          />
          <CustomButton
            onPress={() => navigation.navigate("Taxes config")}
            text="Configure deductions"
            type="secondary"
          />
        </View>
        <View style={styles.resetSection}>
          <CustomText type="header3" text="Factory reset" />
          <CustomText
            type="body1"
            text="Delete all saved data and return to first-time setup."
            style={styles.resetDescription}
          />
          <CustomButton
            disabled={isResetting}
            onPress={confirmFactoryReset}
            style={styles.resetButton}
            text={isResetting ? "Resetting..." : "Reset app"}
            type="warning"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    marginHorizontal: 16,
    paddingTop: 20,
  },
  description: {
    marginTop: 12,
  },
  section: {
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  resetSection: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  resetDescription: {
    marginTop: 8,
    marginBottom: 16,
  },
  salaryButton: {
    alignSelf: "flex-start",
    marginTop: 12,
  },
  input: {
    ...dropdownStyles.input,
    marginTop: 10,
  },
  inputLabel: {
    marginTop: 14,
    marginBottom: 6,
  },
  savingsModeLabel: {
    marginTop: 14,
    marginBottom: 8,
  },
  resetButton: {
    alignSelf: "flex-start",
  },
});

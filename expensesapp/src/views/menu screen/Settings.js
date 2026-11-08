import React, { useContext, useEffect, useState } from "react";
import { accountLabel, t, useLanguage } from "../../i18n/i18n";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  saveDocuments,
  types,
} from "@react-native-documents/picker";
import Dropdown from "../../components/customDropdown/CustomDropdown";
import { SafeAreaView } from "react-native-safe-area-context";
import { Dirs, FileSystem } from "react-native-file-access";

import CustomButton from "../../components/customButton/customButton";
import CustomCheckbox from "../../components/customCheckbox/customCheckbox";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import DatePicker from "../../components/datePicker/DatePicker";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import {
  getLocalDate,
  exportDatabaseBackup,
  getAccountsCreated,
  getSalaryRow,
  getSalaryScheduleChanges,
  isValidLocalDate,
  resetDatabase,
  replaceDatabaseFromBackup,
  saveSalaryScheduleChange,
  updateSalarySavingsMode,
  updateLanguage,
  updateThemeMode,
} from "../../utils/database_connector";
import { formatDisplayDate } from "../../utils/dateFormatting";
import { Context } from "../../utils/store";
import LanguagePicker from "../../components/languagePicker/LanguagePicker";

const getPayDateOptions = () => [
  { label: t("Every 15 days"), value: "Quincenal" },
  { label: t("Last day of month"), value: "Last day of month" },
  { label: t("Pre-last day of month"), value: "Pre last day of month" },
  { label: t("Specific day of month"), value: "Fixed date" },
];

const payDayOptions = Array.from({ length: 31 }, (_, index) => ({
  label: String(index + 1),
  value: index + 1,
}));

export default function SettingsScreen({ navigation }) {
  useLanguage();
  const { clear, languageStore, pullFromDB, salaryStore, themeStore } =
    useContext(Context);
  const [isResetting, setIsResetting] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryAccounts, setSalaryAccounts] = useState([]);
  const [salaryAccountId, setSalaryAccountId] = useState(null);
  const [isSavingSalary, setIsSavingSalary] = useState(false);
  const [incomeType, setIncomeType] = useState("fixed");
  const [payDate, setPayDate] = useState("Pre last day of month");
  const [payDay, setPayDay] = useState(15);
  const [effectiveMode, setEffectiveMode] = useState("immediate");
  const [effectiveDate, setEffectiveDate] = useState(getLocalDate());
  const [savingsModeEnabled, setSavingsModeEnabled] = useState(false);
  const [savingsModeAmount, setSavingsModeAmount] = useState("0");
  const [isSavingSavingsMode, setIsSavingSavingsMode] = useState(false);
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState(themeStore.mode);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);
  const [isSavingLanguage, setIsSavingLanguage] = useState(false);

  const saveLanguage = async language => {
    setIsSavingLanguage(true);
    try {
      await updateLanguage(language);
      languageStore.setLanguage(language);
    } catch (languageError) {
      console.error("Failed to update language:", languageError);
      Alert.alert(
        t("Could not update language"),
        languageError instanceof Error
          ? languageError.message
          : t("Please try again."),
      );
    } finally {
      setIsSavingLanguage(false);
    }
  };

  const saveAppearanceMode = async mode => {
    setIsSavingAppearance(true);
    try {
      await updateThemeMode(mode);
      themeStore.setMode(mode);
      setAppearanceMode(mode);
    } catch (appearanceError) {
      console.error("Failed to update appearance:", appearanceError);
      Alert.alert(
        t("Could not update appearance"),
        appearanceError instanceof Error
          ? appearanceError.message
          : t("Please try again."),
      );
    } finally {
      setIsSavingAppearance(false);
    }
  };

  const setFollowDevice = followDevice => {
    if (followDevice) {
      saveAppearanceMode("system");
      return;
    }
    saveAppearanceMode(themeStore.systemIsDark ? "dark" : "light");
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      getSalaryRow(),
      getSalaryScheduleChanges(),
      getAccountsCreated(),
    ])
      .then(([salary, changes, accounts]) => {
        if (isMounted) {
          setSalaryAccounts(accounts);
        }
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
          account_id: salary.account_id,
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
          setSalaryAccountId(
            activeSchedule.account_id ?? salary.account_id ?? accounts[0]?.id ?? null,
          );
        }
      })
      .catch(error => {
        console.error("Failed to load salary settings:", error);
        Alert.alert(t("Could not load salary settings"), t("Please try again."));
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
        t("Check salary change"),
        t("Enter a valid salary and a valid effective date that is today or later."),
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
        accountId: salaryAccountId,
      });
      await pullFromDB();
      Alert.alert(
        t("Salary schedule saved"),
        effectiveMode === "immediate"
          ? t("This change will apply immediately.")
          : t("This change will apply from {date}.", {
              date: formatDisplayDate(selectedDate),
            }),
      );
    } catch (error) {
      console.error("Failed to update salary:", error);
      Alert.alert(
        t("Could not update salary"),
        error instanceof Error ? error.message : t("Please try again."),
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
        t("Check savings amount"),
        t("Enter a monthly amount of zero or more."),
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
        t("Savings mode updated"),
        savingsModeEnabled
          ? t("Future projected salary deposits will be reduced by this monthly amount.")
          : t("Savings mode is off. Future projected salary deposits will use the full net salary."),
      );
    } catch (error) {
      console.error("Failed to update Savings mode:", error);
      Alert.alert(
        t("Could not update Savings mode"),
        error instanceof Error ? error.message : t("Please try again."),
      );
    } finally {
      setIsSavingSavingsMode(false);
    }
  };

  const confirmFactoryReset = () => {
    Alert.alert(
      t("Reset app"),
      t("This permanently deletes your settings, accounts, expenses, and other saved data. You will need to set up the app again."),
      [
        { text: t("Cancel"), style: "cancel" },
        {
          text: t("Reset app"),
          style: "destructive",
          onPress: async () => {
            setIsResetting(true);
            try {
              await resetDatabase();
              clear();
            } catch (error) {
              console.error("Factory reset failed:", error);
              Alert.alert(
                t("Reset failed"),
                error instanceof Error
                  ? error.message
                  : t("The app data could not be reset."),
              );
            } finally {
              setIsResetting(false);
            }
          },
        },
      ],
    );
  };

  const exportBackup = async () => {
    setIsExportingBackup(true);
    const sourcePath = `${Dirs.CacheDir}/expense-planner-backup.json`;
    try {
      const backup = await exportDatabaseBackup();
      await FileSystem.writeFile(
        sourcePath,
        JSON.stringify(backup, null, 2),
        "utf8",
      );
      const [savedDocument] = await saveDocuments({
        sourceUris: [encodeURI(`file://${sourcePath}`)],
        mimeType: "application/json",
        fileName: "expense-planner-backup.json",
        copy: true,
      });
      if (!savedDocument || savedDocument.error) {
        throw new Error(
          savedDocument?.error || t("The backup file could not be saved."),
        );
      }
      Alert.alert(
        t("Backup saved"),
        t("Your database backup was saved as {name}.", {
          name: savedDocument.name || "expense-planner-backup.json",
        }),
      );
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        return;
      }
      console.error("Database backup export failed:", error);
      Alert.alert(
        t("Export failed"),
        error instanceof Error
          ? error.message
          : t("The database backup could not be exported."),
      );
    } finally {
      setIsExportingBackup(false);
    }
  };

  const importBackup = async () => {
    setIsImportingBackup(true);
    try {
      const [document] = await pick({ type: [types.json] });
      if (!document || !document.hasRequestedType) {
        throw new Error(t("Select a JSON database backup file."));
      }
      const [localCopy] = await keepLocalCopy({
        files: [
          {
            uri: document.uri,
            fileName: "expense-planner-import.json",
          },
        ],
        destination: "cachesDirectory",
      });
      if (!localCopy || localCopy.status !== "success") {
        throw new Error(
          localCopy?.copyError || t("The selected backup file could not be read."),
        );
      }
      const localPath = decodeURIComponent(
        localCopy.localUri.replace(/^file:\/\//, ""),
      );
      const backupContent = await FileSystem.readFile(localPath, "utf8");
      const shouldReplace = await new Promise(resolve => {
        Alert.alert(
          t("Replace all app data?"),
          t("Importing this backup will replace all accounts, settings, transactions, subscriptions, and savings data currently stored on this phone."),
          [
            {
              text: t("Cancel"),
              style: "cancel",
              onPress: () => resolve(false),
            },
            {
              text: t("Replace data"),
              style: "destructive",
              onPress: () => resolve(true),
            },
          ],
          { cancelable: true, onDismiss: () => resolve(false) },
        );
      });
      if (!shouldReplace) {
        return;
      }
      await replaceDatabaseFromBackup(backupContent);
      clear();
      await pullFromDB();
      Alert.alert(
        t("Backup restored"),
        t("The app's saved data has been replaced with the backup."),
      );
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        return;
      }
      console.error("Database backup import failed:", error);
      Alert.alert(
        t("Import failed"),
        error instanceof Error
          ? error.message
          : t("The selected backup could not be imported."),
      );
    } finally {
      setIsImportingBackup(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text={t("Settings")} />
        <CustomText
          type="body3"
          text={t("Manage your app configuration and saved data.")}
          style={styles.description}
        />
        <View style={styles.section}>
          <CustomText type="header3" text={t("Appearance")} />
          <CustomText
            type="body1"
            text={t("Follow your phone's appearance by default, or choose a theme for the app.")}
            style={styles.resetDescription}
          />
          <CustomCheckbox
            checked={appearanceMode === "system"}
            containerStyles={styles.appearanceToggle}
            label={t("Use device appearance")}
            onToggle={() =>
              setFollowDevice(appearanceMode !== "system")
            }
          />
          <CustomCheckbox
            checked={
              appearanceMode === "dark" ||
              (appearanceMode === "system" && themeStore.systemIsDark)
            }
            containerStyles={styles.appearanceToggle}
            label={t("Dark mode")}
            onToggle={() =>
              saveAppearanceMode(
                appearanceMode === "dark" ||
                  (appearanceMode === "system" && themeStore.systemIsDark)
                  ? "light"
                  : "dark",
              )
            }
          />
          {isSavingAppearance ? (
            <CustomText type="body5" text={t("Saving appearance...")} />
          ) : null}
        </View>
        <View style={styles.section}>
          <CustomText type="header3" text={t("Language")} />
          <CustomText
            type="body1"
            text={t("Choose the language used throughout the app.")}
            style={styles.resetDescription}
          />
          <LanguagePicker
            disabled={isSavingLanguage}
            onChange={saveLanguage}
            value={languageStore.language}
          />
        </View>
        {salaryStore.profileExists ? (
          <View style={styles.section}>
            <CustomText type="header3" text={t("Income and pay schedule")} />
            <CustomText
              type="body1"
              text={t("Change your salary, deposit schedule, or employment status. Fixed salary deposits are projected automatically; variable income must be recorded manually.")}
              style={styles.resetDescription}
            />
            <Dropdown
              data={[
                { label: t("Fixed salary"), value: "fixed" },
                { label: t("Variable income"), value: "variable" },
                { label: t("Unemployed (no future salary)"), value: "unemployed" },
              ]}
              labelField="label"
              onChange={item => setIncomeType(item.value)}
              placeholder={t("Income status")}
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
                  text={t("Gross monthly salary ({currency})", { currency: salaryStore.currency || "CRC" })}
                  style={styles.inputLabel}
                />
                <CustomTextInput
                  keyboardType="decimal-pad"
                  placeholder={t("Monthly gross salary")}
                  setValue={setSalaryAmount}
                  value={salaryAmount}
                />
                <CustomText
                  type="body3"
                  text={t("Salary deposit schedule")}
                  style={styles.inputLabel}
                />
                <Dropdown
                  data={getPayDateOptions()}
                  labelField="label"
                  onChange={item => setPayDate(item.value)}
                  placeholder={t("Pay schedule")}
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
                    placeholder={t("Day of month")}
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
                    ? t("No future salary deposits will be projected until you set an income schedule again.")
                    : t("No automatic salary deposits will be projected. Record received income under Money variations.")
                }
                style={styles.resetDescription}
              />
            )}
            <CustomText
              type="body3"
              text={t("Salary deposit account")}
              style={styles.inputLabel}
            />
            <Dropdown
              data={salaryAccounts.map(account => ({
                label: accountLabel(account.name),
                value: account.id,
              }))}
              labelField="label"
              onChange={item => setSalaryAccountId(item.value)}
              placeholder={t("Select account")}
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={styles.input}
              value={salaryAccountId}
              valueField="value"
            />
            <CustomText
              type="body3"
              text={t("When should this change apply?")}
              style={styles.inputLabel}
            />
            <Dropdown
              data={[
                { label: t("Immediately"), value: "immediate" },
                { label: t("From a specific date"), value: "specific" },
              ]}
              labelField="label"
              onChange={item => setEffectiveMode(item.value)}
              placeholder={t("Effective date")}
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={styles.input}
              value={effectiveMode}
              valueField="value"
            />
            {effectiveMode === "specific" ? (
              <DatePicker
                placeholder={t("Effective date")}
                setValue={setEffectiveDate}
                value={effectiveDate}
              />
            ) : null}
            <CustomButton
              disabled={isSavingSalary}
              onPress={saveSalaryAmount}
              style={styles.salaryButton}
              text={isSavingSalary ? t("Saving...") : t("Save income schedule")}
              type="secondary"
            />
          </View>
        ) : null}
        {salaryStore.profileExists && incomeType === "fixed" ? (
          <View style={styles.section}>
            <CustomText type="header3" text={t("Savings mode")} />
            <CustomText
              type="body1"
              text={t("Reduce projected salary income to make your available balance appear lower. The withheld amount is monthly and does not create a separate account or transaction.")}
              style={styles.resetDescription}
            />
            <CustomCheckbox
              checked={savingsModeEnabled}
              label={t("Savings mode")}
              onToggle={() =>
                setSavingsModeEnabled(enabled => !enabled)
              }
            />
            <CustomText
              type="body3"
              text={t("Amount to remove from salary:")}
              style={styles.savingsModeLabel}
            />
            <CustomTextInput
              keyboardType="decimal-pad"
              placeholder={t("Monthly amount")}
              setValue={setSavingsModeAmount}
              value={savingsModeAmount}
            />
            <CustomButton
              disabled={isSavingSavingsMode}
              onPress={saveSavingsMode}
              style={styles.salaryButton}
              text={isSavingSavingsMode ? t("Saving...") : t("Save Savings mode")}
              type="secondary"
            />
          </View>
        ) : null}
        <View style={styles.section}>
          <CustomText type="header3" text={t("Income deductions")} />
          <CustomText
            type="body1"
            text={t("Review your Hacienda brackets and other configured salary deductions.")}
            style={styles.resetDescription}
          />
          <CustomButton
            onPress={() => navigation.navigate("Taxes config")}
            text={t("Configure deductions")}
            type="secondary"
          />
        </View>
        <View style={styles.section}>
          <CustomText type="header3" text={t("Database backup")} />
          <CustomText
            type="body1"
            text={t("Export a JSON backup to your phone, or restore app data from a previously exported backup.")}
            style={styles.resetDescription}
          />
          <View style={styles.backupButtons}>
            <CustomButton
              disabled={isExportingBackup || isImportingBackup}
              onPress={exportBackup}
              style={styles.backupButton}
              text={isExportingBackup ? t("Exporting...") : t("Export database")}
              type="secondary"
            />
            <CustomButton
              disabled={isExportingBackup || isImportingBackup}
              onPress={importBackup}
              style={styles.backupButton}
              text={isImportingBackup ? t("Importing...") : t("Import database")}
              type="secondary"
            />
          </View>
        </View>
        <View style={styles.resetSection}>
          <CustomText type="header3" text={t("Factory reset")} />
          <CustomText
            type="body1"
            text={t("Delete all saved data and return to first-time setup.")}
            style={styles.resetDescription}
          />
          <CustomButton
            disabled={isResetting}
            onPress={confirmFactoryReset}
            style={styles.resetButton}
            text={isResetting ? t("Resetting...") : t("Reset app")}
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
  appearanceToggle: {
    marginTop: 14,
  },
  resetButton: {
    alignSelf: "flex-start",
  },
  backupButtons: {
    gap: 10,
  },
  backupButton: {
    alignSelf: "flex-start",
  },
});

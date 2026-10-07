import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Dropdown from "../components/customDropdown/CustomDropdown";

import CustomButton from "../components/customButton/customButton";
import CustomCheckbox from "../components/customCheckbox/customCheckbox";
import CustomText from "../components/customText/customText";
import CustomTextInput from "../components/customTextInput/customTextInput";
import { dropdownStyles } from "../components/customDropdown/dropdownStylesCustom";
import { addSalary } from "../utils/database_connector";

const payDateOptions = [
  { label: "Every 15 days", value: "Quincenal" },
  { label: "Last day of month", value: "Last day of month" },
  { label: "Pre-last available day of month", value: "Pre last day of month" },
  { label: "Specific day of month", value: "Fixed date" },
];

const payDayOptions = Array.from({ length: 31 }, (_, index) => ({
  label: String(index + 1),
  value: index + 1,
}));

const isValidAmount = value =>
  value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0;

const WelcomeScreen = ({ navigation }) => {
  const [startingBalance, setStartingBalance] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [fixedSalary, setFixedSalary] = useState(true);
  const [payDate, setPayDate] = useState(null);
  const [currency, setCurrency] = useState("CRC");
  const [salaryAccountChoice, setSalaryAccountChoice] = useState("main");
  const [newSalaryAccountName, setNewSalaryAccountName] = useState("");
  const [payDay, setPayDay] = useState(15);
  const [isSaving, setIsSaving] = useState(false);

  const canContinue =
    isValidAmount(startingBalance) &&
    currency.trim().length > 0 &&
    (salaryAccountChoice !== "other" || newSalaryAccountName.trim().length > 0) &&
    (!fixedSalary ||
      (isValidAmount(salaryAmount) &&
        Number(salaryAmount) > 0 &&
        payDate !== null &&
        (payDate !== "Fixed date" || payDay !== null)));

  const saveSetup = async () => {
    setIsSaving(true);
    try {
      await addSalary({
        amount: fixedSalary ? Number(salaryAmount) : null,
        balance: Number(startingBalance),
        currency: currency.trim(),
        fixed: fixedSalary,
        deposits_date: fixedSalary ? payDate : null,
        fixed_day: fixedSalary && payDate === "Fixed date" ? payDay : null,
        salaryAccountName:
          salaryAccountChoice === "other"
            ? newSalaryAccountName.trim()
            : "Main account",
      });
      navigation.navigate("Taxes config");
    } catch (error) {
      console.error("Failed to save setup:", error);
      Alert.alert(
        "Could not save setup",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CustomText type="header2" text="Welcome!" />
        <CustomText
          type="header3"
          text="Set up your cash-flow planner"
          style={styles.subtitle}
        />

        <CustomText
          type="body3"
          text="Starting balance"
          style={styles.fieldLabel}
        />
        <CustomTextInput
          keyboardType="decimal-pad"
          placeholder="Money currently available"
          setValue={setStartingBalance}
          value={startingBalance}
        />

        <CustomText
          type="body3"
          text="Income type"
          style={styles.fieldLabel}
        />
        <View style={styles.choiceRow}>
          <CustomCheckbox
            checked={fixedSalary}
            containerStyles={styles.choice}
            label="Fixed"
            onToggle={() => setFixedSalary(true)}
          />
          <CustomCheckbox
            checked={!fixedSalary}
            containerStyles={styles.choice}
            label="Variable"
            onToggle={() => setFixedSalary(false)}
          />
        </View>

        {fixedSalary ? (
          <View>
            <CustomText
              type="body3"
              text="Gross monthly salary"
              style={styles.fieldLabel}
            />
            <CustomTextInput
              keyboardType="decimal-pad"
              placeholder="Salary before deductions"
              setValue={setSalaryAmount}
              value={salaryAmount}
            />
            <CustomText
              type="body3"
              text="Pay schedule"
              style={styles.fieldLabel}
            />
            <Dropdown
              data={payDateOptions}
              labelField="label"
              maxHeight={240}
              onChange={item => setPayDate(item.value)}
              placeholder="Select pay schedule"
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={dropdownStyles.input}
              value={payDate}
              valueField="value"
            />
            {payDate === "Fixed date" && (
              <>
                <CustomText
                  type="body3"
                  text="Day of the month"
                  style={styles.fieldLabel}
                />
                <Dropdown
                  data={payDayOptions}
                  labelField="label"
                  maxHeight={240}
                  onChange={item => setPayDay(item.value)}
                  placeholder="Select a day"
                  placeholderStyle={dropdownStyles.placeholderText}
                  selectedTextStyle={dropdownStyles.selectedText}
                  style={dropdownStyles.input}
                  value={payDay}
                  valueField="value"
                />
              </>
            )}
          </View>
        ) : (
          <CustomText
            type="body1"
            text="Record each payment when you receive it. Variable income is not assumed in future projections."
            style={styles.hint}
          />
        )}

        <CustomText
          type="body3"
          text="Salary deposit account"
          style={styles.fieldLabel}
        />
        <Dropdown
          data={[
            { label: "Main account", value: "main" },
            { label: "Create another account", value: "other" },
          ]}
          labelField="label"
          onChange={item => setSalaryAccountChoice(item.value)}
          placeholder="Choose an account"
          placeholderStyle={dropdownStyles.placeholderText}
          selectedTextStyle={dropdownStyles.selectedText}
          style={dropdownStyles.input}
          value={salaryAccountChoice}
          valueField="value"
        />
        {salaryAccountChoice === "other" ? (
          <CustomTextInput
            placeholder="New salary account name"
            setValue={setNewSalaryAccountName}
            style={styles.fieldLabel}
            value={newSalaryAccountName}
          />
        ) : null}

        <CustomText
          type="body3"
          text="Currency"
          style={styles.fieldLabel}
        />
        <CustomTextInput
          autoCapitalize="characters"
          placeholder="CRC, USD, etc."
          setValue={setCurrency}
          value={currency}
        />

        <CustomButton
          disabled={!canContinue || isSaving}
          onPress={saveSetup}
          style={styles.continueButton}
          text={isSaving ? "Saving..." : "Continue to deductions"}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  subtitle: {
    marginBottom: 24,
  },
  fieldLabel: {
    marginTop: 16,
    marginBottom: 8,
  },
  choiceRow: {
    flexDirection: "row",
    marginVertical: 12,
  },
  choice: {
    width: "50%",
  },
  hint: {
    marginTop: 16,
  },
  continueButton: {
    marginTop: 32,
  },
});

export default WelcomeScreen;

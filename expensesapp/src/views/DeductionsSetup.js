import React, { useContext, useEffect, useState } from "react";
import { t, useLanguage } from "../i18n/i18n";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CommonActions } from "@react-navigation/native";

import CustomButton from "../components/customButton/customButton";
import CustomText from "../components/customText/customText";
import CustomTextInput from "../components/customTextInput/customTextInput";
import {
  getCashflowData,
  saveDeductionConfiguration,
} from "../utils/database_connector";
import { Context } from "../utils/store";

const initialSalaryRanges = [
  { range: "918000-1347000", percentage: "10" },
  { range: "1347000-2364000", percentage: "15" },
  { range: "2364000-4727000", percentage: "20" },
  { range: "4727000", percentage: "25" },
];

const initialOtherTaxes = [{ name: "CCSS", percentage: "10" }];

const parseSalaryRanges = ranges => {
  const parsed = ranges.map(({ range, percentage }) => {
    if (!range.trim() || percentage.trim() === "") {
      throw new Error(t("Complete every salary range and percentage."));
    }
    const [minimumText, maximumText] = range.split("-");
    const min_salary = Number(minimumText);
    const max_salary =
      maximumText === undefined || maximumText === ""
        ? null
        : Number(maximumText);
    const parsedPercentage = Number(percentage);
    if (
      !Number.isFinite(min_salary) ||
      (max_salary !== null &&
        (!Number.isFinite(max_salary) || max_salary <= min_salary)) ||
      !Number.isFinite(parsedPercentage) ||
      parsedPercentage < 0 ||
      parsedPercentage > 100
    ) {
      throw new Error(t("Enter valid salary ranges and percentages (0-100)."));
    }
    return { min_salary, max_salary, percentage: parsedPercentage };
  });
  parsed.sort((left, right) => left.min_salary - right.min_salary);
  for (let index = 1; index < parsed.length; index += 1) {
    const previous = parsed[index - 1];
    if (
      previous.max_salary === null ||
      parsed[index].min_salary < previous.max_salary
    ) {
      throw new Error(t("Salary deduction ranges cannot overlap."));
    }
  }
  return parsed;
};

const parseOtherTaxes = taxes =>
  taxes.map(({ name, percentage }) => {
    if (percentage.trim() === "") {
      throw new Error(t("Complete every deduction percentage."));
    }
    const parsedPercentage = Number(percentage);
    if (
      !name.trim() ||
      !Number.isFinite(parsedPercentage) ||
      parsedPercentage < 0 ||
      parsedPercentage > 100
    ) {
      throw new Error(t("Enter a tax name and a percentage between 0 and 100."));
    }
    return { name: name.trim(), percentage: parsedPercentage };
  });

export default function DeductionSetupScreen({ navigation }) {
  useLanguage();
  const { pullFromDB, salaryStore } = useContext(Context);
  const [salaryRanges, setSalaryRanges] = useState(initialSalaryRanges);
  const [otherTaxes, setOtherTaxes] = useState(initialOtherTaxes);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getCashflowData()
      .then(data => {
        if (!isMounted) {
          return;
        }
        if (data.salaryDeductions.length) {
          setSalaryRanges(
            data.salaryDeductions.map(range => ({
              range:
                range.max_salary === null
                  ? String(range.min_salary)
                  : `${range.min_salary}-${range.max_salary}`,
              percentage: String(range.percentage),
            })),
          );
        }
        if (data.otherTaxes.length) {
          setOtherTaxes(
            data.otherTaxes.map(tax => ({
              name: tax.name,
              percentage: String(tax.percentage),
            })),
          );
        }
      })
      .catch(error => {
        console.error("Failed to load deduction settings:", error);
        Alert.alert(t("Could not load deduction settings"), t("Please try again."));
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const updateRange = (index, field, value) =>
    setSalaryRanges(current =>
      current.map((range, row) =>
        row === index ? { ...range, [field]: value } : range,
      ),
    );

  const updateTax = (index, field, value) =>
    setOtherTaxes(current =>
      current.map((tax, row) =>
        row === index ? { ...tax, [field]: value } : tax,
      ),
    );

  const removeRange = index =>
    setSalaryRanges(current =>
      current.length > 1 ? current.filter((_, row) => row !== index) : current,
    );
  const removeTax = index =>
    setOtherTaxes(current =>
      current.length > 1 ? current.filter((_, row) => row !== index) : current,
    );

  const saveDeductions = async () => {
    setIsSaving(true);
    try {
      const parsedSalaryRanges = parseSalaryRanges(salaryRanges);
      const parsedOtherTaxes = parseOtherTaxes(otherTaxes);
      await pullFromDB();
      if (!salaryStore.profileExists) {
        throw new Error(t("Complete income setup before saving deductions."));
      }
      await saveDeductionConfiguration(parsedSalaryRanges, parsedOtherTaxes);
      await pullFromDB();
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "Home" }],
        }),
      );
    } catch (error) {
      console.error("Failed to save deductions:", error);
      Alert.alert(
        t("Could not save deductions"),
        error instanceof Error ? error.message : t("Please try again."),
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
        <CustomText type="header2" text={t("Costa Rica deductions")} />
        <CustomText
          type="body1"
          text={t("Review the Hacienda income-tax brackets and CCSS contribution. These deductions are applied to fixed salary projections.")}
          style={styles.intro}
        />
        <SectionTitle text={t("Hacienda income-tax brackets")} />
        {salaryRanges.map((range, index) => (
          <View key={`salary-${index}`} style={styles.row}>
            <CustomTextInput
              autoCapitalize="none"
              placeholder={t("Minimum-maximum (CRC)")}
              setValue={value => updateRange(index, "range", value)}
              style={styles.rangeInput}
              value={range.range}
            />
            <CustomTextInput
              keyboardType="decimal-pad"
              placeholder="%"
              setValue={value => updateRange(index, "percentage", value)}
              style={styles.percentageInput}
              value={range.percentage}
            />
            <CustomButton
              disabled={salaryRanges.length <= 1}
              onPress={() => removeRange(index)}
              style={styles.removeButton}
              text="-"
              type="warning"
            />
          </View>
        ))}
        <CustomButton
          onPress={() =>
            setSalaryRanges(current => [
              ...current,
              { range: "", percentage: "" },
            ])
          }
          style={styles.addRowButton}
          text={t("Add bracket")}
          type="secondary"
        />

        <SectionTitle text={t("Other deductions")} />
        {otherTaxes.map((tax, index) => (
          <View key={`other-${index}`} style={styles.row}>
            <CustomTextInput
              placeholder={t("Deduction name")}
              setValue={value => updateTax(index, "name", value)}
              style={styles.rangeInput}
              value={tax.name}
            />
            <CustomTextInput
              keyboardType="decimal-pad"
              placeholder="%"
              setValue={value => updateTax(index, "percentage", value)}
              style={styles.percentageInput}
              value={tax.percentage}
            />
            <CustomButton
              disabled={otherTaxes.length <= 1}
              onPress={() => removeTax(index)}
              style={styles.removeButton}
              text="-"
              type="warning"
            />
          </View>
        ))}
        <CustomButton
          onPress={() =>
            setOtherTaxes(current => [
              ...current,
              { name: "", percentage: "" },
            ])
          }
          style={styles.addRowButton}
          text={t("Add deduction")}
          type="secondary"
        />
        <CustomButton
          disabled={isSaving}
          onPress={saveDeductions}
          style={styles.saveButton}
          text={isSaving ? t("Saving...") : t("Save and open Home")}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ text }) {
  return <CustomText type="header3" text={text} style={styles.sectionTitle} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 18,
  },
  content: {
    paddingTop: 24,
    paddingBottom: 40,
  },
  intro: {
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    marginTop: 26,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
  },
  rangeInput: {
    flex: 1,
    marginRight: 8,
  },
  percentageInput: {
    width: 76,
  },
  removeButton: {
    minWidth: 42,
    marginLeft: 8,
  },
  addRowButton: {
    alignSelf: "flex-start",
    marginTop: 12,
  },
  saveButton: {
    marginTop: 32,
  },
});

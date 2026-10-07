import React, { useContext, useEffect, useState } from "react";
import { Alert, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import {
  getSalaryRow,
  resetDatabase,
  updateSalaryAmount,
} from "../../utils/database_connector";
import { Context } from "../../utils/store";

export default function SettingsScreen({ navigation }) {
  const { clear, pullFromDB, salaryStore } = useContext(Context);
  const [isResetting, setIsResetting] = useState(false);
  const [salaryAmount, setSalaryAmount] = useState("");
  const [isSavingSalary, setIsSavingSalary] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getSalaryRow()
      .then(salary => {
        if (isMounted && salary?.amount !== null && salary?.amount !== undefined) {
          setSalaryAmount(String(salary.amount));
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
    if (!salaryAmount.trim() || !Number.isFinite(Number(salaryAmount))) {
      console.warn("[Settings warning] Invalid monthly salary amount.", {
        salaryAmount,
      });
      Alert.alert("Check salary amount", "Enter a valid monthly salary.");
      return;
    }
    setIsSavingSalary(true);
    try {
      await updateSalaryAmount(Number(salaryAmount));
      await pullFromDB();
      Alert.alert("Salary updated", "Your projections will use the new salary.");
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
      <View style={styles.content}>
        <CustomText type="header2" text="Settings" />
        <CustomText
          type="body3"
          text="Manage your app configuration and saved data."
          style={styles.description}
        />
        {salaryStore.fixed ? (
          <View style={styles.section}>
            <CustomText type="header3" text="Monthly gross salary" />
            <CustomText
              type="body1"
              text={`Current saved salary: ${Number(salaryAmount || 0).toLocaleString()} ${salaryStore.currency || "CRC"} per month. Update it to change future projections.`}
              style={styles.resetDescription}
            />
            <CustomTextInput
              keyboardType="decimal-pad"
              placeholder="Monthly gross salary"
              setValue={setSalaryAmount}
              value={salaryAmount}
            />
            <CustomButton
              disabled={isSavingSalary}
              onPress={saveSalaryAmount}
              style={styles.salaryButton}
              text={isSavingSalary ? "Saving..." : "Save salary"}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
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
  resetButton: {
    alignSelf: "flex-start",
  },
});

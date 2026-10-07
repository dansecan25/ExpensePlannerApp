import React, { useCallback, useState } from "react";
import { Alert, ScrollView, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import { addSubscription, deleteSubscription, getCashflowData, getLocalDate, getSubscriptions, setSubscriptionActive } from "../../utils/database_connector";
import { subscriptionWouldGoNegativeWithinSixMonths } from "../../utils/financeCalculations";
import { dateOptions, EntryCard, money, Section, styles, useFinanceData } from "./Shared";
export default function SubscriptionsScreen() {
  const { data, error, reload } = useFinanceData();
  const [subscriptions, setSubscriptions] = useState([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(getLocalDate());
  const [frequency, setFrequency] = useState("monthly");
  const [intervalDays, setIntervalDays] = useState("30");
  const [accountId, setAccountId] = useState(null);
  const [tagId, setTagId] = useState(null);
  const currency = data?.salary?.currency || "";

  const reloadSubscriptions = useCallback(async () => {
    try {
      setSubscriptions(await getSubscriptions());
    } catch (loadError) {
      console.error("Failed to load subscriptions:", loadError);
      Alert.alert("Could not load subscriptions", "Please try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSubscriptions();
    }, [reloadSubscriptions]),
  );

  const save = async () => {
    const subscription = {
      name,
      amount: Number(amount),
      accountId,
      tagId,
      startDate,
      frequency,
      intervalDays: Number(intervalDays),
      active: true,
    };
    try {
      const financeData = await getCashflowData();
      if (
        subscriptionWouldGoNegativeWithinSixMonths(financeData, {
          ...subscription,
          account_id: accountId,
          tag_id: tagId,
          start_date: startDate,
          interval_days: Number(intervalDays),
        })
      ) {
        console.warn("[Subscription warning] New subscription blocked.", {
          name: subscription.name,
          amount: subscription.amount,
          startDate,
          frequency,
          intervalDays: Number(intervalDays),
        });
        Alert.alert(
          "Subscription not added",
          "This recurring deduction would make your projected balance negative within six months.",
        );
        return;
      }
      await addSubscription(subscription);
      setName("");
      setAmount("");
      await Promise.all([reload(), reloadSubscriptions()]);
    } catch (saveError) {
      console.error("Failed to save subscription:", saveError);
      Alert.alert(
        "Could not add subscription",
        saveError instanceof Error ? saveError.message : "Please try again.",
      );
    }
  };

  const toggleActive = async subscription => {
    try {
      if (!subscription.active) {
        const financeData = await getCashflowData();
        if (
          subscriptionWouldGoNegativeWithinSixMonths(financeData, {
            ...subscription,
            active: true,
          })
        ) {
          console.warn("[Subscription warning] Reactivation blocked.", {
            name: subscription.name,
            amount: subscription.amount,
            startDate: subscription.start_date,
            frequency: subscription.frequency,
          });
          Alert.alert(
            "Subscription not enabled",
            "Reactivating this subscription would make your projected balance negative within six months.",
          );
          return;
        }
      }
      await setSubscriptionActive(subscription.id, !subscription.active);
      await reloadSubscriptions();
    } catch (toggleError) {
      console.error("Failed to update subscription:", toggleError);
      Alert.alert("Could not update subscription", "Please try again.");
    }
  };

  const remove = subscription =>
    Alert.alert("Delete subscription", `Delete ${subscription.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteSubscription(subscription.id);
            await reloadSubscriptions();
          } catch (deleteError) {
            console.error("Failed to delete subscription:", deleteError);
            Alert.alert("Could not delete subscription", "Please try again.");
          }
        },
      },
    ]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Subscriptions" />
        <CustomText
          type="body1"
          text="Recurring deductions are included in forward balance projections."
          style={styles.intro}
        />
        <Section title="Your subscriptions">
          {error ? dateOptions("Could not load subscription settings.") : null}
          {subscriptions.map(subscription => (
            <EntryCard
              key={subscription.id}
              title={`${subscription.name} · ${money(subscription.amount, currency)}`}
            >
              {dateOptions(
                `${subscription.frequency} · from ${subscription.start_date}`,
              )}
              {subscription.account_name
                ? dateOptions(`Account: ${subscription.account_name}`)
                : null}
              <View style={styles.buttonRow}>
                <CustomButton
                  onPress={() => toggleActive(subscription)}
                  style={styles.smallButton}
                  text={subscription.active ? "Pause" : "Resume"}
                  type="secondary"
                />
                <CustomButton
                  onPress={() => remove(subscription)}
                  style={styles.smallButton}
                  text="Delete"
                  type="warning"
                />
              </View>
            </EntryCard>
          ))}
          {subscriptions.length === 0 ? dateOptions("No subscriptions yet.") : null}
        </Section>
        <Section title="Add a subscription">
          <CustomTextInput
            placeholder="Subscription name"
            setValue={setName}
            value={name}
          />
          <CustomTextInput
            keyboardType="decimal-pad"
            placeholder="Amount"
            setValue={setAmount}
            style={styles.inputSpacing}
            value={amount}
          />
          <CustomTextInput
            autoCapitalize="none"
            placeholder="First deduction date (YYYY-MM-DD)"
            setValue={setStartDate}
            style={styles.inputSpacing}
            value={startDate}
          />
          <Dropdown
            data={[
              { label: "Monthly", value: "monthly" },
              { label: "Annually", value: "annual" },
              { label: "Custom interval", value: "custom" },
            ]}
            labelField="label"
            onChange={item => setFrequency(item.value)}
            placeholder="Recurrence"
            placeholderStyle={dropdownStyles.placeholderText}
            selectedTextStyle={dropdownStyles.selectedText}
            style={[dropdownStyles.input, styles.inputSpacing]}
            value={frequency}
            valueField="value"
          />
          {frequency === "custom" && (
            <CustomTextInput
              keyboardType="number-pad"
              placeholder="Repeat every how many days?"
              setValue={setIntervalDays}
              style={styles.inputSpacing}
              value={intervalDays}
            />
          )}
          <Dropdown
            data={(data?.accounts || []).map(account => ({
              label: account.name,
              value: account.id,
            }))}
            labelField="label"
            onChange={item => setAccountId(item.value)}
            placeholder="Account (optional)"
            placeholderStyle={dropdownStyles.placeholderText}
            selectedTextStyle={dropdownStyles.selectedText}
            style={[dropdownStyles.input, styles.inputSpacing]}
            value={accountId}
            valueField="value"
          />
          <Dropdown
            data={(data?.tags || []).map(tag => ({
              label: tag.name,
              value: tag.id,
            }))}
            labelField="label"
            onChange={item => setTagId(item.value)}
            placeholder="Group (optional)"
            placeholderStyle={dropdownStyles.placeholderText}
            selectedTextStyle={dropdownStyles.selectedText}
            style={[dropdownStyles.input, styles.inputSpacing]}
            value={tagId}
            valueField="value"
          />
          <CustomButton
            onPress={save}
            style={styles.actionButton}
            text="Add subscription"
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

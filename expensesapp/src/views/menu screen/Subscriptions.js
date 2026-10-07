import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import { addSubscription, createTag, deleteSubscription, getCashflowData, getLocalDate, getSubscriptions, setSubscriptionActive } from "../../utils/database_connector";
import { formatDisplayDate } from "../../utils/dateFormatting";
import { subscriptionWouldGoNegativeWithinSixMonths } from "../../utils/financeCalculations";
import { dateOptions, EntryCard, money, Section, styles, useFinanceData } from "./Shared";
export default function SubscriptionsScreen() {
  const { data, error, reload } = useFinanceData();
  const scrollRef = useRef(null);
  const [subscriptions, setSubscriptions] = useState([]);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [startDate, setStartDate] = useState(getLocalDate());
  const [frequency, setFrequency] = useState("monthly");
  const [intervalDays, setIntervalDays] = useState("30");
  const [accountId, setAccountId] = useState(null);
  const [tagId, setTagId] = useState(null);
  const [tagQuery, setTagQuery] = useState("");
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagColorOpen, setTagColorOpen] = useState(false);
  const [tagColor, setTagColor] = useState("#4261a0");
  const [isSaving, setIsSaving] = useState(false);
  const currency = data?.salary?.currency || "";
  const tags = (data?.tags || []).map(tag => ({
    label: tag.name,
    value: tag.id,
    color: tag.color,
  }));
  const normalizedTagQuery = tagQuery.trim().toLocaleLowerCase();
  const matchingTags = tags.filter(tag =>
    tag.label.toLocaleLowerCase().includes(normalizedTagQuery),
  );
  const exactTag = tags.find(
    tag => tag.label.toLocaleLowerCase() === normalizedTagQuery,
  );
  const canCreateTag = normalizedTagQuery.length > 0 && !exactTag;
  const validTagColor = /^#[0-9a-fA-F]{6}$/.test(tagColor);
  const tagColors = [
    "#4261A0",
    "#2E7D5B",
    "#D97706",
    "#B54747",
    "#7B61A8",
    "#287A8C",
    "#6B7280",
  ];

  const selectTag = tag => {
    setTagId(tag.value);
    setTagQuery(tag.label);
    setTagColor(tag.color || "#4261a0");
    setTagMenuOpen(false);
    setTagColorOpen(false);
  };

  const submitTag = async () => {
    const normalizedName = tagQuery.trim();
    if (!normalizedName) {
      return;
    }
    if (exactTag) {
      selectTag(exactTag);
      return;
    }
    if (!validTagColor) {
      Alert.alert("Invalid tag color", "Enter a six-digit hexadecimal color.");
      return;
    }
    try {
      const createdTag = await createTag(normalizedName, tagColor);
      await reload();
      selectTag({
        label: createdTag.name,
        value: createdTag.id,
        color: createdTag.color,
      });
    } catch (tagError) {
      console.error("Failed to create subscription tag:", tagError);
      Alert.alert(
        "Could not create tag",
        tagError instanceof Error ? tagError.message : "Please try again.",
      );
    }
  };

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

  useEffect(() => {
    if (accountId !== null || !data?.accounts?.length) {
      return;
    }
    const defaultAccount =
      data.accounts.find(
        account =>
          account.name.trim().toLocaleLowerCase() === "main account",
      ) || data.accounts[0];
    setAccountId(defaultAccount.id);
  }, [accountId, data?.accounts]);

  const save = async () => {
    if (isSaving) {
      return;
    }
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
    setIsSaving(true);
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
      Keyboard.dismiss();
      await addSubscription(subscription);
      setName("");
      setAmount("");
      setStartDate(getLocalDate());
      setFrequency("monthly");
      setIntervalDays("30");
      setAccountId(null);
      setTagId(null);
      setTagQuery("");
      setTagMenuOpen(false);
      setTagColorOpen(false);
      setTagColor("#4261a0");
      await reloadSubscriptions();
      requestAnimationFrame(() =>
        scrollRef.current?.scrollToEnd({ animated: true }),
      );
    } catch (saveError) {
      console.error("Failed to save subscription:", saveError);
      Alert.alert(
        "Could not add subscription",
        saveError instanceof Error ? saveError.message : "Please try again.",
      );
    } finally {
      setIsSaving(false);
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
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
      >
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
                `${subscription.frequency} · from ${formatDisplayDate(subscription.start_date)}`,
              )}
              {subscription.account_name
                ? dateOptions(`Account: ${subscription.account_name}`)
                : null}
              {subscription.tag_name
                ? dateOptions(`Tag: ${subscription.tag_name}`)
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
            dropdownPosition="bottom"
            keyboardAvoiding={false}
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
            dropdownPosition="bottom"
            keyboardAvoiding={false}
            onChange={item => setAccountId(item.value)}
            placeholder="Account"
            placeholderStyle={dropdownStyles.placeholderText}
            selectedTextStyle={dropdownStyles.selectedText}
            style={[dropdownStyles.input, styles.inputSpacing]}
            value={accountId}
            valueField="value"
          />
          <View style={localStyles.tagSection}>
            <CustomText type="body4" text="Tag (optional)" style={localStyles.tagLabel} />
            <View style={localStyles.tagRow}>
              <TextInput
                autoCapitalize="sentences"
                onChangeText={value => {
                  setTagQuery(value);
                  setTagId(null);
                  setTagMenuOpen(true);
                }}
                onFocus={() => setTagMenuOpen(true)}
                onSubmitEditing={submitTag}
                placeholder="Search or create a tag"
                placeholderTextColor="#a8a8a8ff"
                returnKeyType="done"
                style={localStyles.tagInput}
                value={tagQuery}
              />
              {canCreateTag && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setTagColorOpen(open => !open)}
                  style={localStyles.colorToggle}
                >
                  <View
                    style={[
                      localStyles.swatch,
                      { backgroundColor: validTagColor ? tagColor : "#4261a0" },
                    ]}
                  />
                  <CustomText type="body5" text="Color" />
                </Pressable>
              )}
            </View>
            {tagMenuOpen && matchingTags.length > 0 && (
              <View style={localStyles.tagOptions}>
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  style={localStyles.tagOptionsScroll}
                >
                  {matchingTags.map(tag => (
                    <Pressable
                      key={tag.value}
                      onPress={() => selectTag(tag)}
                      style={localStyles.tagOption}
                    >
                      <View
                        style={[
                          localStyles.swatch,
                          { backgroundColor: tag.color || "#4261a0" },
                        ]}
                      />
                      <CustomText type="body4" text={tag.label} />
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            {canCreateTag && (
              <>
                <CustomText
                  type="body5"
                  text="Press Enter to create this tag."
                  style={localStyles.tagHint}
                />
                {tagColorOpen && (
                  <View style={localStyles.colorPanel}>
                    <TextInput
                      autoCapitalize="none"
                      autoCorrect={false}
                      maxLength={7}
                      onChangeText={setTagColor}
                      placeholder="#4261A0"
                      placeholderTextColor="#a8a8a8ff"
                      style={localStyles.hexInput}
                      value={tagColor}
                    />
                    <View style={localStyles.colorPalette}>
                      {tagColors.map(color => (
                        <Pressable
                          accessibilityLabel={`Select ${color}`}
                          accessibilityRole="button"
                          key={color}
                          onPress={() => setTagColor(color)}
                          style={[
                            localStyles.swatch,
                            localStyles.paletteSwatch,
                            { backgroundColor: color },
                            validTagColor &&
                              tagColor.toUpperCase() === color &&
                              localStyles.selectedSwatch,
                          ]}
                        />
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
          <CustomButton
            disabled={isSaving}
            onPress={save}
            style={styles.actionButton}
            text={isSaving ? "Adding subscription..." : "Add subscription"}
          />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  tagSection: {
    marginTop: 12,
  },
  tagLabel: {
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  tagInput: {
    flex: 1,
    height: 48,
    borderWidth: 2,
    paddingHorizontal: 15,
    borderRadius: 8,
    backgroundColor: "#ffffff",
    borderColor: "#ccc",
    fontSize: 16,
    color: "#000",
  },
  colorToggle: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  swatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  tagOptions: {
    marginTop: 4,
    maxHeight: 180,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  tagOptionsScroll: {
    maxHeight: 180,
  },
  tagOption: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#ddd",
  },
  tagHint: {
    marginTop: 6,
  },
  colorPanel: {
    marginTop: 8,
    gap: 8,
  },
  hexInput: {
    height: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#000",
  },
  colorPalette: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 4,
  },
  paletteSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  selectedSwatch: {
    borderWidth: 2,
    borderColor: "#111",
  },
});

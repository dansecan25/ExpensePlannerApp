import React, { useEffect, useState } from "react";
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
  getAccountsCreated,
  getAllTags,
  getCashflowData,
  getLocalDate,
  isValidLocalDate,
  insertExpense,
} from "../utils/database_connector";
import { wouldGoNegativeWithinSixMonths } from "../utils/financeCalculations";
import { getColors } from "../utils/color-picker";
import { useTheme } from "../utils/themeContext";

const TransactionForm = ({
  navigation,
  mode = "today",
  initialTagId = null,
  initialTagName = "",
  initialSavingsWithdrawal = false,
}) => {
  useTheme();
  const isVariation = mode === "variation";
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [kind, setKind] = useState(
    initialSavingsWithdrawal ? "savings_use" : "expense",
  );
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const [tagId, setTagId] = useState(initialTagId);
  const [tagQuery, setTagQuery] = useState(initialTagName);
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagColorOpen, setTagColorOpen] = useState(false);
  const [tagColor, setTagColor] = useState("#4261a0");
  const [isInflated, setIsInflated] = useState(false);
  const [inflatedAmount, setInflatedAmount] = useState("");
  const [isRecurringDeduction, setIsRecurringDeduction] = useState(false);
  const [recurrenceFrequency, setRecurrenceFrequency] = useState("monthly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadOptions = async () => {
      try {
        const [accountRows, tagRows] = await Promise.all([
          getAccountsCreated(),
          getAllTags(),
        ]);
        if (isMounted) {
          const defaultAccount =
            accountRows.find(
              account =>
                account.name.trim().toLocaleLowerCase() === "main account",
            ) || accountRows[0];
          setAccounts(
            accountRows.map(account => ({
              label: account.name,
              value: account.id,
            })),
          );
          setAccountId(current => current ?? defaultAccount?.id ?? null);
          setTags(
            tagRows.map(tag => ({
              label: tag.name,
              value: tag.id,
              color: tag.color,
            })),
          );
        }
      } catch (error) {
        console.error("Failed to load transaction options:", error);
        Alert.alert("Could not load accounts and tags", "Please try again.");
      }
    };
    loadOptions();
    return () => {
      isMounted = false;
    };
  }, []);

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

  const handleTagSubmit = async () => {
    const normalizedName = tagQuery.trim();
    if (!normalizedName) {
      return;
    }
    if (exactTag) {
      selectTag(exactTag);
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(tagColor)) {
      Alert.alert("Invalid tag color", "Enter a six-digit hexadecimal color.");
      return;
    }

    try {
      const createdTag = await createTag(normalizedName, tagColor);
      const option = {
        label: createdTag.name,
        value: createdTag.id,
        color: createdTag.color,
      };
      setTags(currentTags => {
        const withoutDuplicate = currentTags.filter(
          tag => tag.value !== option.value,
        );
        return [...withoutDuplicate, option].sort((left, right) =>
          left.label.localeCompare(right.label),
        );
      });
      selectTag(option);
    } catch (error) {
      console.error("Failed to create transaction tag:", error);
      Alert.alert(
        "Could not create tag",
        error instanceof Error ? error.message : "Please try again.",
      );
    }
  };

  const numericAmount = Number(amount);
  const numericInflatedAmount = Number(inflatedAmount);
  const inflationValid =
    !isInflated ||
    (inflatedAmount.trim() !== "" &&
      Number.isFinite(numericInflatedAmount) &&
      numericInflatedAmount >= numericAmount);
  const canSave =
    name.trim().length > 0 &&
    amount.trim().length > 0 &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    inflationValid &&
    isValidLocalDate(date) &&
    (!isRecurringDeduction ||
      !recurrenceEndDate ||
      (isValidLocalDate(recurrenceEndDate) && recurrenceEndDate >= date));

  const handleSave = async () => {
    if (!canSave) {
      console.warn("[Transaction warning] Invalid transaction details.", {
        name,
        amount,
        date,
        type:
          kind === "income"
            ? "income"
            : kind === "savings"
              ? "savings"
              : "deduction",
        validDate: isValidLocalDate(date),
        inflationValid,
      });
      Alert.alert(
        "Check transaction details",
        "Enter a name, a positive amount, a valid date, and an inflated amount no lower than the actual amount.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const inflated = isInflated ? numericInflatedAmount : null;
      if (kind !== "income" && kind !== "savings_use") {
        const financeData = await getCashflowData();
        if (
          wouldGoNegativeWithinSixMonths(financeData, {
            date,
            name: name.trim(),
            amount: numericAmount,
            inflated_value: inflated,
            account_id: accountId,
            kind,
            recurrence_frequency: isRecurringDeduction
              ? recurrenceFrequency
              : null,
            recurrence_end_date:
              isRecurringDeduction && recurrenceEndDate
                ? recurrenceEndDate
                : null,
          })
        ) {
          console.warn("[Transaction warning] Deduction blocked.", {
            name: name.trim(),
            amount: numericAmount,
            date,
            type: "deduction",
          });
          Alert.alert(
            "Deduction not added",
            "This deduction would leave the projected balance below zero within the next six months.",
          );
          return;
        }
      }

      let selectedTagIds = tagId === null ? [] : [tagId];
      if (kind !== "income" && tagId === null && tagQuery.trim()) {
        const savedTag = await createTag(tagQuery.trim(), tagColor);
        selectedTagIds = [savedTag.id];
      }

      await insertExpense(
        name,
        numericAmount,
        inflated,
        selectedTagIds,
        accountId,
        date,
        description,
        {
          kind,
          isSavings: kind === "savings",
          isSavingsWithdrawal: initialSavingsWithdrawal,
          recurrenceFrequency:
            kind !== "income" &&
            kind !== "savings_use" &&
            isRecurringDeduction
              ? recurrenceFrequency
              : null,
          recurrenceEndDate:
            kind !== "income" &&
            kind !== "savings_use" &&
            isRecurringDeduction
              ? recurrenceEndDate || null
              : null,
        },
      );
      navigation.goBack();
    } catch (error) {
      console.error("Failed to save transaction:", error);
      Alert.alert(
        "Could not save transaction",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const title =
    kind === "income"
      ? "Record income"
      : kind === "savings_use"
        ? "Record savings used"
        : kind === "savings"
          ? "Add to savings"
          : isVariation
            ? "Record a deduction"
            : "In what did you spend money today?";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <CustomText type="header2" text={title} style={styles.title} />
        {!initialSavingsWithdrawal && (
          <>
            <CustomText type="body3" text="Transaction type" />
            <View style={styles.choiceRow}>
              <CustomButton
                onPress={() => setKind("expense")}
                style={styles.choice}
                text="Deduction"
                type={kind === "expense" ? "primary" : "secondary"}
              />
              <CustomButton
                onPress={() => {
                  setKind("savings");
                  setIsInflated(false);
                }}
                style={styles.choice}
                text="Savings"
                type={kind === "savings" ? "primary" : "secondary"}
              />
              {isVariation ? (
                <CustomButton
                  onPress={() => {
                    setKind("income");
                    setIsInflated(false);
                    setIsRecurringDeduction(false);
                  }}
                  style={styles.choice}
                  text="Income"
                  type={kind === "income" ? "primary" : "secondary"}
                />
              ) : null}
            </View>
          </>
        )}
        {isVariation && (
          <Field label="Date (YYYY-MM-DD)">
            <DatePicker
              placeholder="Select transaction date"
              setValue={setDate}
              value={date}
            />
          </Field>
        )}

        <Field label="Name">
          <CustomTextInput
            placeholder={kind === "income" ? "Where did the income come from?" : "What was it?"}
            setValue={setName}
            value={name}
          />
        </Field>
        <Field label="Amount">
          <CustomTextInput
            keyboardType="decimal-pad"
            placeholder="0.00"
            setValue={setAmount}
            value={amount}
          />
        </Field>

        {kind === "expense" && (
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
        {(kind === "expense" || kind === "savings") && (
          <>
            <View style={styles.checkRow}>
              <CustomText
                type="body4"
                text={
                  kind === "savings"
                    ? "Recurring savings contribution"
                    : "Recurring deduction"
                }
              />
              <CustomCheckbox
                checked={isRecurringDeduction}
                label="Repeat"
                onToggle={() =>
                  setIsRecurringDeduction(value => !value)
                }
              />
            </View>
            {isRecurringDeduction && (
              <>
                <Field label="Repeat">
                  <Dropdown
                    data={[
                      { label: "Weekly", value: "weekly" },
                      { label: "Monthly", value: "monthly" },
                      { label: "Yearly", value: "yearly" },
                    ]}
                    dropdownPosition="bottom"
                    keyboardAvoiding={false}
                    labelField="label"
                    onChange={item => setRecurrenceFrequency(item.value)}
                    placeholder="Repeat frequency"
                    placeholderStyle={dropdownStyles.placeholderText}
                    selectedTextStyle={dropdownStyles.selectedText}
                    style={dropdownStyles.input}
                    value={recurrenceFrequency}
                    valueField="value"
                  />
                </Field>
                <Field label="End date (optional, YYYY-MM-DD)">
                  <DatePicker
                    allowClear
                    placeholder="Leave blank to repeat until stopped"
                    setValue={setRecurrenceEndDate}
                    value={recurrenceEndDate}
                  />
                </Field>
                {recurrenceEndDate &&
                  (!isValidLocalDate(recurrenceEndDate) ||
                    recurrenceEndDate < date) && (
                    <CustomText
                      type="body5"
                      text="Enter a valid end date on or after the first deduction date."
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
        <Field label="Account">
          <Dropdown
            data={accounts}
            dropdownPosition="bottom"
            labelField="label"
            keyboardAvoiding={false}
            onChange={item => setAccountId(item.value)}
            placeholder="Select account"
            placeholderStyle={dropdownStyles.placeholderText}
            selectedTextStyle={dropdownStyles.selectedText}
            style={dropdownStyles.input}
            value={accountId}
            valueField="value"
          />
        </Field>
        <Field
          label={
            kind === "savings" ? "Savings tag (optional)" : "Tag (optional)"
          }
        >
          <View style={styles.tagRow}>
            <TextInput
              autoCapitalize="sentences"
              onChangeText={value => {
                setTagQuery(value);
                setTagId(null);
                setTagMenuOpen(true);
              }}
              onFocus={() => setTagMenuOpen(true)}
              onSubmitEditing={handleTagSubmit}
              placeholder={
                kind === "savings"
                  ? "Search or create a savings tag"
                  : "Search or create a tag"
              }
              placeholderTextColor={getColors("placeholder")}
              returnKeyType="done"
              style={[
                styles.tagInput,
                {
                  backgroundColor: getColors("input"),
                  borderColor: getColors("border"),
                  color: getColors("secondaryText"),
                },
              ]}
              value={tagQuery}
            />
            {canCreateTag && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setTagColorOpen(open => !open)}
                style={[
                  styles.tagColorToggle,
                  {
                    backgroundColor: getColors("surface"),
                    borderColor: getColors("border"),
                  },
                ]}
              >
                <View
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: validTagColor ? tagColor : "#4261a0" },
                  ]}
                />
                <CustomText
                  type="body5"
                  text="Color"
                  style={{ color: getColors("secondaryText") }}
                />
              </Pressable>
            )}
          </View>
          {tagMenuOpen && matchingTags.length > 0 && (
            <View
              style={[
                styles.tagOptions,
                {
                  backgroundColor: getColors("surface"),
                  borderColor: getColors("border"),
                },
              ]}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={styles.tagOptionsScroll}
              >
                {matchingTags.map(tag => (
                  <Pressable
                    key={tag.value}
                    onPress={() => selectTag(tag)}
                    style={[
                      styles.tagOption,
                      {
                        backgroundColor: getColors("surface"),
                        borderBottomColor: getColors("border"),
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
                        { backgroundColor: tag.color || "#4261a0" },
                      ]}
                    />
                    <CustomText
                      type="body4"
                      text={tag.label}
                      style={{ color: getColors("secondaryText") }}
                    />
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
                style={styles.tagHint}
              />
              {tagColorOpen && (
                <View style={styles.tagColorPanel}>
                  <TextInput
                    autoCapitalize="none"
                    autoCorrect={false}
                    maxLength={7}
                    onChangeText={value => setTagColor(value)}
                    placeholder="#4261A0"
                    placeholderTextColor={getColors("placeholder")}
                    style={[
                      styles.colorHexInput,
                      {
                        backgroundColor: getColors("input"),
                        borderColor: getColors("border"),
                        color: getColors("secondaryText"),
                      },
                    ]}
                    value={tagColor}
                  />
                  <View style={styles.tagColorOptions}>
                    {tagColors.map(color => (
                      <Pressable
                        accessibilityLabel={`Select ${color}`}
                        accessibilityRole="button"
                        key={color}
                        onPress={() => setTagColor(color)}
                        style={[
                          styles.colorSwatch,
                          styles.paletteSwatch,
                          { backgroundColor: color },
                          validTagColor &&
                            tagColor.toUpperCase() === color &&
                            styles.selectedPaletteSwatch,
                        ]}
                      />
                    ))}
                  </View>
                </View>
              )}
            </>
          )}
        </Field>
        <CustomButton
          disabled={!canSave || isSaving}
          onPress={handleSave}
          style={styles.saveButton}
          text={
            isSaving
              ? "Saving..."
              : kind === "income"
                ? "Add income"
                : kind === "savings"
                  ? "Add savings"
                  : kind === "savings_use"
                    ? "Save usage"
                    : "Add expense"
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
};

function Field({ children, label }) {
  return (
    <View style={styles.field}>
      <CustomText type="body4" text={label} style={styles.fieldLabel} />
      {children}
    </View>
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
  title: {
    marginBottom: 16,
  },
  field: {
    marginTop: 16,
  },
  fieldLabel: {
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
  tagColorToggle: {
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
  colorSwatch: {
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
  tagColorPanel: {
    marginTop: 8,
    gap: 8,
  },
  colorHexInput: {
    height: 42,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    backgroundColor: "#fff",
    color: "#000",
  },
  tagColorOptions: {
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
  selectedPaletteSwatch: {
    borderWidth: 2,
    borderColor: "#111",
  },
  choiceRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  choice: {
    flex: 1,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
  },
  saveButton: {
    marginTop: 28,
  },
  validationMessage: {
    marginTop: 6,
    color: "#B54747",
  },
});

export default TransactionForm;

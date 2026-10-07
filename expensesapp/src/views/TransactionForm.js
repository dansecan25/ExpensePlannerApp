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
import { Dropdown } from "react-native-element-dropdown";

import CustomButton from "../components/customButton/customButton";
import CustomCheckbox from "../components/customCheckbox/customCheckbox";
import CustomText from "../components/customText/customText";
import CustomTextInput from "../components/customTextInput/customTextInput";
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

const TransactionForm = ({ navigation, mode = "today" }) => {
  const isVariation = mode === "variation";
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(getLocalDate());
  const [kind, setKind] = useState("expense");
  const [accounts, setAccounts] = useState([]);
  const [tags, setTags] = useState([]);
  const [accountId, setAccountId] = useState(null);
  const [tagId, setTagId] = useState(null);
  const [tagQuery, setTagQuery] = useState("");
  const [tagMenuOpen, setTagMenuOpen] = useState(false);
  const [tagColorOpen, setTagColorOpen] = useState(false);
  const [tagColor, setTagColor] = useState("#4261a0");
  const [isInflated, setIsInflated] = useState(false);
  const [inflatedAmount, setInflatedAmount] = useState("");
  const [isSavings, setIsSavings] = useState(false);
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
          setAccounts(
            accountRows.map(account => ({
              label: account.name,
              value: account.id,
            })),
          );
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
    isValidLocalDate(date);

  const handleSave = async () => {
    if (!canSave) {
      console.warn("[Transaction warning] Invalid transaction details.", {
        name,
        amount,
        date,
        type: kind === "income" ? "income" : "deduction",
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
      if (kind === "expense") {
        const financeData = await getCashflowData();
        if (
          wouldGoNegativeWithinSixMonths(financeData, {
            date,
            name: name.trim(),
            amount: numericAmount,
            inflated_value: inflated,
            account_id: accountId,
            kind: "expense",
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

      await insertExpense(
        name,
        numericAmount,
        inflated,
        tagId === null ? [] : [tagId],
        accountId,
        date,
        description,
        { kind, isSavings: kind === "expense" && isSavings },
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
        {isVariation && (
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
                  setKind("income");
                  setIsInflated(false);
                  setIsSavings(false);
                }}
                style={styles.choice}
                text="Income"
                type={kind === "income" ? "primary" : "secondary"}
              />
            </View>
            <Field label="Date (YYYY-MM-DD)">
              <CustomTextInput
                autoCapitalize="none"
                placeholder="2026-10-06"
                setValue={setDate}
                value={date}
              />
            </Field>
          </>
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
            <View style={styles.checkRow}>
              <CustomText type="body4" text="Count this as savings" />
              <CustomCheckbox
                checked={isSavings}
                label="Savings"
                onToggle={() => setIsSavings(value => !value)}
              />
            </View>
          </>
        )}

        <Field label="Description (optional)">
          <CustomTextInput
            placeholder="Extra information"
            setValue={setDescription}
            value={description}
          />
        </Field>
        <Field label="Account (optional)">
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
        <Field label={isSavings ? "Savings tag (optional)" : "Tag (optional)"}>
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
              placeholder={isSavings ? "Search or create a savings tag" : "Search or create a tag"}
              placeholderTextColor="#a8a8a8ff"
              returnKeyType="done"
              style={styles.tagInput}
              value={tagQuery}
            />
            {canCreateTag && (
              <Pressable
                accessibilityRole="button"
                onPress={() => setTagColorOpen(open => !open)}
                style={styles.tagColorToggle}
              >
                <View
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: validTagColor ? tagColor : "#4261a0" },
                  ]}
                />
                <CustomText type="body5" text="Color" />
              </Pressable>
            )}
          </View>
          {tagMenuOpen && matchingTags.length > 0 && (
            <View style={styles.tagOptions}>
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                style={styles.tagOptionsScroll}
              >
                {matchingTags.map(tag => (
                  <Pressable
                    key={tag.value}
                    onPress={() => selectTag(tag)}
                    style={styles.tagOption}
                  >
                    <View
                      style={[
                        styles.colorSwatch,
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
                    placeholderTextColor="#a8a8a8ff"
                    style={styles.colorHexInput}
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
          text={isSaving ? "Saving..." : kind === "income" ? "Add income" : "Add expense"}
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
});

export default TransactionForm;

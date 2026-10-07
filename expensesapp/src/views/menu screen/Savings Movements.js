import React, { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../../components/customButton/customButton";
import CustomText from "../../components/customText/customText";
import CustomTextInput from "../../components/customTextInput/customTextInput";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import {
  assignSavingsMovementTag,
  createSavingsGroupTag,
  deleteExpense,
  deleteSavingsGroupTag,
  getLocalDate,
  updateSavingsAmountUsed,
} from "../../utils/database_connector";
import { formatDisplayDate } from "../../utils/dateFormatting";
import { getRecurringDeductionOccurrenceDates } from "../../utils/recurringDeductionSchedule";
import { getSavingsAvailableAsOfDate } from "../../utils/savingsCalculations";
import {
  dateOptions,
  EntryCard,
  money,
  Section,
  styles,
  useFinanceData,
} from "./Shared";

const getTagIds = movement =>
  String(movement.tag_ids || "")
    .split(",")
    .filter(Boolean)
    .map(Number);

const getTagNames = movement =>
  String(movement.tags || "")
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

const getSavingsAdditionsAsOfToday = (movements, today) =>
  movements.flatMap(movement => {
    const firstDate = movement.date.slice(0, 10);
    if (firstDate > today) {
      return [];
    }
    const firstAddition = { ...movement, date: firstDate };
    if (!movement.recurrence_frequency) {
      return [firstAddition];
    }
    const recurringDates = getRecurringDeductionOccurrenceDates(
      movement,
      firstDate,
      today,
    );
    return [
      firstAddition,
      ...recurringDates.map(date => ({
        ...movement,
        id: `${movement.id}-${date}`,
        date,
        isRecurringOccurrence: true,
      })),
    ];
  });

export default function SavingsMovementsScreen({ navigation }) {
  const { data, error, reload } = useFinanceData();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [savingsUsedDrafts, setSavingsUsedDrafts] = useState({});
  const currency = data?.salary?.currency || "";
  const savingsMovements = useMemo(
    () =>
      (data?.expenses || []).filter(
        movement =>
          movement.kind === "savings" ||
          (movement.kind === "expense" && Number(movement.is_savings)),
      ),
    [data],
  );
  const spendingMovements = useMemo(
    () =>
      (data?.expenses || []).filter(
        movement =>
          (movement.kind === "expense" &&
            Number(movement.is_savings_withdrawal) === 1) ||
          movement.kind === "savings_use",
      ),
    [data],
  );
  const today = getLocalDate();
  const savingsAdditionsToDate = useMemo(
    () => getSavingsAdditionsAsOfToday(savingsMovements, today),
    [savingsMovements, today],
  );
  const activeSavingsRecurrences = useMemo(
    () =>
      savingsMovements.filter(
        movement => movement.recurrence_frequency,
      ),
    [savingsMovements],
  );
  const groups = useMemo(() => {
    const byTag = new Map();
    for (const tag of data?.tags || []) {
      byTag.set(tag.id, {
        id: tag.id,
        name: tag.name,
        additions: [],
        spending: [],
        isSavingsGroup: Number(tag.is_savings_group) === 1,
      });
    }
    const groupsByName = new Map(
      [...byTag.values()].map(group => [group.name.toLocaleLowerCase(), group]),
    );
    const untagged = {
      id: null,
      name: "Untagged savings",
      additions: [],
      spending: [],
    };

    for (const movement of savingsAdditionsToDate) {
      const tagIds = getTagIds(movement);
      const tagNames = getTagNames(movement);
      const movementGroups = tagIds
        .map(tagId => byTag.get(tagId))
        .filter(Boolean);
      for (const tagName of tagNames) {
        const group = groupsByName.get(tagName.toLocaleLowerCase());
        if (group && !movementGroups.includes(group)) {
          movementGroups.push(group);
        }
        if (!group && !movementGroups.some(item => item.name === tagName)) {
          const fallbackGroup = {
            id: `legacy-${tagName}`,
            name: tagName,
            additions: [],
            spending: [],
          };
          byTag.set(fallbackGroup.id, fallbackGroup);
          groupsByName.set(tagName.toLocaleLowerCase(), fallbackGroup);
          movementGroups.push(fallbackGroup);
        }
      }
      if (!movementGroups.length) {
        untagged.additions.push(movement);
      } else {
        for (const group of movementGroups) {
          group.additions.push(movement);
        }
      }
    }
    for (const movement of spendingMovements) {
      const movementGroups = getTagIds(movement)
        .map(tagId => byTag.get(tagId))
        .filter(Boolean);
      for (const tagName of getTagNames(movement)) {
        const group = groupsByName.get(tagName.toLocaleLowerCase());
        if (group && !movementGroups.includes(group)) {
          movementGroups.push(group);
        }
      }
      for (const group of movementGroups) {
        if (group.additions.length) {
          group.spending.push(movement);
        }
      }
    }
    return [
      ...[...byTag.values()].filter(
        group => group.additions.length || group.isSavingsGroup,
      ),
      ...(untagged.additions.length ? [untagged] : []),
    ];
  }, [data?.tags, savingsAdditionsToDate, spendingMovements]);
  const savingsAvailable = getSavingsAvailableAsOfDate(
    savingsMovements,
    today,
  ) -
    spendingMovements
      .filter(movement => movement.date.slice(0, 10) <= today)
      .reduce((total, movement) => total + Number(movement.value || 0), 0);
  const accountNames = new Map(
    (data?.accounts || []).map(account => [account.id, account.name]),
  );
  const savingsByAccount = useMemo(() => {
    const byAccount = new Map();
    for (const movement of savingsAdditionsToDate) {
      const accountId = movement.account_id;
      if (accountId === null || accountId === undefined) {
        continue;
      }
      byAccount.set(
        accountId,
        Number(byAccount.get(accountId) || 0) +
          Number(movement.value || 0) -
          (movement.isRecurringOccurrence
            ? 0
            : Number(movement.savings_used || 0)),
      );
    }
    for (const movement of spendingMovements) {
      if (movement.date.slice(0, 10) > today) {
        continue;
      }
      byAccount.set(
        movement.account_id,
        Number(byAccount.get(movement.account_id) || 0) -
          Number(movement.value || 0),
      );
    }
    return byAccount;
  }, [savingsAdditionsToDate, spendingMovements, today]);
  const tagOptions = (data?.tags || []).map(tag => ({
    label: tag.name,
    value: tag.id,
  }));

  const assignTag = async (movement, tagId) => {
    try {
      await assignSavingsMovementTag(movement.id, tagId);
      await reload();
    } catch (assignError) {
      console.error("Failed to assign savings movement tag:", assignError);
      Alert.alert("Could not assign tag", "Please try again.");
    }
  };

  const saveSavingsUsed = async movement => {
    const amount = Number(
      savingsUsedDrafts[movement.id] ?? movement.savings_used ?? 0,
    );
    const accountAvailable =
      Number(savingsByAccount.get(movement.account_id) || 0) +
      Number(movement.savings_used || 0);
    if (!Number.isFinite(amount) || amount < 0 || amount > accountAvailable) {
      Alert.alert(
        "Check savings used",
        "The amount used cannot exceed savings currently available in this account.",
      );
      return;
    }
    try {
      await updateSavingsAmountUsed(movement.id, amount);
      setSavingsUsedDrafts(current => {
        const updated = { ...current };
        delete updated[movement.id];
        return updated;
      });
      await reload();
    } catch (saveError) {
      console.error("Failed to update savings used:", saveError);
      Alert.alert(
        "Could not update savings usage",
        saveError instanceof Error ? saveError.message : "Please try again.",
      );
    }
  };

  const createGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert(
        "Enter a group name",
        "Name the savings group before creating it.",
      );
      return;
    }
    try {
      await createSavingsGroupTag(newGroupName.trim());
      setNewGroupName("");
      setIsCreatingGroup(false);
      await reload();
    } catch (createError) {
      console.error("Failed to create savings group:", createError);
      Alert.alert(
        "Could not create savings group",
        createError instanceof Error ? createError.message : "Please try again.",
      );
    }
  };

  const confirmDeleteMovement = movement =>
    Alert.alert(
      "Delete savings movement",
      `Delete the ${money(movement.value, currency)} savings addition "${movement.name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteExpense(movement.id);
              await reload();
            } catch (deleteError) {
              console.error("Failed to delete savings movement:", deleteError);
              Alert.alert("Could not delete movement", "Please try again.");
            }
          },
        },
      ],
    );

  const confirmDeleteGroup = group =>
    Alert.alert(
      "Delete savings group",
      `Remove the "${group.name}" savings group? Its savings additions will remain in history as untagged savings.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete group",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteSavingsGroupTag(group.id);
              await reload();
            } catch (deleteError) {
              console.error("Failed to delete savings group:", deleteError);
              Alert.alert("Could not delete savings group", "Please try again.");
            }
          },
        },
      ],
    );

  const addSpending = group =>
    navigation.navigate("Add general expense", {
      initialTagId: typeof group.id === "number" ? group.id : null,
      initialTagName: group.id === null ? "" : group.name,
      initialSavingsWithdrawal: true,
    });

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Savings Movements" />
        <CustomText
          type="body1"
          text="Review savings additions and record when money is used from a goal."
          style={styles.intro}
        />
        <EntryCard title="Savings available as of today">
          {dateOptions(money(savingsAvailable, currency))}
          {(data?.accounts || []).map(account => (
            <View key={account.id} style={styles.savingItem}>
              {dateOptions(
                `${account.name}: ${money(
                  savingsByAccount.get(account.id) || 0,
                  currency,
                )}`,
              )}
            </View>
          ))}
        </EntryCard>
        <Section title="Recurring savings">
          {activeSavingsRecurrences.map(movement => (
            <EntryCard
              key={movement.id}
              title={`${movement.name} · ${money(movement.value, currency)}`}
            >
              {dateOptions(`${movement.recurrence_frequency} · ${Number(
                movement.recurrence_active ?? 1,
              ) !== 1
                ? movement.recurrence_stopped_date
                  ? `stopped ${formatDisplayDate(movement.recurrence_stopped_date)}`
                  : "stopped"
                : movement.recurrence_end_date &&
                    movement.recurrence_end_date < today
                  ? `ended ${formatDisplayDate(movement.recurrence_end_date)}`
                  : movement.recurrence_end_date
                    ? `until ${formatDisplayDate(movement.recurrence_end_date)}`
                    : "ongoing"}`)}
              {dateOptions(
                `Account: ${
                  accountNames.get(movement.account_id) || "Main account"
                }`,
              )}
            </EntryCard>
          ))}
          {activeSavingsRecurrences.length === 0
            ? dateOptions("No recurring savings movements.")
            : null}
        </Section>
        <Section>
          <View style={localStyles.groupHeading}>
            <CustomText type="header3" text="Savings groups" />
            <CustomButton
              onPress={() => setIsCreatingGroup(value => !value)}
              style={localStyles.addGroupButton}
              text="+"
              type="secondary"
            />
          </View>
          {isCreatingGroup ? (
            <View style={localStyles.createGroupForm}>
              <CustomTextInput
                autoCapitalize="words"
                placeholder="Savings group name"
                setValue={setNewGroupName}
                value={newGroupName}
              />
              <View style={styles.buttonRow}>
                <CustomButton
                  onPress={createGroup}
                  style={styles.smallButton}
                  text="Create group"
                />
                <CustomButton
                  onPress={() => {
                    setIsCreatingGroup(false);
                    setNewGroupName("");
                  }}
                  style={styles.smallButton}
                  text="Cancel"
                  type="secondary"
                />
              </View>
            </View>
          ) : null}
          {error ? dateOptions("Could not load savings movements.") : null}
          {groups.map(group => {
            const groupTotal = group.additions.reduce(
              (total, movement) => total + Number(movement.value || 0),
              0,
            ) -
              group.additions
                .filter(movement => !movement.isRecurringOccurrence)
                .reduce(
                  (total, movement) =>
                    total + Number(movement.savings_used || 0),
                  0,
                ) -
              group.spending
                .filter(movement => movement.date.slice(0, 10) <= today)
                .reduce(
                  (total, movement) => total + Number(movement.value || 0),
                  0,
                );
            return (
              <EntryCard key={group.id ?? "untagged"} title={group.name}>
                {dateOptions(`Available: ${money(groupTotal, currency)}`)}
                <CustomButton
                  onPress={() => addSpending(group)}
                  style={styles.inlineButton}
                  text="Record expense from this group"
                  type="secondary"
                />
                {typeof group.id === "number" ? (
                  <CustomButton
                    onPress={() => confirmDeleteGroup(group)}
                    style={styles.inlineButton}
                    text="Delete savings group"
                    type="warning"
                  />
                ) : null}
                {group.additions.map(movement => (
                  <View key={movement.id} style={styles.savingItem}>
                    {dateOptions(
                      `${formatDisplayDate(movement.date)} · ${movement.name}${
                        movement.isRecurringOccurrence
                          ? " · Recurring contribution"
                          : ""
                      } · ${money(
                        movement.value,
                        currency,
                      )}`,
                    )}
                    {!movement.isRecurringOccurrence ? (
                      <>
                        <CustomText type="body4" text="Amount used from this account's savings" />
                        <CustomTextInput
                          keyboardType="decimal-pad"
                          placeholder="0"
                          setValue={value =>
                            setSavingsUsedDrafts(current => ({
                              ...current,
                              [movement.id]: value,
                            }))
                          }
                          style={styles.inputSpacing}
                          value={String(
                            savingsUsedDrafts[movement.id] ??
                              movement.savings_used ??
                              0,
                          )}
                        />
                        <CustomButton
                          onPress={() => saveSavingsUsed(movement)}
                          style={styles.inlineButton}
                          text="Save amount used"
                          type="secondary"
                        />
                        <CustomButton
                          onPress={() => confirmDeleteMovement(movement)}
                          style={styles.inlineButton}
                          text="Delete movement"
                          type="warning"
                        />
                      </>
                    ) : null}
                    {group.id === null &&
                    !getTagIds(movement).length &&
                    !movement.isRecurringOccurrence &&
                    tagOptions.length ? (
                      <Dropdown
                        data={tagOptions}
                        dropdownPosition="bottom"
                        keyboardAvoiding={false}
                        labelField="label"
                        onChange={item => assignTag(movement, item.value)}
                        placeholder="Assign existing tag"
                        placeholderStyle={dropdownStyles.placeholderText}
                        selectedTextStyle={dropdownStyles.selectedText}
                        style={[dropdownStyles.input, styles.inputSpacing]}
                        value={null}
                        valueField="value"
                      />
                    ) : null}
                  </View>
                ))}
                {group.spending.length ? (
                  <View style={styles.savingItem}>
                    <CustomText type="body4" text="Recorded expenses" />
                    {group.spending.map(movement => (
                      <View key={movement.id}>
                        {dateOptions(
                          `${formatDisplayDate(movement.date)} · ${movement.name} · -${money(
                            movement.inflated_value ?? movement.value,
                            currency,
                          )}`,
                        )}
                      </View>
                    ))}
                  </View>
                ) : null}
              </EntryCard>
            );
          })}
          {groups.length === 0
            ? dateOptions("Mark an expense as savings to create a savings group.")
            : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  groupHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  addGroupButton: {
    minWidth: 48,
    minHeight: 40,
    paddingVertical: 4,
  },
  createGroupForm: {
    marginTop: 12,
  },
});

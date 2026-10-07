import React, { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, View } from "react-native";
import { Dropdown } from "react-native-element-dropdown";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import CustomButton from "../components/customButton/customButton";
import CustomText from "../components/customText/customText";
import CustomTextInput from "../components/customTextInput/customTextInput";
import { dropdownStyles } from "../components/customDropdown/dropdownStylesCustom";
import {
  addSubscription,
  createAccount,
  createTag,
  deleteAccount,
  deleteSubscription,
  getAccountsCreated,
  getAllTags,
  getCashflowData,
  getExpensesBy,
  getLocalDate,
  getSubscriptions,
  setSubscriptionActive,
} from "../utils/database_connector";
import {
  getCashflowProjection,
  subscriptionWouldGoNegativeWithinSixMonths,
} from "../utils/financeCalculations";

const money = (value, currency = "") =>
  `${Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`.trim();

const dateOptions = text => (
  <CustomText type="body1" text={text} style={styles.secondaryText} />
);

function Section({ children, title }) {
  return (
    <View style={styles.section}>
      {title ? <CustomText type="header3" text={title} /> : null}
      {children}
    </View>
  );
}

function EntryCard({ children, title }) {
  return (
    <View style={styles.card}>
      {title ? <CustomText type="body4" text={title} /> : null}
      {children}
    </View>
  );
}

function useFinanceData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const result = await getCashflowData();
      setData(result);
      setError(null);
      return result;
    } catch (loadError) {
      console.error("Failed to load finance data:", loadError);
      setError(loadError);
      return null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  return { data, error, reload };
}

export function AccountsScreen() {
  const { data, error, reload } = useFinanceData();
  const [name, setName] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const currency = data?.salary?.currency || "";
  const projection = useMemo(
    () => (data ? getCashflowProjection(data) : null),
    [data],
  );
  const save = async () => {
    if (!name.trim() || !Number.isFinite(Number(openingBalance))) {
      Alert.alert("Check account details", "Enter a name and valid opening balance.");
      return;
    }
    try {
      await createAccount(name, "#4261a0", Number(openingBalance));
      setName("");
      setOpeningBalance("0");
      await reload();
    } catch (saveError) {
      console.error("Failed to save account:", saveError);
      Alert.alert(
        "Could not add account",
        saveError instanceof Error ? saveError.message : "Please try again.",
      );
    }
  };

  const confirmDelete = account =>
    Alert.alert(
      "Delete account",
      `Delete ${account.name}? Its opening balance, transactions, and scheduled charges will be moved to another account if one exists.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteAccount(account.id);
              await reload();
            } catch (deleteError) {
              console.error("Failed to delete account:", deleteError);
              Alert.alert("Could not delete account", "Please try again.");
            }
          },
        },
      ],
    );

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Accounts" />
        <CustomText
          type="body1"
          text="Keep balances separate for each bank account, card, or cash wallet."
          style={styles.intro}
        />
        <Section title="Your accounts">
          {error ? dateOptions("Could not load accounts. Reopen this section to retry.") : null}
          {data?.accounts.map(account => {
            const accountBalance = projection?.accountBalances.find(
              row => row.id === account.id,
            )?.balance;
            return (
              <EntryCard key={account.id} title={account.name}>
                {dateOptions(money(accountBalance, currency))}
                <CustomButton
                  onPress={() => confirmDelete(account)}
                  style={styles.inlineButton}
                  text="Delete"
                  type="warning"
                />
              </EntryCard>
            );
          })}
          {data?.accounts.length === 0
            ? dateOptions("No accounts yet. Add one below.")
            : null}
        </Section>
        <Section title="Add an account">
          <CustomTextInput
            placeholder="Account name"
            setValue={setName}
            value={name}
          />
          <CustomTextInput
            keyboardType="decimal-pad"
            placeholder="Opening balance"
            setValue={setOpeningBalance}
            style={styles.inputSpacing}
            value={openingBalance}
          />
          <CustomButton onPress={save} style={styles.actionButton} text="Add account" />
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

export function ExpenseGroupsScreen() {
  const { data, error, reload } = useFinanceData();
  const [expenses, setExpenses] = useState([]);
  const [tagName, setTagName] = useState("");
  const currency = data?.salary?.currency || "";

  const reloadExpenses = useCallback(async () => {
    try {
      setExpenses(await getExpensesBy({ kind: "expense" }));
    } catch (loadError) {
      console.error("Failed to load grouped expenses:", loadError);
      Alert.alert("Could not load expenses", "Please try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadExpenses();
    }, [reloadExpenses]),
  );

  const groups = useMemo(() => {
    const result = new Map();
    for (const expense of expenses) {
      const names = expense.tags ? expense.tags.split(", ") : ["Ungrouped"];
      for (const name of names) {
        result.set(
          name,
          (result.get(name) || 0) + Number(expense.value || 0),
        );
      }
    }
    return [...result.entries()].sort(([left], [right]) =>
      left.localeCompare(right),
    );
  }, [expenses]);

  const addGroup = async () => {
    try {
      await createTag(tagName);
      setTagName("");
      await reload();
    } catch (saveError) {
      console.error("Failed to add expense group:", saveError);
      Alert.alert(
        "Could not add group",
        saveError instanceof Error ? saveError.message : "Please try again.",
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Expenses by groups" />
        <CustomText
          type="body1"
          text="Tags bring related spending and savings goals together."
          style={styles.intro}
        />
        <Section title="Spending totals">
          {error ? dateOptions("Could not load grouped expenses.") : null}
          {groups.map(([name, total]) => (
            <EntryCard key={name} title={name}>
              {dateOptions(money(total, currency))}
            </EntryCard>
          ))}
          {groups.length === 0 ? dateOptions("No tagged expenses yet.") : null}
        </Section>
        <Section title="Create a group or savings goal">
          <CustomTextInput
            placeholder="e.g. Groceries, Travel fund"
            setValue={setTagName}
            value={tagName}
          />
          <CustomButton
            onPress={addGroup}
            style={styles.actionButton}
            text="Add group"
          />
        </Section>
        <Section title="Available groups">
          {data?.tags?.map(tag => (
            <EntryCard key={tag.id} title={tag.name} />
          ))}
          {data?.tags?.length === 0 ? dateOptions("No groups created yet.") : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

export function TransactionsScreen({ navigation }) {
  const { data, error } = useFinanceData();
  const [transactions, setTransactions] = useState([]);

  const reloadTransactions = useCallback(async () => {
    try {
      setTransactions(await getExpensesBy());
    } catch (loadError) {
      console.error("Failed to load money variations:", loadError);
      Alert.alert("Could not load transactions", "Please try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadTransactions();
    }, [reloadTransactions]),
  );

  const currency = data?.salary?.currency || "";

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Money variations" />
        <CustomText
          type="body1"
          text="Add income or deductions on any past, current, or future date."
          style={styles.intro}
        />
        <CustomButton
          onPress={() => navigation.navigate("Add general expense")}
          style={styles.actionButton}
          text="Add money variation"
        />
        <Section title="Transactions">
          {error ? dateOptions("Could not load your account settings.") : null}
          {transactions.map(transaction => (
            <EntryCard key={transaction.id} title={transaction.name}>
              {dateOptions(
                `${transaction.date.slice(0, 10)}  ·  ${
                  transaction.kind === "income" ? "+" : "-"
                }${money(
                  transaction.inflated_value ?? transaction.value,
                  currency,
                )}`,
              )}
              {transaction.tags ? dateOptions(transaction.tags) : null}
              {transaction.description ? dateOptions(transaction.description) : null}
            </EntryCard>
          ))}
          {transactions.length === 0 ? dateOptions("No transactions recorded yet.") : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

export function SubscriptionsScreen() {
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

export function BalanceScreen() {
  const { data, error } = useFinanceData();
  const [savings, setSavings] = useState([]);
  const currency = data?.salary?.currency || "";
  const projection = useMemo(
    () => (data ? getCashflowProjection(data) : null),
    [data],
  );

  const reloadSavings = useCallback(async () => {
    try {
      setSavings(await getExpensesBy({ kind: "expense", isSavings: true }));
    } catch (loadError) {
      console.error("Failed to load savings:", loadError);
      Alert.alert("Could not load savings", "Please try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      reloadSavings();
    }, [reloadSavings]),
  );

  const savingsTotal = savings.reduce(
    (sum, item) => sum + Number(item.value || 0),
    0,
  );
  const savingsGroups = useMemo(() => {
    const groups = new Map();
    for (const item of savings) {
      const name = item.tags || "Untagged savings";
      const entries = groups.get(name) || [];
      entries.push(item);
      groups.set(name, entries);
    }
    return [...groups.entries()];
  }, [savings]);

  const monthlyProjection = useMemo(() => {
    if (!projection) {
      return [];
    }
    const months = new Map();
    for (const entry of projection.balances) {
      if (entry.date === getLocalDate()) {
        continue;
      }
      const month = entry.date.slice(0, 7);
      months.set(month, entry.balance);
    }
    return [...months.entries()];
  }, [projection]);

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text="Balance" />
        <CustomText
          type="body1"
          text="Balances include dated transactions and planned subscription charges."
          style={styles.intro}
        />
        {error ? dateOptions("Could not load your balance details.") : null}
        {projection && (
          <EntryCard title="Total available now">
            <CustomText
              type="header2"
              text={money(projection.todayBalance, currency)}
              style={styles.balanceAmount}
            />
          </EntryCard>
        )}
        <Section title="Account balances">
          {projection?.accountBalances.map(account => (
            <EntryCard key={account.id} title={account.name}>
              {dateOptions(money(account.balance, currency))}
            </EntryCard>
          ))}
          {projection && projection.unassignedBalance !== 0 ? (
            <EntryCard title="Unassigned money">
              {dateOptions(money(projection.unassignedBalance, currency))}
            </EntryCard>
          ) : null}
        </Section>
        <Section title="Two-year outlook">
          {projection?.negativeDates.length ? (
            <EntryCard title="Projected negative balance">
              <CustomText
                type="body1"
                text={`Your balance first drops below zero on ${projection.negativeDates[0]}. Review upcoming expenses and income.`}
                style={styles.negativeText}
              />
            </EntryCard>
          ) : (
            <EntryCard title="No negative balance projected">
              {dateOptions(
                `Your projected balance remains at or above zero through ${projection?.throughDate}.`,
              )}
            </EntryCard>
          )}
          {monthlyProjection.map(([month, balance]) => (
            <EntryCard key={month} title={month}>
              <CustomText
                type="body1"
                text={money(balance, currency)}
                style={balance < 0 ? styles.negativeText : styles.secondaryText}
              />
            </EntryCard>
          ))}
        </Section>
        <Section title={`Savings · ${money(savingsTotal, currency)}`}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.savingsList}
          >
            {savingsGroups.map(([group, entries]) => (
              <EntryCard key={group} title={group}>
                {dateOptions(
                  money(
                    entries.reduce((sum, item) => sum + Number(item.value || 0), 0),
                    currency,
                  ),
                )}
                {entries.map(item => (
                  <View key={item.id} style={styles.savingItem}>
                    {dateOptions(
                      `${item.date.slice(0, 10)} · ${item.name} · ${money(
                        item.value,
                        currency,
                      )}`,
                    )}
                  </View>
                ))}
              </EntryCard>
            ))}
            {savings.length === 0
              ? dateOptions("Mark an expense as savings to start tracking a goal.")
              : null}
          </ScrollView>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 36,
  },
  intro: {
    marginTop: 10,
  },
  section: {
    marginTop: 26,
  },
  card: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  secondaryText: {
    marginTop: 6,
  },
  inputSpacing: {
    marginTop: 12,
  },
  actionButton: {
    marginTop: 16,
  },
  inlineButton: {
    alignSelf: "flex-start",
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  smallButton: {
    flex: 1,
  },
  balanceAmount: {
    marginTop: 6,
  },
  negativeText: {
    color: "#B00020",
    marginTop: 6,
  },
  savingsList: {
    maxHeight: 360,
    marginTop: 4,
  },
  savingItem: {
    marginTop: 8,
  },
});

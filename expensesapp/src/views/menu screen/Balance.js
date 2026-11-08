import React, { useEffect, useMemo, useRef, useState } from "react";
import { accountLabel, t, useLanguage } from "../../i18n/i18n";
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import {
  errorCodes,
  isErrorWithCode,
  saveDocuments,
} from "@react-native-documents/picker";
import Dropdown from "../../components/customDropdown/CustomDropdown";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import CustomButton from "../../components/customButton/customButton";
import DatePicker from "../../components/datePicker/DatePicker";
import CustomText from "../../components/customText/customText";
import EditMovementButton from "../../components/editMovementButton/EditMovementButton";
import { dropdownStyles } from "../../components/customDropdown/dropdownStylesCustom";
import { getLocalDate, isValidLocalDate } from "../../utils/database_connector";
import { Dirs, FileSystem } from "react-native-file-access";
import {
  getAccountBalancesOnDate,
  getBalanceOnDate,
  getCashflowProjection,
} from "../../utils/financeCalculations";
import { formatDisplayDate, formatMonthYear } from "../../utils/dateFormatting";
import { getEditTarget } from "../../utils/movementEditTarget";
import {
  getSavingsAvailableAsOfDate,
  getSavingsGroupPlan,
} from "../../utils/savingsCalculations";
import {
  dateOptions,
  EntryCard,
  money,
  plannedTotalLabel,
  Section,
  styles,
  useFinanceData,
} from "./Shared";

const daysBetween = (fromDate, toDate) => {
  const [fromYear, fromMonth, fromDay] = fromDate.split("-").map(Number);
  const [toYear, toMonth, toDay] = toDate.split("-").map(Number);
  return Math.floor(
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86400000,
  );
};

const monthEnd = month => {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(year, monthNumber, 0).getDate();
  return `${month}-${String(lastDay).padStart(2, "0")}`;
};

const isSalaryIncome = event =>
  event.kind === "income" &&
  (event.source === "salary" ||
    String(event.tags || "")
      .split(",")
      .some(tag => tag.trim().toLowerCase() === "salary"));

const movementType = event =>
  event.account_transfer
    ? "account transfer"
    : event.kind === "savings_use"
    ? "savings use"
    : event.subscription
    ? "subscription"
    : event.recurring_deduction || event.recurrence_frequency
      ? "recurring deduction"
      : event.kind === "income"
        ? "income"
        : "deduction";

export default function BalanceScreen() {
  useLanguage();
  const navigation = useNavigation();
  const { data, error } = useFinanceData();
  const [isExportingReport, setIsExportingReport] = useState(false);
  const [rangeMode, setRangeMode] = useState("year");
  const [selectedMonth, setSelectedMonth] = useState(() => getLocalDate().slice(0, 7));
  const [movementFilter, setMovementFilter] = useState("all");
  const [customFrom, setCustomFrom] = useState(() => `${getLocalDate().slice(0, 4)}-01-01`);
  const [customTo, setCustomTo] = useState(() => getLocalDate());
  const [selectedMovement, setSelectedMovement] = useState(null);
  const currency = data?.salary?.currency || "";
  const projection = useMemo(
    () => (data ? getCashflowProjection(data) : null),
    [data],
  );
  const selectedDateRange = useMemo(() => {
    if (rangeMode === "month") {
      return { from: `${selectedMonth}-01`, to: monthEnd(selectedMonth) };
    }
    if (rangeMode === "custom") {
      return { from: customFrom, to: customTo };
    }
    const year = getLocalDate().slice(0, 4);
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }, [customFrom, customTo, rangeMode, selectedMonth]);
  const validDateRange =
    isValidLocalDate(selectedDateRange.from) &&
    isValidLocalDate(selectedDateRange.to) &&
    selectedDateRange.from <= selectedDateRange.to;
  const dashboardHorizon = validDateRange
    ? Math.max(0, daysBetween(getLocalDate(), selectedDateRange.to))
    : 0;
  const dashboardProjection = useMemo(
    () =>
      data && validDateRange
        ? getCashflowProjection(data, new Date(), dashboardHorizon)
        : null,
    [data, dashboardHorizon, validDateRange],
  );
  const rangeMovements = useMemo(() => {
    if (!dashboardProjection || !validDateRange) {
      return [];
    }
    return dashboardProjection.events
      .filter(
        event =>
          (!event.account_transfer || event.kind === "transfer_out") &&
          event.date >= selectedDateRange.from &&
          event.date <= selectedDateRange.to,
      )
      .filter(event => {
        if (movementFilter === "income") {
          return event.kind === "income";
        }
        if (movementFilter === "deduction") {
          return event.kind !== "income" && !event.account_transfer;
        }
        return true;
      })
      .map((event, index) => ({
        ...event,
        key: `${event.date}-${event.name}-${movementType(event)}-${index}`,
      }));
  }, [
    dashboardProjection,
    movementFilter,
    selectedDateRange.from,
    selectedDateRange.to,
    validDateRange,
  ]);
  const balanceAtRangeEnd =
    dashboardProjection && validDateRange
      ? getBalanceOnDate(
          dashboardProjection,
          selectedDateRange.to,
          new Date(),
        )
      : null;
  const startingBalanceDate = useMemo(() => {
    const [year, month, day] = selectedDateRange.from.split("-").map(Number);
    const previousDay = new Date(year, month - 1, day - 1, 12);
    return getLocalDate(previousDay);
  }, [selectedDateRange.from]);
  const startingBalanceBreakdown =
    dashboardProjection && validDateRange
      ? getAccountBalancesOnDate(
          dashboardProjection,
          startingBalanceDate,
          new Date(),
        )
      : null;
  const reportEndingBalance =
    dashboardProjection && validDateRange
      ? getAccountBalancesOnDate(
          dashboardProjection,
          selectedDateRange.to,
          new Date(),
        )
      : null;
  const savingsAvailableOnDate = (date, expenses) => {
    const contributions = expenses.filter(
      item =>
        item.kind === "savings" ||
        (item.kind === "expense" && Number(item.is_savings)),
    );
    const usages = expenses
      .filter(
        item =>
          item.kind === "savings_use" ||
          (item.kind === "expense" &&
            Number(item.is_savings_withdrawal) === 1),
      )
      .filter(item => item.date.slice(0, 10) <= date)
      .reduce((sum, item) => sum + Number(item.value || 0), 0);
    return getSavingsAvailableAsOfDate(contributions, date) - usages;
  };
  const savingsAtRangeStart = data
    ? savingsAvailableOnDate(startingBalanceDate, data.expenses)
    : null;
  const savingsAtRangeEnd =
    data && validDateRange
      ? savingsAvailableOnDate(selectedDateRange.to, data.expenses)
      : null;

  const exportMovementReport = async () => {
    if (
      !data ||
      !dashboardProjection ||
      !startingBalanceBreakdown ||
      !reportEndingBalance ||
      savingsAtRangeStart === null ||
      savingsAtRangeEnd === null
    ) {
      Alert.alert(t("Report unavailable"), t("Load finance data and choose a valid date range before exporting."));
      return;
    }

    setIsExportingReport(true);
    const sourcePath = `${Dirs.CacheDir}/balance-movements-report.json`;
    try {
      const accountNames = new Map(
        data.accounts.map(account => [String(account.id), account.name]),
      );
      const transfersById = new Map(
        (data.accountTransfers || []).map(transfer => [
          String(transfer.id),
          transfer,
        ]),
      );
      const report = {
        format: "expense-planner-app-balance-movements-report",
        version: 1,
        generatedAt: new Date().toISOString(),
        currency,
        filters: {
          rangeMode,
          from: selectedDateRange.from,
          to: selectedDateRange.to,
          movementType: movementFilter,
        },
        startingBalance: {
          asOf: startingBalanceDate,
          total: startingBalanceBreakdown.total,
          accounts: startingBalanceBreakdown.accounts.map(account => ({
            accountId: account.id,
            accountName: account.name,
            balance: account.balance,
          })),
          unassigned: startingBalanceBreakdown.unassignedBalance,
        },
        endingBalance: {
          asOf: selectedDateRange.to,
          total: reportEndingBalance.total,
          accounts: reportEndingBalance.accounts.map(account => ({
            accountId: account.id,
            accountName: account.name,
            balance: account.balance,
          })),
          unassigned: reportEndingBalance.unassignedBalance,
        },
        savings: {
          beginning: {
            asOf: startingBalanceDate,
            available: savingsAtRangeStart,
          },
          ending: {
            asOf: selectedDateRange.to,
            available: savingsAtRangeEnd,
          },
        },
        movements: rangeMovements.map(event => {
          const amount = Number(event.amount ?? event.value ?? 0);
          const projectedAmount = Number(event.inflated_value ?? amount);
          const transfer = event.account_transfer
            ? transfersById.get(String(event.transfer_id))
            : null;
          const incomingTransfer = event.kind === "transfer_in";
          const counterpartAccountId = transfer
            ? incomingTransfer
              ? transfer.from_account_id
              : transfer.to_account_id
            : null;
          return {
            date: event.date,
            name: event.name,
            type: movementType(event),
            kind: event.kind,
            accountId: event.account_id ?? null,
            accountName:
              accountNames.get(String(event.account_id)) || "Unassigned",
            transfer: transfer
              ? {
                  transferId: transfer.id,
                  fromAccountId: transfer.from_account_id,
                  fromAccountName: transfer.from_account_name,
                  toAccountId: transfer.to_account_id,
                  toAccountName: transfer.to_account_name,
                  counterpartAccountId,
                  counterpartAccountName:
                    accountNames.get(String(counterpartAccountId)) || null,
                }
              : null,
            amount: event.kind === "expense" ? projectedAmount : amount,
            actualAmount:
              event.inflated_value !== null &&
              event.inflated_value !== undefined &&
              projectedAmount !== amount
                ? amount
                : null,
            currency,
            isRecurring: Boolean(
              event.recurring_deduction || event.recurrence_frequency,
            ),
            isSubscription: Boolean(event.subscription),
            isAccountTransfer: Boolean(event.account_transfer),
            description: event.description || "",
            source: event.source || null,
            recurrenceFrequency: event.recurrence_frequency || null,
            isSavings: Number(event.is_savings) === 1,
            tagIds: event.tag_ids || "",
            tags: event.tags || "",
          };
        }),
      };

      await FileSystem.writeFile(sourcePath, JSON.stringify(report, null, 2), "utf8");
      const [savedDocument] = await saveDocuments({
        sourceUris: [encodeURI(`file://${sourcePath}`)],
        mimeType: "application/json",
        fileName: `balance-report-${selectedDateRange.from}-to-${selectedDateRange.to}.json`,
        copy: true,
      });
      if (!savedDocument || savedDocument.error) {
        throw new Error(
          savedDocument?.error || t("The balance report could not be saved."),
        );
      }
      Alert.alert(
        t("Report exported"),
        t("Your filtered Balance report was saved as {name}.", {
          name: savedDocument.name || t("a JSON file"),
        }),
      );
    } catch (exportError) {
      if (
        isErrorWithCode(exportError) &&
        exportError.code === errorCodes.OPERATION_CANCELED
      ) {
        return;
      }
      console.error("Balance movement report export failed:", exportError);
      Alert.alert(
        t("Export failed"),
        exportError instanceof Error
          ? exportError.message
          : t("The balance report could not be exported."),
      );
    } finally {
      setIsExportingReport(false);
    }
  };
  const firstNegativeBalanceWarning = useMemo(() => {
    if (!projection) {
      return null;
    }
    const monthEndBalances = new Map();
    for (const entry of projection.balances) {
      monthEndBalances.set(entry.date.slice(0, 7), entry.balance);
    }
    const warnings = [];
    for (const [month, balance] of monthEndBalances) {
      if (balance <= 0) {
        const [year, monthNumber] = month.split("-").map(Number);
        const lastDay = new Date(year, monthNumber, 0).getDate();
        warnings.push({
          date: `${month}-${String(lastDay).padStart(2, "0")}`,
          totalBalance: balance,
        });
        break;
      }
    }
    const firstNegativeAccountDate = projection.negativeAccounts[0]?.date;
    if (firstNegativeAccountDate) {
      warnings.push({ date: firstNegativeAccountDate });
    }
    if (!warnings.length) {
      return null;
    }
    const firstDate = warnings.reduce(
      (earliest, warning) =>
        warning.date < earliest ? warning.date : earliest,
      warnings[0].date,
    );
    return {
      date: firstDate,
      totalBalance: warnings.find(
        warning => warning.date === firstDate && "totalBalance" in warning,
      )?.totalBalance,
      negativeAccounts: projection.negativeAccounts.filter(
        account => account.date === firstDate,
      ),
    };
  }, [projection]);
  const lastAlertedWarning = useRef(null);

  useEffect(() => {
    if (!firstNegativeBalanceWarning) {
      lastAlertedWarning.current = null;
      return;
    }
    const warningKey = [
      firstNegativeBalanceWarning.date,
      firstNegativeBalanceWarning.totalBalance,
      ...firstNegativeBalanceWarning.negativeAccounts.map(
        account => account.accountId,
      ),
    ].join(":");
    if (lastAlertedWarning.current === warningKey) {
      return;
    }
    lastAlertedWarning.current = warningKey;
    console.warn("[Balance warning] Projected balance is zero or below.", {
      warningDate: firstNegativeBalanceWarning.date,
      totalBalance: firstNegativeBalanceWarning.totalBalance,
      negativeAccounts: firstNegativeBalanceWarning.negativeAccounts,
      currentAvailableBalance: projection?.todayBalance,
      availableBalanceInTwoYears: projection?.endingBalance,
    });
    const warningDetails = [];
    if (firstNegativeBalanceWarning.totalBalance !== undefined) {
      warningDetails.push(
        t("Your projected total balance is {amount}.", {
          amount: money(firstNegativeBalanceWarning.totalBalance, currency),
        }),
      );
    }
    for (const account of firstNegativeBalanceWarning.negativeAccounts) {
      warningDetails.push(
        t("{account} is projected to be {amount}.", {
          account: accountLabel(account.accountName),
          amount: money(account.balance, currency),
        }),
      );
    }
    Alert.alert(
      t("Balance warning"),
      `${warningDetails.join("\n")} ${t("This is projected for {date}. Review your planned expenses and income.", {
        date: formatDisplayDate(firstNegativeBalanceWarning.date),
      })}`,
    );
  }, [currency, firstNegativeBalanceWarning, projection]);

  useEffect(() => {
    console.log("[Balance movement dashboard]", {
      range: selectedDateRange,
      movementFilter,
      movements: rangeMovements.map(event => ({
        date: event.date,
        type: movementType(event),
        name: event.name,
        amount: Number(event.amount ?? event.value ?? 0),
        highlightedAsSalary: isSalaryIncome(event),
        highlightedAsSubscription: Boolean(event.subscription),
      })),
      availableBalanceAtRangeEnd: balanceAtRangeEnd,
    });
  }, [balanceAtRangeEnd, movementFilter, rangeMovements, selectedDateRange]);

  const savings = useMemo(
    () =>
      (data?.expenses || []).filter(
        item =>
          item.kind === "savings" ||
          (item.kind === "expense" && Number(item.is_savings)),
      ),
    [data],
  );
  const savingsUsage = useMemo(
    () =>
      (data?.expenses || []).filter(
        item =>
          item.kind === "savings_use" ||
          (item.kind === "expense" &&
            Number(item.is_savings_withdrawal) === 1),
      ),
    [data],
  );
  const savingsTotal =
    getSavingsAvailableAsOfDate(savings, getLocalDate()) -
    savingsUsage
      .filter(item => item.date.slice(0, 10) <= getLocalDate())
      .reduce((sum, item) => sum + Number(item.value || 0), 0);
  const savingsGroups = useMemo(() => {
    const tagNamesById = new Map(
      (data?.tags || []).map(tag => [Number(tag.id), tag.name]),
    );
    const groups = new Map();
    for (const item of savings) {
      const namesFromIds = String(item.tag_ids || "")
        .split(",")
        .filter(Boolean)
        .map(id => tagNamesById.get(Number(id)))
        .filter(Boolean);
      const namesFromJoin = String(item.tags || "")
        .split(",")
        .map(name => name.trim())
        .filter(Boolean);
      // The joined text is only a fallback: a tag name containing a comma
      // would otherwise be split into phantom groups.
      const names = namesFromIds.length ? namesFromIds : namesFromJoin;
      const groupNames = names.length ? names : [t("Untagged savings")];
      for (const name of groupNames) {
        const entries = groups.get(name) || [];
        if (!entries.some(entry => entry.id === item.id)) {
          entries.push(item);
        }
        groups.set(name, entries);
      }
    }
    return [...groups.entries()];
  }, [data?.tags, savings]);

  const renderPlannedTotal = (group, entries) => {
    const groupSpending = savingsUsage.filter(item =>
      String(item.tags || "")
        .split(",")
        .map(name => name.trim().toLocaleLowerCase())
        .includes(group.toLocaleLowerCase()),
    );
    const plan = getSavingsGroupPlan(entries, groupSpending, getLocalDate());
    return plan
      ? dateOptions(plannedTotalLabel(plan, currency))
      : null;
  };

  const selectMovement = event => {
    setSelectedMovement(event);
    const availableBalance = getBalanceOnDate(
      dashboardProjection,
      event.date,
      new Date(),
    );
    console.log("[Balance movement selected]", {
      date: event.date,
      type: movementType(event),
      name: event.name,
      amount: Number(event.amount ?? event.value ?? 0),
      availableBalance,
    });
  };

  const renderAccountBreakdown = (sourceProjection, date) => {
    const breakdown = getAccountBalancesOnDate(
      sourceProjection,
      date,
      new Date(),
    );
    return (
      <>
        {breakdown.accounts.map(account => (
          <View key={account.id}>
            {dateOptions(`${accountLabel(account.name)}: ${money(account.balance, currency)}`)}
          </View>
        ))}
        {breakdown.unassignedBalance !== 0
          ? dateOptions(
              t("Unassigned: {amount}", { amount: money(breakdown.unassignedBalance, currency) }),
            )
          : null}
        {dateOptions(t("Total: {amount}", { amount: money(breakdown.total, currency) }))}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <CustomText type="header2" text={t("Balance")} />
        <CustomText
          type="body1"
          text={t("Balances include dated transactions and planned subscription charges.")}
          style={styles.intro}
        />
        {error ? dateOptions(t("Could not load your balance details.")) : null}
        {projection && (
          <EntryCard title={t("Total available now")}>
            <CustomText
              type="header2"
              text={money(projection.todayBalance, currency)}
              style={styles.balanceAmount}
            />
          </EntryCard>
        )}
        <Section title={t("Account balances")}>
          {projection?.accountBalances.map(account => (
            <EntryCard key={account.id} title={accountLabel(account.name)}>
              {dateOptions(money(account.balance, currency))}
            </EntryCard>
          ))}
          {projection && projection.unassignedBalance !== 0 ? (
            <EntryCard title={t("Unassigned money")}>
              {dateOptions(money(projection.unassignedBalance, currency))}
            </EntryCard>
          ) : null}
        </Section>
        <Section title={t("Savings balances · {amount}", { amount: money(savingsTotal, currency) })}>
          <ScrollView
            nestedScrollEnabled
            showsVerticalScrollIndicator
            style={styles.savingsList}
          >
            {savingsGroups.map(([group, entries]) => (
              <EntryCard key={group} title={group}>
                {dateOptions(
                  money(
                    getSavingsAvailableAsOfDate(entries, getLocalDate()) -
                      savingsUsage
                        .filter(item => {
                          const usageTagNames = String(item.tags || "")
                            .split(",")
                            .map(name => name.trim().toLocaleLowerCase())
                            .filter(Boolean);
                          return (
                            usageTagNames.includes(group.toLocaleLowerCase()) &&
                            item.date.slice(0, 10) <= getLocalDate()
                          );
                        })
                        .reduce(
                          (sum, item) => sum + Number(item.value || 0),
                          0,
                        ),
                    currency,
                  ),
                )}
                {renderPlannedTotal(group, entries)}
                {entries.map(item => (
                  <View key={item.id} style={styles.savingItem}>
                    {dateOptions(
                      `${formatDisplayDate(item.date)} · ${item.name} · ${money(
                        item.value,
                        currency,
                      )}`,
                    )}
                  </View>
                ))}
              </EntryCard>
            ))}
            {savings.length === 0
              ? dateOptions(t("Mark an expense as savings to start tracking a goal."))
              : null}
          </ScrollView>
        </Section>
        <Section>
          <View style={dashboardStyles.headingRow}>
            <CustomText
              type="header3"
              text={t("Movement dashboard")}
              style={dashboardStyles.heading}
            />
            <CustomButton
              text={isExportingReport ? t("Exporting...") : t("Export JSON")}
              type="secondary"
              fontSize={13}
              disabled={
                isExportingReport ||
                !data ||
                !validDateRange ||
                !dashboardProjection
              }
              onPress={exportMovementReport}
              style={dashboardStyles.exportButton}
            />
          </View>
          <Dropdown
            data={[
              { label: t("All year"), value: "year" },
              { label: t("By month"), value: "month" },
              { label: t("Custom range"), value: "custom" },
            ]}
            labelField="label"
            onChange={item => {
              setRangeMode(item.value);
              setSelectedMovement(null);
            }}
            placeholder={t("Date range")}
            placeholderStyle={dropdownStyles.placeholderText}
            selectedTextStyle={dropdownStyles.selectedText}
            style={dashboardStyles.dropdown}
            value={rangeMode}
            valueField="value"
          />
          {rangeMode === "month" ? (
            <Dropdown
              data={Array.from({ length: 12 }, (_, index) => {
                const month = `${getLocalDate().slice(0, 4)}-${String(index + 1).padStart(2, "0")}`;
                return {
                  label: formatMonthYear(
                    new Date(Number(month.slice(0, 4)), index, 1, 12),
                  ),
                  value: month,
                };
              })}
              labelField="label"
              onChange={item => {
                setSelectedMonth(item.value);
                setSelectedMovement(null);
              }}
              placeholder={t("Select month")}
              placeholderStyle={dropdownStyles.placeholderText}
              selectedTextStyle={dropdownStyles.selectedText}
              style={dashboardStyles.dropdown}
              value={selectedMonth}
              valueField="value"
            />
          ) : null}
          {rangeMode === "custom" ? (
            <View style={dashboardStyles.dateRange}>
              <DatePicker
                placeholder={t("From date")}
                setValue={value => {
                  setCustomFrom(value);
                  setSelectedMovement(null);
                }}
                style={dashboardStyles.dateInput}
                value={customFrom}
              />
              <DatePicker
                placeholder={t("To date")}
                setValue={value => {
                  setCustomTo(value);
                  setSelectedMovement(null);
                }}
                style={dashboardStyles.dateInput}
                value={customTo}
              />
            </View>
          ) : null}
          <Dropdown
            data={[
              { label: t("All movements"), value: "all" },
              { label: t("Deductions"), value: "deduction" },
              { label: t("Incomes"), value: "income" },
            ]}
            labelField="label"
            onChange={item => {
              setMovementFilter(item.value);
              setSelectedMovement(null);
            }}
            placeholder={t("Movement type")}
            placeholderStyle={dropdownStyles.placeholderText}
            selectedTextStyle={dropdownStyles.selectedText}
            style={dashboardStyles.dropdown}
            value={movementFilter}
            valueField="value"
          />
          {!validDateRange ? (
            dateOptions(t("Enter valid dates and make sure the start is not after the end."))
          ) : (
            <ScrollView
              nestedScrollEnabled
              showsVerticalScrollIndicator
              style={dashboardStyles.movementList}
            >
              {rangeMovements.map(event => {
                const type = movementType(event);
                const amount = Number(event.amount ?? event.value ?? 0);
                const projectedAmount = Number(
                  event.inflated_value ?? amount,
                );
                const sign = event.account_transfer
                  ? "↔ "
                  : event.kind === "income"
                    ? "+"
                    : "-";
                const highlightedSalary = isSalaryIncome(event);
                return (
                  <View
                    key={event.key}
                    style={[
                      dashboardStyles.movementRow,
                      selectedMovement?.key === event.key &&
                        dashboardStyles.selectedMovement,
                    ]}
                  >
                  <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => selectMovement(event)}
                    style={dashboardStyles.movementItem}
                  >
                    <CustomText
                      type="body1"
                      text={`${formatDisplayDate(event.date)} · ${event.name} · ${sign}${money(event.kind === "expense" ? projectedAmount : amount, currency)}${type === "subscription" ? t(" · Subscription") : type === "recurring deduction" ? t(" · Recurring deduction") : type === "account transfer" ? t(" · Account transfer") : ""}`}
                      style={[
                        dashboardStyles.movementText,
                        highlightedSalary && dashboardStyles.salaryIncome,
                        type === "subscription" && dashboardStyles.subscription,
                      ]}
                    />
                    {event.kind === "expense" &&
                    event.inflated_value !== null &&
                    event.inflated_value !== undefined &&
                    projectedAmount !== amount ? (
                      <CustomText
                        type="body5"
                        text={t("Actual Value: {amount}", { amount: money(amount, currency) })}
                        style={dashboardStyles.actualValue}
                      />
                    ) : null}
                  </TouchableOpacity>
                  <EditMovementButton
                    label={t("Edit {name}", { name: event.name })}
                    onPress={() =>
                      navigation.navigate("Edit movement", {
                        movement: getEditTarget(event),
                      })
                    }
                  />
                  </View>
                );
              })}
              {rangeMovements.length === 0
                ? dateOptions(t("No movements match this date range and type."))
                : null}
            </ScrollView>
          )}
          {balanceAtRangeEnd !== null ? (
            <EntryCard title={t("Total available by {date}", { date: formatDisplayDate(selectedDateRange.to) })}>
              {renderAccountBreakdown(
                dashboardProjection,
                selectedDateRange.to,
              )}
            </EntryCard>
          ) : null}
          {selectedMovement && dashboardProjection ? (
            <EntryCard title={t("Total available by · {date}", { date: formatDisplayDate(selectedMovement.date) })}>
              {renderAccountBreakdown(
                dashboardProjection,
                selectedMovement.date,
              )}
            </EntryCard>
          ) : null}
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

const dashboardStyles = StyleSheet.create({
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heading: {
    flex: 1,
  },
  exportButton: {
    minHeight: 40,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  dropdown: {
    ...dropdownStyles.input,
    marginTop: 12,
  },
  dateRange: {
    gap: 8,
    marginTop: 12,
  },
  dateInput: {
    marginTop: 4,
  },
  movementList: {
    maxHeight: 240,
    marginTop: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  movementRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
  },
  movementItem: {
    flex: 1,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  selectedMovement: {
    backgroundColor: "rgba(66,97,160,0.18)",
  },
  movementText: {
    marginTop: 0,
  },
  actualValue: {
    marginTop: 2,
    paddingHorizontal: 8,
  },
  salaryIncome: {
    color: "#248A3D",
  },
  subscription: {
    color: "#8A5A2B",
  },
});
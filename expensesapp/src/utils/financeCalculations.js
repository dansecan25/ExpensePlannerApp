import { getLocalDate } from "./database_connector";
import { getRecurringDeductionOccurrenceDates } from "./recurringDeductionSchedule";
import { getSubscriptionOccurrenceDates } from "./subscriptionSchedule";

const DAY_MS = 24 * 60 * 60 * 1000;
const daysUntilCalendarDate = (fromDate, months, years) => {
  const startingDate = dateAtNoon(getLocalDate(fromDate));
  const target = new Date(startingDate);
  const day = target.getDate();
  target.setDate(1);
  target.setMonth(target.getMonth() + months);
  target.setFullYear(target.getFullYear() + years);
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(day, lastDay));
  return Math.round((target - startingDate) / DAY_MS);
};
const DEFAULT_TAX_BRACKETS = [
  { min_salary: 918000, max_salary: 1347000, percentage: 10 },
  { min_salary: 1347000, max_salary: 2364000, percentage: 15 },
  { min_salary: 2364000, max_salary: 4727000, percentage: 20 },
  { min_salary: 4727000, max_salary: null, percentage: 25 },
];

const dateAtNoon = value => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const asDateString = value =>
  typeof value === "string" ? value.slice(0, 10) : getLocalDate(value);

const getMainAccountId = accounts =>
  accounts.find(
    account => account.name.trim().toLocaleLowerCase() === "main account",
  )?.id ?? null;

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const monthDate = (year, month, day) =>
  new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12);

export const getPreLastAvailableDay = (year, month) => {
  const date = new Date(year, month + 1, 0, 12);
  const weekday = date.getDay();
  const daysBeforeMonthEnd = {
    0: 4,
    1: 3,
    2: 1,
    3: 1,
    4: 1,
    5: 1,
    6: 2,
  }[weekday];
  date.setDate(date.getDate() - daysBeforeMonthEnd);
  return date;
};

export const getSalaryScheduleForDate = (data, date = new Date()) => {
  if (!data.salary) {
    return null;
  }
  const dateString = asDateString(date);
  const schedule = [
    {
      effective_date: data.salary.last_deposit
        ? asDateString(data.salary.last_deposit)
        : dateString,
      amount: data.salary.amount,
      income_type: data.salary.fixed ? "fixed" : "variable",
      deposits_date: data.salary.deposits_date,
      fixed_day: data.salary.fixed_day,
      account_id: data.salary.account_id,
    },
    ...(data.salaryChanges || []),
  ]
    .filter(change => change.effective_date <= dateString)
    .sort((left, right) =>
      left.effective_date.localeCompare(right.effective_date),
    );
  return schedule[schedule.length - 1] || null;
};

export const getSalaryDeductions = (grossSalary, brackets, otherTaxes) => {
  if (!(grossSalary > 0)) {
    return 0;
  }
  const taxBrackets = brackets?.length ? brackets : DEFAULT_TAX_BRACKETS;
  const incomeTax = taxBrackets.reduce((sum, bracket) => {
    const upper = bracket.max_salary === null ? grossSalary : bracket.max_salary;
    const taxableAmount = Math.max(
      0,
      Math.min(grossSalary, upper) - bracket.min_salary,
    );
    return sum + taxableAmount * (bracket.percentage / 100);
  }, 0);
  const contributions = (otherTaxes || []).reduce(
    (sum, tax) => sum + grossSalary * (tax.percentage / 100),
    0,
  );
  return incomeTax + contributions;
};

const createIncomeEvents = (data, projectionThroughDate) => {
  const { salary } = data;
  if (!salary) {
    return [];
  }
  const events = [];
  const salaryAccountId = getMainAccountId(data.accounts);
  const initialEffectiveDate = salary.last_deposit
    ? asDateString(salary.last_deposit)
    : getLocalDate();
  const schedule = [
    {
      effective_date: initialEffectiveDate,
      amount: Number(salary.amount || 0),
      income_type: salary.fixed ? "fixed" : "variable",
      deposits_date: salary.deposits_date,
      fixed_day: salary.fixed_day,
      account_id: salary.account_id,
    },
    ...(data.salaryChanges || []).map(change => ({
      ...change,
      amount: Number(change.amount || 0),
    })),
  ].sort((left, right) =>
    left.effective_date.localeCompare(right.effective_date),
  );
  const through = dateAtNoon(projectionThroughDate);
  const savingsModeEnabled =
    salary.savings_mode_enabled === true ||
    Number(salary.savings_mode_enabled) === 1;
  const savingsModeAmount = savingsModeEnabled
    ? Math.max(0, Number(salary.savings_mode_amount || 0))
    : 0;

  for (let index = 0; index < schedule.length; index += 1) {
    const current = schedule[index];
    if (
      current.income_type !== "fixed" ||
      !(current.amount > 0) ||
      !current.deposits_date
    ) {
      continue;
    }
    const effective = dateAtNoon(current.effective_date);
    const nextEffective = schedule[index + 1]
      ? dateAtNoon(schedule[index + 1].effective_date)
      : null;
    const netMonthly = Math.max(
      0,
      current.amount -
        getSalaryDeductions(
          current.amount,
          data.salaryDeductions,
          data.otherTaxes,
        ) -
        savingsModeAmount,
    );
    const firstMonth = new Date(
      effective.getFullYear(),
      effective.getMonth(),
      1,
      12,
    );
    for (
      let month = firstMonth;
      month <= through;
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12)
    ) {
      const dates =
        current.deposits_date === "Quincenal"
          ? [
              {
                date: monthDate(month.getFullYear(), month.getMonth(), 15),
                amount: netMonthly / 2,
              },
              {
                date: new Date(month.getFullYear(), month.getMonth() + 1, 0, 12),
                amount: netMonthly / 2,
              },
            ]
          : [
              {
                date:
                  current.deposits_date === "Last day of month"
                    ? new Date(month.getFullYear(), month.getMonth() + 1, 0, 12)
                    : current.deposits_date === "Pre last day of month"
                      ? getPreLastAvailableDay(month.getFullYear(), month.getMonth())
                      : current.deposits_date === "Fixed date"
                        ? monthDate(
                            month.getFullYear(),
                            month.getMonth(),
                            current.fixed_day || 1,
                          )
                        : null,
                amount: netMonthly,
              },
            ];
      for (const deposit of dates) {
        if (!deposit.date) {
          continue;
        }
        const date = getLocalDate(deposit.date);
        if (
          deposit.date < effective ||
          (index === 0 && date === initialEffectiveDate) ||
          (nextEffective && deposit.date >= nextEffective)
        ) {
          continue;
        }
        events.push({
          date,
          amount: deposit.amount,
          kind: "income",
          name: "Salary",
          source: "salary",
          account_id: current.account_id ?? salaryAccountId,
        });
      }
    }
  }
  return events;
};

const createSubscriptionEvents = (subscription, fromDate, throughDate) => {
  if (!subscription.active) {
    return [];
  }
  return getSubscriptionOccurrenceDates(
    subscription,
    fromDate,
    throughDate,
  ).map(date => ({
    date,
    amount: Number(subscription.amount),
    kind: Number(subscription.is_savings) === 1 ? "savings" : "expense",
    name: subscription.name,
    account_id: subscription.account_id,
    tag_id: subscription.tag_id,
    is_savings: subscription.is_savings,
    subscription: true,
  }));
};

const createRecurringDeductionEvents = (deduction, fromDate, throughDate) =>
  getRecurringDeductionOccurrenceDates(
    deduction,
    fromDate,
    throughDate,
  ).map(date => ({
    date,
    amount: Number(deduction.amount ?? deduction.value),
    inflated_value: deduction.inflated_value,
    kind: deduction.kind === "savings" ? "savings" : "expense",
    name: deduction.name,
    account_id: deduction.account_id,
    recurrence_frequency: deduction.recurrence_frequency,
    recurrence_end_date: deduction.recurrence_end_date,
    recurrence_active: deduction.recurrence_active,
    recurrence_stopped_date: deduction.recurrence_stopped_date,
    is_savings: deduction.is_savings,
    tags: deduction.tags,
    tag_ids: deduction.tag_ids,
    recurring_deduction: true,
    source_expense_id: deduction.id ?? null,
  }));

const signedAmount = event => {
  const amount = Number(event.amount ?? event.value ?? 0);
  if (
    event.kind === "savings_use" ||
    Number(event.is_savings_withdrawal) === 1
  ) {
    return 0;
  }
  if (event.kind === "transfer_in") {
    return Math.abs(amount);
  }
  if (event.kind === "transfer_out") {
    return -Math.abs(amount);
  }
  if (event.kind === "income") {
    return Math.abs(amount);
  }
  const deduction = Number(event.inflated_value ?? amount);
  return -Math.abs(deduction);
};

const getEventType = event => {
  if (event.kind === "transfer_in" || event.kind === "transfer_out") {
    return "account transfer";
  }
  if (event.kind === "savings_use") {
    return "savings use";
  }
  if (event.subscription) {
    return "subscription";
  }
  if (event.recurring_deduction || event.recurrence_frequency) {
    return "recurring deduction";
  }
  return event.kind === "income" ? "income" : "deduction";
};

const makeEvents = (data, fromDate, throughDate, extra = {}) => {
  const endDate = getLocalDate(addDays(dateAtNoon(fromDate), throughDate));
  const recurringStartDate = `${fromDate.slice(0, 7)}-01`;
  const subscriptionStartDate = `${fromDate.slice(0, 7)}-01`;
  const events = [
    ...data.expenses
      .filter(event => {
        const date = asDateString(event.date);
        return date <= endDate;
      })
      .map(event => ({ ...event, date: asDateString(event.date) })),
    ...data.expenses.flatMap(event =>
      event.kind === "income" ||
      event.kind === "savings_use" ||
      !event.recurrence_frequency ||
      (Number(event.recurrence_active ?? 1) !== 1 &&
        !event.recurrence_stopped_date)
        ? []
        : createRecurringDeductionEvents(
            event,
            recurringStartDate,
            endDate,
          ),
    ),
    ...createIncomeEvents(data, endDate).filter(event => event.date <= endDate),
    ...data.subscriptions.flatMap(subscription =>
      createSubscriptionEvents(
        subscription,
        subscriptionStartDate,
        endDate,
      ),
    ),
    ...(data.accountTransfers || []).flatMap(transfer => {
      const firstDate = asDateString(transfer.date);
      const stoppedDate = transfer.recurrence_stopped_date
        ? asDateString(transfer.recurrence_stopped_date)
        : null;
      const recurrenceIsActive = Number(transfer.recurrence_active ?? 1) === 1;
      const keepFirstOccurrence =
        recurrenceIsActive || !stoppedDate || firstDate <= stoppedDate;
      const repeatDates = transfer.recurrence_frequency
        ? getRecurringDeductionOccurrenceDates(
            transfer,
            recurringStartDate,
            endDate,
          )
        : [];
      const transferDates = [
        ...(keepFirstOccurrence ? [firstDate] : []),
        ...repeatDates,
      ];
      return transferDates.map(date => [
        {
          date,
          amount: Number(transfer.amount),
          kind: "transfer_out",
          name: `Transfer to ${transfer.to_account_name || "account"}`,
          account_id: transfer.from_account_id,
          account_transfer: true,
          transfer_id: transfer.id,
          recurrence_frequency: transfer.recurrence_frequency,
        },
        {
          date,
          amount: Number(transfer.amount),
          kind: "transfer_in",
          name: `Transfer from ${transfer.from_account_name || "account"}`,
          account_id: transfer.to_account_id,
          account_transfer: true,
          transfer_id: transfer.id,
          recurrence_frequency: transfer.recurrence_frequency,
        },
      ]);
    }).flat(),
  ];
  if (extra.event) {
    const candidateDate = asDateString(extra.event.date);
    if (candidateDate <= endDate) {
      const candidate = { ...extra.event, date: candidateDate };
      events.push(candidate);
      if (candidate.recurrence_frequency) {
        events.push(
          ...createRecurringDeductionEvents(
            candidate,
            recurringStartDate,
            endDate,
          ),
        );
      }
    }
  }
  if (extra.subscription) {
    events.push(
      ...createSubscriptionEvents(
        { ...extra.subscription, active: true },
        subscriptionStartDate,
        endDate,
      ),
    );
  }
  const mainAccountId = getMainAccountId(data.accounts);
  return events
    .map(event =>
      event.account_id === null || event.account_id === undefined
        ? { ...event, account_id: mainAccountId }
        : event,
    )
    .sort((left, right) => left.date.localeCompare(right.date));
};

export const getCashflowProjection = (
  data,
  asOf = new Date(),
  horizonDays = daysUntilCalendarDate(asOf, 0, 2),
  extra = {},
) => {
  const today = getLocalDate(asOf);
  const throughDate = getLocalDate(addDays(dateAtNoon(today), horizonDays));
  const accountOpening = data.accounts.reduce(
    (sum, account) => sum + Number(account.opening_balance || 0),
    0,
  );
  const startingBalance =
    data.accounts.length && accountOpening !== 0
      ? accountOpening
      : Number(data.salary?.balance || 0);
  const events = makeEvents(data, today, horizonDays, extra);
  const byDate = new Map();
  for (const event of events) {
    const dated = byDate.get(event.date) || [];
    dated.push(event);
    byDate.set(event.date, dated);
  }

  const balances = [];
  const accountBalances = new Map(
    data.accounts.map(account => [
      account.id,
      Number(account.opening_balance || 0),
    ]),
  );
  const mainAccountId = getMainAccountId(data.accounts);
  if (mainAccountId !== null && accountOpening === 0 && startingBalance !== 0) {
    accountBalances.set(
      mainAccountId,
      Number(accountBalances.get(mainAccountId) || 0) + startingBalance,
    );
  }

  let balance = startingBalance;
  const firstNegativeAccountBalances = new Map();
  for (const event of events) {
    if (event.date >= today) {
      break;
    }
    const delta = signedAmount(event);
    balance += delta;
    if (event.account_id !== null && event.account_id !== undefined) {
      accountBalances.set(
        event.account_id,
        Number(accountBalances.get(event.account_id) || 0) + delta,
      );
    }
  }
  const accountBalancesToday = new Map(accountBalances);
  let todayBalance = balance;
  for (
    let date = dateAtNoon(today);
    getLocalDate(date) <= throughDate;
    date = addDays(date, 1)
  ) {
    const dateString = getLocalDate(date);
    for (const event of byDate.get(dateString) || []) {
      const delta = signedAmount(event);
      balance += delta;
      if (event.account_id !== null && event.account_id !== undefined) {
        accountBalances.set(
          event.account_id,
          Number(accountBalances.get(event.account_id) || 0) + delta,
        );
      }
    }
    for (const account of data.accounts) {
      const accountBalance = Number(accountBalances.get(account.id) || 0);
      if (
        accountBalance < 0 &&
        !firstNegativeAccountBalances.has(String(account.id))
      ) {
        firstNegativeAccountBalances.set(String(account.id), {
          date: dateString,
          accountId: account.id,
          accountName: account.name,
          balance: accountBalance,
        });
      }
    }
    if (dateString === today) {
      todayBalance = balance;
      accountBalancesToday.clear();
      for (const [accountId, accountBalance] of accountBalances) {
        accountBalancesToday.set(accountId, accountBalance);
      }
    }
    balances.push({ date: dateString, balance });
  }

  const accountRows = data.accounts.map(account => ({
    ...account,
    balance: Number(accountBalancesToday.get(account.id) || 0),
  }));
  const assignedBalances = accountRows.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  const eventsByDate = new Map();
  for (const event of events) {
    const dateEvents = eventsByDate.get(event.date) || [];
    dateEvents.push(event);
    eventsByDate.set(event.date, dateEvents);
  }
  const balanceAfterEventDates = balances
    .filter(entry => eventsByDate.has(entry.date))
    .map(entry => ({
      date: entry.date,
      availableBalance: entry.balance,
      events: eventsByDate.get(entry.date).map(event => ({
        type: getEventType(event),
        name: event.name,
        amount: Math.abs(signedAmount(event)),
        change: signedAmount(event),
        accountId: event.account_id ?? null,
      })),
    }));
  let historicalBalance = startingBalance;
  const historicalBalanceAfterEventDates = [];
  for (const [date, dateEvents] of eventsByDate) {
    if (date >= today) {
      continue;
    }
    for (const event of dateEvents) {
      historicalBalance += signedAmount(event);
    }
    historicalBalanceAfterEventDates.push({
      date,
      availableBalance: historicalBalance,
      events: dateEvents.map(event => ({
        type: getEventType(event),
        name: event.name,
        amount: Math.abs(signedAmount(event)),
        change: signedAmount(event),
        accountId: event.account_id ?? null,
      })),
    });
  }
  const projectionResult = {
    todayBalance,
    endingBalance: balances[balances.length - 1]?.balance ?? startingBalance,
    accountBalances: accountRows,
    unassignedBalance: todayBalance - assignedBalances,
    balances,
    events,
    negativeDates: balances
      .filter(entry => entry.date >= today && entry.balance < 0)
      .map(entry => entry.date),
    negativeAccounts: [...firstNegativeAccountBalances.values()].sort(
      (left, right) => left.date.localeCompare(right.date),
    ),
    throughDate,
  };

  console.log("[Finance projection]", {
    asOf: today,
    salary: data.salary
      ? {
          grossMonthlyAmount: data.salary.amount,
          fixed: Boolean(data.salary.fixed),
          paySchedule: data.salary.deposits_date,
          salaryProfileDate: data.salary.last_deposit,
          deductions: getSalaryDeductions(
            Number(data.salary.amount || 0),
            data.salaryDeductions,
            data.otherTaxes,
          ),
          savingsModeEnabled:
            data.salary.savings_mode_enabled === true ||
            Number(data.salary.savings_mode_enabled) === 1,
          savingsModeMonthlyAmount: Number(
            data.salary.savings_mode_amount || 0,
          ),
        }
      : null,
    currentAvailableBalance: todayBalance,
    scheduledEvents: events.map(event => ({
      date: event.date,
      type: getEventType(event),
      name: event.name,
      amount: Math.abs(signedAmount(event)),
      change: signedAmount(event),
      accountId: event.account_id ?? null,
    })),
    balanceAfterPastEventDates: historicalBalanceAfterEventDates,
    balanceAfterEventDates,
    twoYearDate: throughDate,
    availableBalanceInTwoYears: projectionResult.endingBalance,
    firstNegativeDate: projectionResult.negativeDates[0] ?? null,
  });
  if (projectionResult.negativeDates.length) {
    console.warn("[Finance projection warning] Negative balance projected.", {
      firstNegativeDate: projectionResult.negativeDates[0],
      currentAvailableBalance: todayBalance,
      availableBalanceInTwoYears: projectionResult.endingBalance,
    });
  }
  return projectionResult;
};

export const getBalanceBeforeDate = (projection, date, asOf = new Date()) => {
  const today = getLocalDate(asOf);
  return (
    projection.todayBalance +
    projection.events
      .filter(event => event.date > today && event.date < date)
      .reduce((balance, event) => balance + signedAmount(event), 0)
  );
};

export const getBalanceOnDate = (projection, date, asOf = new Date()) => {
  const today = getLocalDate(asOf);
  if (date >= today) {
    return (
      projection.todayBalance +
      projection.events
        .filter(event => event.date > today && event.date <= date)
        .reduce((balance, event) => balance + signedAmount(event), 0)
    );
  }
  return (
    projection.todayBalance -
    projection.events
      .filter(event => event.date > date && event.date <= today)
      .reduce((balance, event) => balance + signedAmount(event), 0)
  );
};

export const getAccountBalancesOnDate = (
  projection,
  date,
  asOf = new Date(),
) => {
  const today = getLocalDate(asOf);
  const accounts = projection.accountBalances.map(account => ({
    ...account,
    balance: Number(account.balance || 0),
  }));
  const accountBalances = new Map(
    accounts.map(account => [String(account.id), account.balance]),
  );
  const accountEvents =
    date >= today
      ? projection.events.filter(event => event.date > today && event.date <= date)
      : projection.events.filter(event => event.date > date && event.date <= today);

  for (const event of accountEvents) {
    if (event.account_id === null || event.account_id === undefined) {
      continue;
    }
    const accountId = String(event.account_id);
    const currentBalance = Number(accountBalances.get(accountId) || 0);
    const delta = signedAmount(event);
    accountBalances.set(
      accountId,
      currentBalance + (date >= today ? delta : -delta),
    );
  }

  const accountRows = accounts.map(account => ({
    ...account,
    balance: Number(accountBalances.get(String(account.id)) || 0),
  }));
  const total = getBalanceOnDate(projection, date, asOf);
  const assignedTotal = accountRows.reduce(
    (sum, account) => sum + account.balance,
    0,
  );
  return {
    accounts: accountRows,
    unassignedBalance: total - assignedTotal,
    total,
  };
};

const getAffordabilityRisk = (projection, description) => {
  const negativeAccount = projection.negativeAccounts[0] ?? null;
  const negativeDate = projection.negativeDates[0] ?? null;
  const wouldGoNegative = Boolean(negativeAccount || negativeDate);
  const risk = {
    wouldGoNegative,
    negativeDate,
    negativeAccount,
    projection,
  };
  console.log(`[${description} affordability check]`, {
    currentAvailableBalance: projection.todayBalance,
    availableBalanceAtEndOfCheck: projection.endingBalance,
    checkThroughDate: projection.throughDate,
    firstNegativeDate: negativeDate,
    firstNegativeAccount: negativeAccount,
    wouldGoNegative,
  });
  return risk;
};

export const getDeductionAffordabilityRiskWithinSixMonths = (
  data,
  candidateEvent,
) => {
  const projection = getCashflowProjection(
    data,
    new Date(),
    daysUntilCalendarDate(new Date(), 6, 0),
    {
      event: candidateEvent,
    },
  );
  const risk = getAffordabilityRisk(projection, "Deduction");
  console.log("[Deduction affordability event]", {
    event: {
      name: candidateEvent.name,
      type: candidateEvent.kind === "income" ? "income" : "deduction",
      date: candidateEvent.date,
      amount: Number(candidateEvent.amount ?? candidateEvent.value ?? 0),
    },
  });
  if (risk.wouldGoNegative) {
    console.warn("[Deduction affordability warning] Negative balance risk detected.", {
      name: candidateEvent.name,
      date: candidateEvent.date,
      amount: Number(candidateEvent.amount ?? candidateEvent.value ?? 0),
      firstNegativeDate: risk.negativeDate,
      firstNegativeAccount: risk.negativeAccount,
    });
  }
  return risk;
};

export const wouldGoNegativeWithinSixMonths = (data, candidateEvent) =>
  getDeductionAffordabilityRiskWithinSixMonths(data, candidateEvent)
    .wouldGoNegative;

export const getSubscriptionAffordabilityRiskWithinSixMonths = (
  data,
  subscription,
) => {
  const projection = getCashflowProjection(
    data,
    new Date(),
    daysUntilCalendarDate(new Date(), 6, 0),
    { subscription },
  );
  const risk = getAffordabilityRisk(projection, "Subscription");
  console.log("[Subscription affordability details]", {
    subscription: {
      name: subscription.name,
      amount: Number(subscription.amount),
      startDate: subscription.start_date,
      frequency: subscription.frequency,
      type: "subscription",
    },
    grossMonthlySalary: data.salary?.amount ?? null,
  });
  if (risk.wouldGoNegative) {
    console.warn("[Subscription affordability warning] Negative balance risk detected.", {
      subscriptionName: subscription.name,
      subscriptionAmount: Number(subscription.amount),
      firstNegativeDate: risk.negativeDate,
      firstNegativeAccount: risk.negativeAccount,
    });
  }
  return risk;
};

export const subscriptionWouldGoNegativeWithinSixMonths = (
  data,
  subscription,
) =>
  getSubscriptionAffordabilityRiskWithinSixMonths(data, subscription)
    .wouldGoNegative;

export const getProjectionWarning = data => {
  const projection = getCashflowProjection(data);
  return {
    projection,
    firstNegativeDate: projection.negativeDates[0] ?? null,
  };
};

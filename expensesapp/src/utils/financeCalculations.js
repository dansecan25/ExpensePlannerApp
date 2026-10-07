import { getLocalDate } from "./database_connector";
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

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const monthDate = (year, month, day) =>
  new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12);

const getPreLastAvailableDay = (year, month) => {
  const date = new Date(year, month + 1, 0, 12);
  date.setDate(date.getDate() - 1);
  if (date.getDay() === 0) {
    date.setDate(date.getDate() - 2);
  } else if (date.getDay() === 6) {
    date.setDate(date.getDate() - 1);
  }
  return date;
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

const createIncomeEvents = data => {
  const { salary } = data;
  if (!salary || !salary.fixed || !(salary.amount > 0) || !salary.deposits_date) {
    return [];
  }

  const netMonthly = Math.max(
    0,
    salary.amount -
      getSalaryDeductions(
        salary.amount,
        data.salaryDeductions,
        data.otherTaxes,
      ),
  );
  const events = [];
  const salaryAccountId =
    data.accounts.find(account => account.name === "Main account")?.id ??
    data.accounts[0]?.id ??
    null;
  const setupDate = salary.last_deposit
    ? asDateString(salary.last_deposit)
    : getLocalDate();
  const from = dateAtNoon(setupDate);
  const today = getLocalDate();
  const projectionAnchor = today > setupDate ? today : setupDate;
  const through = addDays(
    dateAtNoon(projectionAnchor),
    daysUntilCalendarDate(new Date(), 0, 2) + 32,
  );

  if (salary.deposits_date === "Quincenal") {
    for (
      let month = new Date(from.getFullYear(), from.getMonth(), 1, 12);
      month <= through;
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12)
    ) {
      const dates = [
        monthDate(month.getFullYear(), month.getMonth(), 15),
        new Date(month.getFullYear(), month.getMonth() + 1, 0, 12),
      ];
      for (const date of dates) {
        if (date > from) {
          events.push({
            date: getLocalDate(date),
            amount: netMonthly / 2,
            kind: "income",
            name: "Salary",
            source: "salary",
            account_id: salaryAccountId,
          });
        }
      }
    }
    return events;
  }

  for (
    let month = new Date(from.getFullYear(), from.getMonth(), 1, 12);
    month <= through;
    month = new Date(month.getFullYear(), month.getMonth() + 1, 1, 12)
  ) {
    let date;
    if (salary.deposits_date === "Last day of month") {
      date = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
    } else if (salary.deposits_date === "Pre last day of month") {
      date = getPreLastAvailableDay(month.getFullYear(), month.getMonth());
    } else if (salary.deposits_date === "Fixed date") {
      date = monthDate(
        month.getFullYear(),
        month.getMonth(),
        salary.fixed_day || 1,
      );
    } else {
      continue;
    }
    if (date > from) {
      events.push({
        date: getLocalDate(date),
        amount: netMonthly,
        kind: "income",
        name: "Salary",
        source: "salary",
        account_id: salaryAccountId,
      });
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
    kind: "expense",
    name: subscription.name,
    account_id: subscription.account_id,
    tag_id: subscription.tag_id,
    is_savings: subscription.is_savings,
    subscription: true,
  }));
};

const signedAmount = event => {
  const amount = Number(event.amount ?? event.value ?? 0);
  if (event.kind === "income") {
    return Math.abs(amount);
  }
  const deduction = Number(event.inflated_value ?? amount);
  return -Math.abs(deduction);
};

const makeEvents = (data, fromDate, throughDate, extra = {}) => {
  const startDate = data.salary?.last_deposit
    ? asDateString(data.salary.last_deposit)
    : fromDate;
  const endDate = getLocalDate(addDays(dateAtNoon(fromDate), throughDate));
  const events = [
    ...data.expenses
      .filter(event => {
        const date = asDateString(event.date);
        return date >= startDate && date <= endDate;
      })
      .map(event => ({ ...event, date: asDateString(event.date) })),
    ...createIncomeEvents(data).filter(event => event.date <= endDate),
    ...data.subscriptions.flatMap(subscription =>
      createSubscriptionEvents(
        subscription,
        fromDate,
        endDate,
      ),
    ),
  ];
  if (extra.event) {
    const candidateDate = asDateString(extra.event.date);
    if (candidateDate >= startDate && candidateDate <= endDate) {
      events.push({ ...extra.event, date: candidateDate });
    }
  }
  if (extra.subscription) {
    events.push(
      ...createSubscriptionEvents(
        { ...extra.subscription, active: true },
        fromDate,
        endDate,
      ),
    );
  }
  return events.sort((left, right) => left.date.localeCompare(right.date));
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
  if (data.accounts.length && accountOpening === 0 && startingBalance !== 0) {
    accountBalances.set(
      data.accounts[0].id,
      Number(accountBalances.get(data.accounts[0].id) || 0) + startingBalance,
    );
  }

  let balance = startingBalance;
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

  return {
    todayBalance,
    endingBalance: balances[balances.length - 1]?.balance ?? startingBalance,
    accountBalances: accountRows,
    unassignedBalance: todayBalance - assignedBalances,
    balances,
    events,
    negativeDates: balances
      .filter(entry => entry.date >= today && entry.balance < 0)
      .map(entry => entry.date),
    throughDate,
  };
};

export const wouldGoNegativeWithinSixMonths = (data, candidateEvent) => {
  const projection = getCashflowProjection(
    data,
    new Date(),
    daysUntilCalendarDate(new Date(), 6, 0),
    {
      event: candidateEvent,
    },
  );
  return projection.balances.some(entry => entry.balance < 0);
};

export const subscriptionWouldGoNegativeWithinSixMonths = (
  data,
  subscription,
) => {
  const projection = getCashflowProjection(
    data,
    new Date(),
    daysUntilCalendarDate(new Date(), 6, 0),
    { subscription },
  );
  return projection.balances.some(entry => entry.balance < 0);
};

export const getProjectionWarning = data => {
  const projection = getCashflowProjection(data);
  return {
    projection,
    firstNegativeDate: projection.negativeDates[0] ?? null,
  };
};

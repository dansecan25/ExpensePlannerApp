jest.mock("../src/utils/database_connector", () => ({
  getLocalDate: date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  },
}));

const {
  getBalanceBeforeDate,
  getCashflowProjection,
  getSalaryDeductions,
  subscriptionWouldGoNegativeWithinSixMonths,
  wouldGoNegativeWithinSixMonths,
} = require("../src/utils/financeCalculations");
const {
  getSubscriptionOccurrenceDates,
} = require("../src/utils/subscriptionSchedule");

const emptyData = overrides => ({
  salary: null,
  expenses: [],
  accounts: [{ id: 1, name: "Main account", opening_balance: 100 }],
  subscriptions: [],
  salaryDeductions: [],
  otherTaxes: [],
  ...overrides,
});

describe("cash-flow calculations", () => {
  test("carries dated transactions forward and flags the first negative date", () => {
    const projection = getCashflowProjection(
      emptyData({
        expenses: [
          {
            id: 1,
            date: "2026-01-03",
            name: "Planned purchase",
            value: 120,
            kind: "expense",
            account_id: 1,
          },
          {
            id: 2,
            date: "2026-01-04",
            name: "Payment",
            value: 30,
            kind: "income",
            account_id: 1,
          },
        ],
      }),
      new Date(2026, 0, 1, 12),
      5,
    );

    expect(projection.todayBalance).toBe(100);
    expect(projection.negativeDates[0]).toBe("2026-01-03");
    expect(projection.balances.find(row => row.date === "2026-01-04").balance).toBe(10);
    expect(projection.accountBalances[0].balance).toBe(100);
  });

  test("includes recorded income dated before the salary profile date", () => {
    const projection = getCashflowProjection(
      emptyData({
        salary: {
          amount: 1000,
          balance: 0,
          last_deposit: "2026-10-06",
          fixed: 1,
          deposits_date: "Pre last day of month",
          fixed_day: null,
        },
        expenses: [
          {
            id: 1,
            date: "2026-09-30",
            name: "Recorded income",
            value: 20800,
            kind: "income",
            account_id: null,
          },
        ],
      }),
      new Date(2026, 9, 2, 12),
    );

    expect(projection.todayBalance).toBe(20800);
  });

  test("includes recorded income in the balance before the next salary payment", () => {
    const asOf = new Date(2026, 9, 2, 12);
    const projection = getCashflowProjection(
      emptyData({
        accounts: [{ id: 1, name: "Main account", opening_balance: 0 }],
        salary: {
          amount: 1000,
          balance: 0,
          last_deposit: "2026-10-06",
          fixed: 1,
          deposits_date: "Pre last day of month",
          fixed_day: null,
        },
        expenses: [
          {
            id: 1,
            date: "2026-09-30",
            name: "Recorded income",
            value: 20800,
            kind: "income",
            account_id: null,
          },
        ],
      }),
      asOf,
    );

    expect(getBalanceBeforeDate(projection, "2026-10-29", asOf)).toBe(20800);
  });

  test("blocks a deduction that makes the six-month balance negative", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const candidateDate = [
      tomorrow.getFullYear(),
      String(tomorrow.getMonth() + 1).padStart(2, "0"),
      String(tomorrow.getDate()).padStart(2, "0"),
    ].join("-");
    const data = emptyData();
    expect(
      wouldGoNegativeWithinSixMonths(data, {
        date: candidateDate,
        name: "Large purchase",
        amount: 101,
        kind: "expense",
        account_id: 1,
      }),
    ).toBe(true);
  });

  test("keeps 8,800 CRC monthly subscriptions affordable on a 1,320,000 CRC salary", () => {
    const today = new Date();
    const todayString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const data = emptyData({
      salary: {
        amount: 1320000,
        balance: 0,
        last_deposit: todayString,
        fixed: 1,
        deposits_date: "Pre last day of month",
        fixed_day: null,
      },
      subscriptions: [
        {
          id: 1,
          name: "Crunchyroll",
          amount: 3000,
          start_date: todayString,
          frequency: "monthly",
          interval_days: null,
          active: 1,
          account_id: 1,
        },
      ],
    });

    expect(
      subscriptionWouldGoNegativeWithinSixMonths(data, {
        name: "Google One",
        amount: 5800,
        start_date: todayString,
        frequency: "monthly",
        interval_days: null,
        active: true,
        account_id: 1,
      }),
    ).toBe(false);
  });

  test("applies progressive Hacienda brackets and configured CCSS", () => {
    const deductions = getSalaryDeductions(
      1500000,
      [
        { min_salary: 918000, max_salary: 1347000, percentage: 10 },
        { min_salary: 1347000, max_salary: 2364000, percentage: 15 },
      ],
      [{ name: "CCSS", percentage: 10 }],
    );
    expect(deductions).toBe(215850);
  });
});

describe("subscription schedules", () => {
  test("keeps a monthly end-of-month schedule on each month's last day", () => {
    expect(
      getSubscriptionOccurrenceDates(
        {
          start_date: "2026-01-31",
          frequency: "monthly",
        },
        "2026-01-01",
        "2026-04-30",
      ),
    ).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });
});

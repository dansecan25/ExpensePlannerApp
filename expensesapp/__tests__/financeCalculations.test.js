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
  getAccountBalancesOnDate,
  getCashflowProjection,
  getPreLastAvailableDay,
  getSalaryDeductions,
  subscriptionWouldGoNegativeWithinSixMonths,
  wouldGoNegativeWithinSixMonths,
} = require("../src/utils/financeCalculations");
const {
  getSubscriptionOccurrenceDates,
} = require("../src/utils/subscriptionSchedule");
const {
  getRecurringDeductionOccurrenceDates,
} = require("../src/utils/recurringDeductionSchedule");
const {
  getSavingsAvailableAsOfDate,
} = require("../src/utils/savingsCalculations");
const { formatDisplayDate } = require("../src/utils/dateFormatting");

describe("display date formatting", () => {
  test("formats date values as DD MON YYYY without timezone shifts", () => {
    expect(formatDisplayDate("2026-10-07")).toBe("07 Oct 2026");
    expect(formatDisplayDate("2026-01-02T00:00:00.000Z")).toBe("02 Jan 2026");
  });

  test("leaves invalid date values unchanged", () => {
    expect(formatDisplayDate("not-a-date")).toBe("not-a-date");
  });
});

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
  test("assigns transactions without an account to Main account", () => {
    const projection = getCashflowProjection(
      emptyData({
        accounts: [
          { id: 1, name: "Main account", opening_balance: 100 },
          { id: 2, name: "BAC", opening_balance: 50 },
        ],
        expenses: [
          {
            id: 1,
            date: "2026-01-03",
            name: "Unassigned deduction",
            value: 10,
            kind: "expense",
            account_id: null,
          },
          {
            id: 2,
            date: "2026-01-04",
            name: "BAC income",
            value: 5,
            kind: "income",
            account_id: 2,
          },
          {
            id: 3,
            date: "2026-01-05",
            name: "Unassigned income",
            value: 7,
            kind: "income",
            account_id: null,
          },
        ],
      }),
      new Date(2026, 0, 1, 12),
      5,
    );

    expect(projection.accountBalances).toEqual([
      { id: 1, name: "Main account", opening_balance: 100, balance: 100 },
      { id: 2, name: "BAC", opening_balance: 50, balance: 50 },
    ]);
    expect(projection.unassignedBalance).toBe(0);
    expect(projection.events.map(event => event.account_id)).toEqual([1, 2, 1]);
    expect(
      getAccountBalancesOnDate(
        projection,
        "2026-01-05",
        new Date(2026, 0, 1, 12),
      ).accounts,
    ).toEqual([
      { id: 1, name: "Main account", opening_balance: 100, balance: 97 },
      { id: 2, name: "BAC", opening_balance: 50, balance: 55 },
    ]);
  });

  test("calculates account balances before and after dated movements", () => {
    const projection = {
      todayBalance: 160,
      accountBalances: [
        { id: 1, name: "Checking", balance: 100 },
        { id: 2, name: "Savings", balance: 60 },
      ],
      events: [
        {
          date: "2026-01-08",
          kind: "income",
          amount: 10,
          account_id: 2,
        },
        {
          date: "2026-01-12",
          kind: "expense",
          amount: 20,
          account_id: 1,
        },
      ],
    };

    expect(
      getAccountBalancesOnDate(
        projection,
        "2026-01-12",
        new Date(2026, 0, 10, 12),
      ),
    ).toEqual({
      accounts: [
        { id: 1, name: "Checking", balance: 80 },
        { id: 2, name: "Savings", balance: 60 },
      ],
      unassignedBalance: 0,
      total: 140,
    });
    expect(
      getAccountBalancesOnDate(
        projection,
        "2026-01-08",
        new Date(2026, 0, 10, 12),
      ),
    ).toEqual({
      accounts: [
        { id: 1, name: "Checking", balance: 100 },
        { id: 2, name: "Savings", balance: 50 },
      ],
      unassignedBalance: 0,
      total: 150,
    });
  });

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

  test("deducts subscription occurrences already due earlier this month", () => {
    const data = emptyData({
      accounts: [{ id: 1, name: "Main account", opening_balance: 20800 }],
      subscriptions: [
        {
          id: 1,
          name: "Crunchyroll",
          amount: 3000,
          start_date: "2026-10-02",
          frequency: "monthly",
          interval_days: null,
          active: 1,
          account_id: 1,
        },
      ],
    });
    const projection = getCashflowProjection(data, new Date(2026, 9, 7, 12), 60);

    expect(projection.todayBalance).toBe(17800);
    expect(projection.accountBalances[0].balance).toBe(17800);
    expect(
      projection.events.filter(event => event.subscription).map(event => event.date),
    ).toEqual(["2026-10-02", "2026-11-02", "2026-12-02"]);
  });

  test("includes a past-due occurrence when checking a new subscription", () => {
    const today = new Date();
    const asOf = new Date(today.getFullYear(), today.getMonth(), 7, 12);
    const year = asOf.getFullYear();
    const month = String(asOf.getMonth() + 1).padStart(2, "0");
    const subscription = {
      name: "Subscription due earlier this month",
      amount: 3000,
      start_date: `${year}-${month}-02`,
      frequency: "monthly",
      interval_days: null,
      active: true,
      account_id: 1,
    };

    expect(
      subscriptionWouldGoNegativeWithinSixMonths(
        emptyData({
          accounts: [{ id: 1, name: "Main account", opening_balance: 2500 }],
        }),
        subscription,
      ),
    ).toBe(true);
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

  test("reduces projected net salary by the monthly Savings mode amount", () => {
    const today = new Date();
    const todayString = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, "0"),
      String(today.getDate()).padStart(2, "0"),
    ].join("-");
    const projection = getCashflowProjection(
      emptyData({
        salary: {
          amount: 100000,
          balance: 0,
          last_deposit: todayString,
          fixed: 1,
          deposits_date: "Last day of month",
          fixed_day: null,
          savings_mode_enabled: 1,
          savings_mode_amount: 10000,
        },
      }),
      today,
    );
    const nextSalaryDeposit = projection.events.find(
      event => event.source === "salary",
    );

    expect(nextSalaryDeposit.amount).toBe(90000);
  });

  test("applies future salary changes from their effective date", () => {
    const projection = getCashflowProjection(
      emptyData({
        salary: {
          amount: 100000,
          balance: 0,
          last_deposit: "2026-10-01",
          fixed: 1,
          deposits_date: "Last day of month",
          fixed_day: null,
        },
        salaryChanges: [
          {
            effective_date: "2026-11-01",
            amount: 200000,
            income_type: "fixed",
            deposits_date: "Last day of month",
            fixed_day: null,
          },
        ],
      }),
      new Date(2026, 9, 2, 12),
      90,
    );

    expect(
      projection.events.find(event => event.date === "2026-10-31").amount,
    ).toBe(100000);
    expect(
      projection.events.find(event => event.date === "2026-11-30").amount,
    ).toBe(200000);
  });

  test("stops projected deposits when a future salary schedule becomes unemployed", () => {
    const projection = getCashflowProjection(
      emptyData({
        salary: {
          amount: 100000,
          balance: 0,
          last_deposit: "2026-10-01",
          fixed: 1,
          deposits_date: "Last day of month",
          fixed_day: null,
        },
        salaryChanges: [
          {
            effective_date: "2026-11-01",
            amount: null,
            income_type: "unemployed",
            deposits_date: null,
            fixed_day: null,
          },
        ],
      }),
      new Date(2026, 9, 2, 12),
      90,
    );

    expect(projection.events.some(event => event.date === "2026-10-31")).toBe(true);
    expect(projection.events.some(event => event.date === "2026-11-30")).toBe(false);
  });
});

describe("subscription schedules", () => {
  test("uses the requested pre-last deposit weekday rule", () => {
    const asDate = value =>
      `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
        value.getDate(),
      ).padStart(2, "0")}`;

    expect(asDate(getPreLastAvailableDay(2026, 9))).toBe("2026-10-29");
    expect(asDate(getPreLastAvailableDay(2026, 10))).toBe("2026-11-27");
    expect(asDate(getPreLastAvailableDay(2026, 4))).toBe("2026-05-28");
    expect(asDate(getPreLastAvailableDay(2026, 6))).toBe("2026-07-30");
    expect(asDate(getPreLastAvailableDay(2026, 11))).toBe("2026-12-30");
    expect(asDate(getPreLastAvailableDay(2026, 1))).toBe("2026-02-26");
  });

  describe("recurring deduction schedules", () => {
    test("clamps monthly dates to month end and restores the original day", () => {
      expect(
        getRecurringDeductionOccurrenceDates(
          {
            date: "2026-01-30",
            recurrence_frequency: "monthly",
          },
          "2026-01-01",
          "2026-03-31",
        ),
      ).toEqual(["2026-02-28", "2026-03-30"]);
    });

    describe("savings availability", () => {
      test("counts recurring savings only on or after each scheduled date", () => {
        const movement = {
          id: 7,
          date: "2026-10-02",
          value: 3000,
          recurrence_frequency: "monthly",
          recurrence_active: 1,
        };

        expect(getSavingsAvailableAsOfDate([movement], "2026-10-01")).toBe(0);
        expect(getSavingsAvailableAsOfDate([movement], "2026-10-02")).toBe(3000);
        expect(getSavingsAvailableAsOfDate([movement], "2026-11-01")).toBe(3000);
        expect(getSavingsAvailableAsOfDate([movement], "2026-11-02")).toBe(6000);
      });

      test("respects inclusive end and stop dates for recurring savings", () => {
        expect(
          getSavingsAvailableAsOfDate(
            [
              {
                date: "2026-10-02",
                value: 3000,
                recurrence_frequency: "monthly",
                recurrence_end_date: "2026-11-02",
              },
            ],
            "2026-12-02",
          ),
        ).toBe(6000);
        expect(
          getSavingsAvailableAsOfDate(
            [
              {
                date: "2026-10-02",
                value: 3000,
                recurrence_frequency: "monthly",
                recurrence_active: 0,
                recurrence_stopped_date: "2026-11-01",
              },
            ],
            "2026-12-02",
          ),
        ).toBe(3000);
      });
    });

    test("stops generating occurrences after the inclusive end date", () => {
      expect(
        getRecurringDeductionOccurrenceDates(
          {
            date: "2026-10-02",
            recurrence_frequency: "monthly",
            recurrence_end_date: "2026-12-02",
          },
          "2026-10-01",
          "2027-03-01",
        ),
      ).toEqual(["2026-11-02", "2026-12-02"]);
    });

    test("generates weekly and yearly occurrences from the selected date", () => {
      expect(
        getRecurringDeductionOccurrenceDates(
          { date: "2026-10-02", recurrence_frequency: "weekly" },
          "2026-10-01",
          "2026-10-23",
        ),
      ).toEqual(["2026-10-09", "2026-10-16", "2026-10-23"]);
      expect(
        getRecurringDeductionOccurrenceDates(
          { date: "2024-02-29", recurrence_frequency: "yearly" },
          "2024-01-01",
          "2027-12-31",
        ),
      ).toEqual(["2025-02-28", "2026-02-28", "2027-02-28"]);
    });

    test("includes future occurrences in cash-flow projection without duplicating the first deduction", () => {
      const data = emptyData({
        accounts: [{ id: 1, name: "Main account", opening_balance: 20800 }],
        expenses: [
          {
            id: 10,
            date: "2026-10-02",
            name: "Rent",
            value: 3000,
            kind: "expense",
            account_id: 1,
            recurrence_frequency: "monthly",
          },
        ],
      });
      const projection = getCashflowProjection(
        data,
        new Date(2026, 9, 7, 12),
        60,
      );

      expect(projection.todayBalance).toBe(17800);
      expect(
        projection.events
          .filter(event => event.recurring_deduction)
          .map(event => event.date),
      ).toEqual(["2026-11-02", "2026-12-02"]);
    });

    test("checks every recurring occurrence in the six-month deduction guard", () => {
      const today = new Date();
      const todayString = [
        today.getFullYear(),
        String(today.getMonth() + 1).padStart(2, "0"),
        String(today.getDate()).padStart(2, "0"),
      ].join("-");

      expect(
        wouldGoNegativeWithinSixMonths(
          emptyData({
            accounts: [{ id: 1, name: "Main account", opening_balance: 6000 }],
          }),
          {
            date: todayString,
            name: "Rent",
            amount: 3000,
            account_id: 1,
            kind: "expense",
            recurrence_frequency: "monthly",
          },
        ),
      ).toBe(true);
    });

    test("does not project recurring deductions after they have been halted", () => {
      const projection = getCashflowProjection(
        emptyData({
          accounts: [{ id: 1, name: "Main account", opening_balance: 20800 }],
          expenses: [
            {
              id: 10,
              date: "2026-10-02",
              name: "Rent",
              value: 3000,
              kind: "expense",
              account_id: 1,
              recurrence_frequency: "monthly",
              recurrence_active: 0,
            },
          ],
        }),
        new Date(2026, 9, 7, 12),
        60,
      );

      expect(projection.todayBalance).toBe(17800);
      expect(projection.events.some(event => event.recurring_deduction)).toBe(false);
    });
  });

  test("includes earlier subscription occurrences within the selected month", () => {
    expect(
      getSubscriptionOccurrenceDates(
        {
          start_date: "2026-10-02",
          frequency: "monthly",
        },
        "2026-10-01",
        "2026-10-31",
      ),
    ).toEqual(["2026-10-02"]);
  });

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

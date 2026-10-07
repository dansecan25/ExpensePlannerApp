# Expense Planner App: Product Context

## Purpose

The app is a personal cash-flow and expense planner. It should help a user understand
money available now and before the next pay date, record past/current/future money
movements, and anticipate whether scheduled income and expenses will leave a negative
balance. User data must persist between app launches in the local SQLite database.

## First launch and setup

1. Ask for the user's starting balance: the money available when they begin using
   the app.
2. Ask how income works:
   - **Fixed salary:** collect the salary amount and pay schedule. The user can choose
     a quinquenal/every-15-days schedule, the last day of the month, a specific day
     of the month, or the pre-last available day of the month. The pre-last available
     day should account for weekends as the existing app does.
   - **Variable income:** allow the user to record each month's income manually;
     income may depend on work/jobs that become available. A monthly estimate may
     be offered, but must not be treated as a guaranteed deposit.
3. Show the existing deductions configuration for Costa Rica (Hacienda income-tax
   brackets and CCSS). Preserve the current configuration and allow it to be
   reviewed/configured.
4. After setup, open Home. On later launches, open Home directly when setup is
   already complete.

The app's existing typeface should not be changed.

## Home

Home is the main view and should retain the current visual direction shown in
`BaseData/Screenshots/Screenshot_20261006_210856.png`. It contains:

- A summary of money available before the next payment.
- A summary/list of today's expenses, with an **Add** action.
- A summary/list of this month's expenses.
- The hamburger menu for reaching the app's other areas.

Move the database restart/factory-reset action from Home to Settings. Reset should
clear the app's stored configuration and data and return the user to first-launch
setup.

## Expenses and money movements

The Add Expense form should follow
`BaseData/Screenshots/AddExpenseUnExpanded.png` and
`BaseData/Screenshots/AddExpenseExpandeedVals.png`. It collects:

- Name and amount.
- Optional description.
- Optional account.
- Optional tag/group.
- Optional inflated amount. When present, use the inflated amount for the
  user's perceived available balance/saving projection, while retaining the
  actual amount as the real transaction amount.

Adding an expense from today's Home section dates it to the user's current local
date. Saved data includes the date.

Money variations provide a more general transaction entry for any past, present,
or future date. A variation can be income received (increases balance) or a
deduction (purchase, subscription charge, or other outflow; decreases balance).

## Accounts and expense groups

- Users can create and manage multiple accounts to keep balances separate.
- Expenses and money variations can optionally be assigned to an account.
- Tags group related expenses. The expense-groups view should let users inspect
  spending by tag/group.

## Subscriptions

Users can create recurring deductions assigned to an account. Recurrence supports
monthly, annual, and custom schedules, with a specified deduction day/date pattern.
Scheduled deductions must participate in forward cash-flow projections.

## Balance and savings

The Balance view shows each stored account's current balance and the combined
balance as of now.

It also projects dated income and outflows, including planned future expenses and
subscription deductions. Warn the user if the projection becomes negative at any
point in the next two years. Before accepting a new deduction, reject it when the
resulting projection would put the user in a negative balance within the next six
months.

The Balance view includes a scrollable savings section. Expenses marked as savings
are listed and totaled as saved money. Savings entries are grouped by their tag so
users can track separate purposes (for example, different savings goals).

## Settings and navigation

The hamburger menu should open and display correctly and provide access to:

- Home
- Accounts
- Expenses by groups
- Money variations
- Subscriptions
- Balance (including savings)
- Settings (including factory reset)

## Cash-flow calculation reference

`BaseData/GastosAnualesCopy.xlsx` is the reference for the planner's cash-flow
calculations. Its month columns represent a chronological schedule, with rows for
days of the month. A month's opening amount is combined with dated entries for that
month; positive entries represent money received and negative entries represent
money spent. The ending balance is carried forward as the next month's opening
amount. The workbook also includes pay-date deposits and recurring costs across
multiple years, so future-dated entries must affect projections rather than only
historical/monthly summaries.

At a minimum, the app's equivalent calculation should be:

```text
balance on date = starting/current balance
                + income dated on or before that date
                - deductions dated on or before that date
```

When projecting an expense that has an inflated value, use the inflated amount for
available-balance planning; preserve the actual amount separately for reporting.
Recurring subscriptions should be expanded to their scheduled occurrence dates
within the projection window. Respect the configured salary cadence and
Costa Rican deductions when calculating fixed-salary income. Variable salary is
included only when the user records it (an estimate is not a guaranteed inflow).

## Persistence and implementation notes

SQLite is the app's local source of truth. Persist setup, balances, accounts, tags,
expenses/money variations, subscription schedules, and savings classifications so
they remain available after closing and reopening the app. Existing screens and
components use React Native and the current shared text/button controls; extend
those conventions where practical.

## Reference UI assets

- `BaseData/Screenshots/Screenshot_20261006_210557.png` — first-launch setup.
- `BaseData/Screenshots/Screenshot_20261006_210856.png` — Home.
- `BaseData/Screenshots/AddExpenseUnExpanded.png` — Add Expense without inflation.
- `BaseData/Screenshots/AddExpenseExpandeedVals.png` — Add Expense with inflation.

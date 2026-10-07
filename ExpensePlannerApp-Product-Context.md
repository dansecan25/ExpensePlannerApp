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
     of the month, or the pre-last available day of the month. For pre-last
     deposits, schedule Thursday when month-end is Friday, Saturday, or Sunday;
     Wednesday when month-end is Thursday; the preceding Friday when month-end is
     Monday; and the preceding day when month-end is Tuesday or Wednesday.
     Treat the entered amount as gross monthly salary; apply configured progressive
     income tax and other deductions, then split the estimated net pay across the two
     monthly deposits for an every-15-days schedule.
   - **Variable income:** allow the user to record each month's income manually;
     income may depend on work/jobs that become available. A monthly estimate may
     be offered, but must not be treated as a guaranteed deposit.
3. Show the existing deductions configuration for Costa Rica (Hacienda income-tax
   brackets and CCSS). Preserve the current configuration and allow it to be
   reviewed/configured.
4. After setup, open Home. On later launches, open Home directly when setup is
   already complete. If the app is closed between income setup and deduction
   configuration, resume at deduction configuration rather than creating another
   profile or skipping setup.

The app's existing typeface should not be changed. Settings can schedule income
status, salary amount, and deposit-date changes to take effect immediately or from
a specified current/future date. Variable-income and unemployed periods do not
generate automatic salary deposits; a later fixed-salary schedule resumes deposits
from its effective date.

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
Deduction forms may mark an expense as recurring weekly, monthly, or yearly.
The selected date is the first occurrence. Later monthly or yearly occurrences
clamp to the final valid day of a shorter month (for example, the 30th becomes
the 28th or 29th in February), while subsequent months continue using the
original day where possible. A recurrence can end on an optional date or be
stopped from Money variations. The original deduction remains in history when
future recurrence is stopped. Recurring deductions are independent of
subscriptions and participate in balances and projections.

## Accounts and tags

- Users can create and manage multiple accounts to keep balances separate.
- Expenses and money variations can optionally be assigned to an account.
- Tags group related expenses and subscriptions. Users can search/select an
  existing tag or type a new tag name and press Enter to create it. New tags
  support a preset or hexadecimal color.
- The expenses-by-groups view reports spending grouped by tag.

## Subscriptions

Users can create recurring deductions assigned to an account. Recurrence supports
monthly, annual, and custom schedules, with a specified deduction day/date pattern.
Scheduled deductions must participate in forward cash-flow projections.

## Balance and savings

The Balance view shows each stored account's current balance and the combined
balance as of now.

It also projects dated income and outflows, including planned future expenses and
subscription deductions. Do not show a month-by-month projection list. Instead,
show an alert when the projected closing balance for any month from the current
month through the next two years is zero or below. Before accepting a new
deduction, reject it when the resulting projection would put the user in a
negative balance within the next six months.

The Balance view shows the total saved amount and a scrollable savings section.
Expenses marked as savings are listed and totaled as saved money. Savings entries
are grouped by their tag so users can track separate purposes (for example,
different savings goals).

The Savings Movements screen lists savings additions by group, lets users record
an expense against a group, and supports deleting an individual addition or a
group. Users can create a savings group from this screen. Deleting a group
removes its tag from savings additions but preserves the movements as untagged
savings.
Show savings available as of today, counting a recurring contribution only on
its scheduled occurrence date and reducing the saved amount by expenses
explicitly recorded from a savings group. Also list recurring savings and their
assigned accounts.

At the end of the Balance view, provide a movement dashboard with all-year
(current rolling window) as the default date range: from today's date one year
ago through the last day of the current year. Group movements by month and year,
and show repeating transactions in a separate list from one-time transactions.
Also provide a month selector and a custom date range, with the displayed list
limited to the same rolling window. Allow filtering the movement list to all
movements, deductions, or incomes. Show the selected range's ending balance and,
when a movement is selected, the balance on that movement's date, broken down by
account and followed by the total. Assign transactions without a selected
account to Main account; explicitly selected accounts such as BAC retain their
own balances.
Highlight salary income (including manually recorded income tagged "Salary") in
green and subscriptions in brown.

## Settings and navigation

The hamburger menu should open and display correctly and provide access to:

- Home
- Accounts
- Expenses by groups
- Money variations
- Subscriptions
- Balance (including savings)
- Settings (including fixed monthly salary updates, factory reset, JSON database
  backup export, and full database restore from a JSON backup)

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
within the projection window. If a subscription's scheduled occurrence falls
earlier in the current month than today's date, include that missed occurrence
when calculating today's available balance. Do not backfill occurrences from
previous months as ledger transactions. Respect the configured salary cadence and
Costa Rican deductions when calculating fixed-salary income. Variable salary is
included only when the user records it (an estimate is not a guaranteed inflow).
Treat six months and two years as calendar periods when checking the deduction guard
and warning horizon. Subscription entries affect projections from their configured
start date and do not automatically create ledger entries.

Settings also provides an optional Savings mode for fixed salary projections. When
enabled, subtract the configured monthly amount from net projected salary before
applying the existing deposit schedule. This is a mental budgeting adjustment only:
it must not create a transaction or change the actual recorded account balance.

## Persistence and implementation notes

SQLite is the app's local source of truth. Persist setup, balances, accounts, tags,
expenses/money variations, subscription schedules, and savings classifications so
they remain available after closing and reopening the app. Existing screens and
components use React Native and the current shared text/button controls; extend
those conventions where practical.

Display dates throughout the app as `DD MON YYYY` (for example, `07 Oct 2026`).
Keep editable date inputs in their existing `YYYY-MM-DD` format.

Existing installations should be migrated in place when adding finance columns and
tables. Keep legacy expense rows readable as deductions, and treat their date as the
user-local calendar date even when the stored value includes an ISO timestamp.

## Reference UI assets

- `BaseData/Screenshots/Screenshot_20261006_210557.png` — first-launch setup.
- `BaseData/Screenshots/Screenshot_20261006_210856.png` — Home.
- `BaseData/Screenshots/AddExpenseUnExpanded.png` — Add Expense without inflation.
- `BaseData/Screenshots/AddExpenseExpandeedVals.png` — Add Expense with inflation.

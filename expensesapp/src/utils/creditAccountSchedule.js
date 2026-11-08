import { getLocalDate } from "./database_connector";
import { getAccountBalancesOnDate } from "./financeCalculations";

const DAY_MS = 24 * 60 * 60 * 1000;

export const isCreditAccount = account => account?.account_type === "credit";

// Days past the end of a short month fall on its last day.
const dayInMonth = (year, month, day) =>
  new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12);

const dateAtNoon = value => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const paymentDueAfterCut = (cut, paymentDay) => {
  const sameMonth = dayInMonth(cut.getFullYear(), cut.getMonth(), paymentDay);
  return sameMonth > cut
    ? sameMonth
    : dayInMonth(cut.getFullYear(), cut.getMonth() + 1, paymentDay);
};

const getOwedOn = (projection, accountId, date, asOf) => {
  const balance = getAccountBalancesOnDate(projection, date, asOf).accounts.find(
    row => row.id === accountId,
  )?.balance;
  return Math.max(0, -Number(balance || 0));
};

const getPaidBetween = (projection, accountId, afterDate, throughDate) =>
  projection.events
    .filter(
      event =>
        event.account_id === accountId &&
        (event.kind === "transfer_in" || event.kind === "income") &&
        event.date > afterDate &&
        event.date <= throughDate,
    )
    .reduce((total, event) => total + Number(event.amount ?? event.value ?? 0), 0);

// The cycle shown is the statement whose payment deadline has not passed.
// amountDue is the statement balance less anything paid since the cut; a
// statement that has not closed yet is a projection of what it will be.
export const getCreditAccountStatus = (
  account,
  projection,
  asOf = new Date(),
) => {
  const cutDay = Number(account.credit_cut_day);
  const paymentDay = Number(account.credit_payment_day);
  if (!isCreditAccount(account) || !(cutDay >= 1) || !(paymentDay >= 1)) {
    return null;
  }
  const todayString = getLocalDate(asOf);
  const today = dateAtNoon(todayString);
  const cutThisMonth = dayInMonth(today.getFullYear(), today.getMonth(), cutDay);
  const lastCut =
    cutThisMonth <= today
      ? cutThisMonth
      : dayInMonth(today.getFullYear(), today.getMonth() - 1, cutDay);
  const nextCut = dayInMonth(lastCut.getFullYear(), lastCut.getMonth() + 1, cutDay);
  const lastCutString = getLocalDate(lastCut);
  const lastDue = paymentDueAfterCut(lastCut, paymentDay);

  const lastOwed = getOwedOn(projection, account.id, lastCutString, asOf);
  const lastPaid = getPaidBetween(
    projection,
    account.id,
    lastCutString,
    todayString,
  );
  const lastRemaining = Math.max(0, lastOwed - lastPaid);

  const statementClosed = lastDue >= today;
  const due = statementClosed ? lastDue : paymentDueAfterCut(nextCut, paymentDay);
  const pastDue = !statementClosed && lastRemaining > 0.005;

  return {
    nextCutDate: getLocalDate(nextCut),
    dueDate: getLocalDate(due),
    daysUntilDue: Math.round((due - today) / DAY_MS),
    statementClosed,
    amountDue: statementClosed
      ? lastRemaining
      : getOwedOn(projection, account.id, getLocalDate(nextCut), asOf),
    owedNow: getOwedOn(projection, account.id, todayString, asOf),
    pastDueAmount: pastDue ? lastRemaining : 0,
    pastDueDate: pastDue ? getLocalDate(lastDue) : null,
  };
};

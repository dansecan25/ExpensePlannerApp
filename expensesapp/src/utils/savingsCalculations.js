import {
  getRecurringDeductionOccurrenceDates,
  parseExcludedDates,
} from "./recurringDeductionSchedule";

export const getSavingsAvailableAsOfDate = (movements, asOfDate) =>
  movements.reduce((total, movement) => {
    if (movement.date.slice(0, 10) > asOfDate) {
      return total;
    }
    const amount = Number(movement.value || 0);
    const used = Number(movement.savings_used || 0);
    if (
      !movement.recurrence_frequency ||
      (Number(movement.recurrence_active ?? 1) !== 1 &&
        !movement.recurrence_stopped_date)
    ) {
      return total + amount - used;
    }

    const dueDates = getRecurringDeductionOccurrenceDates(
      movement,
      movement.date.slice(0, 10),
      asOfDate,
    );
    const firstCounts = parseExcludedDates(movement.excluded_dates).has(
      movement.date.slice(0, 10),
    )
      ? 0
      : 1;
    return total + amount * (firstCounts + dueDates.length) - used;
  }, 0);

const FAR_FUTURE_DATE = "9999-12-31";
const OPEN_ENDED_PLAN_YEARS = 2;

const isOpenEnded = movement =>
  Boolean(movement.recurrence_frequency) &&
  Number(movement.recurrence_active ?? 1) === 1 &&
  !movement.recurrence_end_date &&
  !movement.recurrence_stopped_date;

const getLastContributionDate = movement => {
  const firstDate = movement.date.slice(0, 10);
  const firstDates = parseExcludedDates(movement.excluded_dates).has(firstDate)
    ? []
    : [firstDate];
  // The schedule stops itself at the end or stop date.
  const dates = movement.recurrence_frequency
    ? getRecurringDeductionOccurrenceDates(movement, firstDate, FAR_FUTURE_DATE)
    : [];
  return [...firstDates, ...dates].pop() ?? null;
};

// What a group will hold once every planned contribution has been made, less
// everything used or recorded as spent from it. Open-ended recurring savings
// have no last date, so they count up to the app's two-year projection window.
export const getSavingsGroupPlan = (movements, spending, today) => {
  if (!movements.length) {
    return null;
  }
  const finiteDates = movements
    .filter(movement => !isOpenEnded(movement))
    .map(getLastContributionDate)
    .filter(Boolean);
  const openEnded = movements.some(isOpenEnded);
  const horizon = `${Number(today.slice(0, 4)) + OPEN_ENDED_PLAN_YEARS}${today.slice(4, 10)}`;
  const candidates = [
    ...finiteDates,
    ...(openEnded ? [horizon, ...movements.filter(isOpenEnded).map(movement => movement.date.slice(0, 10))] : []),
  ];
  if (!candidates.length) {
    return null;
  }
  const lastDate = candidates.reduce((latest, date) =>
    date > latest ? date : latest,
  );
  const spent = spending.reduce(
    (total, movement) => total + Number(movement.value || 0),
    0,
  );
  return {
    total: getSavingsAvailableAsOfDate(movements, lastDate) - spent,
    lastDate,
    isOpenEnded: openEnded,
  };
};

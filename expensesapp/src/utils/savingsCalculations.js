import { getRecurringDeductionOccurrenceDates } from "./recurringDeductionSchedule";

export const getSavingsAvailableAsOfDate = (movements, asOfDate) =>
  movements.reduce((total, movement) => {
    if (movement.date.slice(0, 10) > asOfDate) {
      return total;
    }
    const amount = Number(movement.value || 0);
    if (
      !movement.recurrence_frequency ||
      (Number(movement.recurrence_active ?? 1) !== 1 &&
        !movement.recurrence_stopped_date)
    ) {
      return total + amount;
    }

    const dueDates = getRecurringDeductionOccurrenceDates(
      movement,
      movement.date.slice(0, 10),
      asOfDate,
    );
    return total + amount * (1 + dueDates.length);
  }, 0);

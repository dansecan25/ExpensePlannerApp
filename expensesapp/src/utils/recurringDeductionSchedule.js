const DAY_MS = 24 * 60 * 60 * 1000;

const parseDate = value => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const formatDate = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const dateInPeriod = (start, period, frequency) => {
  if (frequency === "weekly") {
    const date = new Date(start);
    date.setDate(date.getDate() + period * 7);
    return date;
  }
  const monthOffset = frequency === "yearly" ? period * 12 : period;
  const targetMonth = start.getMonth() + monthOffset;
  const year = start.getFullYear() + Math.floor(targetMonth / 12);
  const month = targetMonth % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(start.getDate(), lastDay), 12);
};

export const parseExcludedDates = value =>
  new Set(
    String(value || "")
      .split(",")
      .map(date => date.trim())
      .filter(Boolean),
  );

export const getRecurringDeductionOccurrenceDates = (
  deduction,
  fromDate,
  throughDate,
) =>
  computeRecurringDeductionOccurrenceDates(
    deduction,
    fromDate,
    throughDate,
  ).filter(date => !parseExcludedDates(deduction.excluded_dates).has(date));

const computeRecurringDeductionOccurrenceDates = (
  deduction,
  fromDate,
  throughDate,
) => {
  const { recurrence_frequency: frequency } = deduction;
  if (!["weekly", "monthly", "yearly"].includes(frequency)) {
    return [];
  }
  const start = parseDate(deduction.date);
  const from = parseDate(fromDate);
  const endDates = [
    deduction.recurrence_end_date,
    deduction.recurrence_stopped_date,
  ].filter(Boolean);
  const recurrenceLimit = endDates.reduce(
    (limit, date) => (date < limit ? date : limit),
    throughDate,
  );
  const through = parseDate(recurrenceLimit);
  if (
    Number(deduction.recurrence_active ?? 1) !== 1 &&
    !deduction.recurrence_stopped_date
  ) {
    return [];
  }
  if (through < start) {
    return [];
  }

  let period = 1;
  if (frequency === "weekly") {
    const startUtc = Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
    );
    const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    period = Math.max(
      1,
      Math.ceil((fromUtc - startUtc) / (7 * DAY_MS)),
    );
  } else {
    const monthsSinceStart =
      (from.getFullYear() - start.getFullYear()) * 12 +
      from.getMonth() -
      start.getMonth();
    period = Math.max(
      1,
      frequency === "yearly"
        ? Math.floor(monthsSinceStart / 12)
        : monthsSinceStart,
    );
  }

  let occurrence = dateInPeriod(start, period, frequency);
  while (occurrence < from) {
    period += 1;
    occurrence = dateInPeriod(start, period, frequency);
  }

  const dates = [];
  while (occurrence <= through) {
    dates.push(formatDate(occurrence));
    period += 1;
    occurrence = dateInPeriod(start, period, frequency);
  }
  return dates;
};
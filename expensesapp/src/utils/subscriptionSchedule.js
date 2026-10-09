const dateAtNoon = value => {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};

const dateString = date =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;

const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

const monthDate = (year, month, day) =>
  new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()), 12);

export const getSubscriptionOccurrenceDates = (
  subscription,
  fromDate,
  throughDate,
) => {
  const excluded = new Set(
    String(subscription.excluded_dates || "")
      .split(",")
      .map(date => date.trim())
      .filter(Boolean),
  );
  return computeSubscriptionOccurrenceDates(
    subscription,
    fromDate,
    throughDate,
  ).filter(date => !excluded.has(date));
};

const computeSubscriptionOccurrenceDates = (
  subscription,
  fromDate,
  throughDate,
) => {
  const from = dateAtNoon(fromDate);
  const through = dateAtNoon(throughDate);
  const start = dateAtNoon(subscription.start_date);
  const dates = [];

  if (subscription.frequency === "custom") {
    const interval = Number(subscription.interval_days);
    if (!Number.isInteger(interval) || interval < 1) {
      return dates;
    }
    const daysUntilStart = Math.max(0, Math.ceil((from - start) / 86400000));
    const firstOccurrence =
      Math.ceil(daysUntilStart / interval) * interval;
    const firstDate = addDays(start, firstOccurrence);
    for (
      let date = firstDate;
      date <= through;
      date = addDays(date, interval)
    ) {
      dates.push(dateString(date));
    }
    return dates;
  }

  const monthInterval = subscription.frequency === "annual" ? 12 : 1;
  let monthsFromStart =
    (from.getFullYear() - start.getFullYear()) * 12 +
    from.getMonth() -
    start.getMonth();
  let occurrence = monthDate(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  if (monthsFromStart > 0) {
    const intervalCount = Math.floor(monthsFromStart / monthInterval);
    const occurrenceMonth =
      start.getMonth() + intervalCount * monthInterval;
    occurrence = monthDate(
      start.getFullYear() + Math.floor(occurrenceMonth / 12),
      occurrenceMonth % 12,
      start.getDate(),
    );
    if (occurrence < from) {
      const nextMonth = occurrence.getMonth() + monthInterval;
      occurrence = monthDate(
        occurrence.getFullYear() + Math.floor(nextMonth / 12),
        nextMonth % 12,
        start.getDate(),
      );
    }
  }
  while (occurrence <= through) {
    if (occurrence >= from) {
      dates.push(dateString(occurrence));
    }
    const nextMonth = occurrence.getMonth() + monthInterval;
    occurrence = monthDate(
      occurrence.getFullYear() + Math.floor(nextMonth / 12),
      nextMonth % 12,
      start.getDate(),
    );
  }
  return dates;
};
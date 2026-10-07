const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export const formatDisplayDate = value => {
  const dateString =
    value instanceof Date
      ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
          value.getDate(),
        ).padStart(2, "0")}`
      : String(value || "").slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  if (!match) {
    return String(value ?? "");
  }

  const [, year, monthString, dayString] = match;
  const month = Number(monthString);
  const day = Number(dayString);
  const date = new Date(Number(year), month - 1, day, 12);
  if (
    month < 1 ||
    month > 12 ||
    date.getFullYear() !== Number(year) ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return String(value ?? "");
  }
  return `${dayString} ${MONTH_ABBREVIATIONS[month - 1]} ${year}`;
};

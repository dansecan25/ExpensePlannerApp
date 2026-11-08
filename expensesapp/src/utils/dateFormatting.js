import { getCurrentLanguage } from "../i18n/i18n";

const MONTH_ABBREVIATIONS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Set", "Oct", "Nov", "Dic",
];

const MONTH_NAMES = {
  en: [
    "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
  ],
  es: [
    "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "setiembre", "octubre", "noviembre", "diciembre",
  ],
};

export const formatMonthYear = date => {
  const language = getCurrentLanguage();
  const month = MONTH_NAMES[language][date.getMonth()];
  return language === "es"
    ? `${month} de ${date.getFullYear()}`
    : `${month} ${date.getFullYear()}`;
};

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
  const abbreviations =
    getCurrentLanguage() === "es" ? MONTH_ABBREVIATIONS_ES : MONTH_ABBREVIATIONS;
  return `${dayString} ${abbreviations[month - 1]} ${year}`;
};

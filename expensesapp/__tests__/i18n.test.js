const fs = require("fs");
const path = require("path");
const {
  accountLabel,
  setCurrentLanguage,
  t,
} = require("../src/i18n/i18n");
const { default: es } = require("../src/i18n/es");
const {
  formatDisplayDate,
  formatMonthYear,
} = require("../src/utils/dateFormatting");

const RECURRENCE_VALUES = ["weekly", "monthly", "yearly", "annual", "custom"];
const sourceFiles = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : full.endsWith(".js") ? [full] : [];
  });
const keysInSource = () => {
  const pattern = /\bt\(\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/g;
  const keys = new Set();
  for (const file of sourceFiles(path.join(__dirname, "../src"))) {
    if (file.endsWith(path.join("i18n", "es.js"))) {
      continue;
    }
    for (const match of fs.readFileSync(file, "utf8").matchAll(pattern)) {
      keys.add((match[1] ?? match[2]).replace(/\\"/g, '"').replace(/\\'/g, "'"));
    }
  }
  return keys;
};
const placeholders = text => (text.match(/\{\w+\}/g) || []).sort();

afterEach(() => setCurrentLanguage("en"));

describe("Spanish translations", () => {
  test("cover every string used in the app", () => {
    expect([...keysInSource()].filter(key => es[key] === undefined)).toEqual([]);
  });

  test("contain no unused entries", () => {
    const used = keysInSource();
    expect(
      Object.keys(es).filter(
        key => !used.has(key) && !RECURRENCE_VALUES.includes(key),
      ),
    ).toEqual([]);
  });

  test("keep the same placeholders as the English text", () => {
    expect(
      Object.entries(es).filter(
        ([key, value]) =>
          JSON.stringify(placeholders(key)) !== JSON.stringify(placeholders(value)),
      ),
    ).toEqual([]);
  });
});

describe("t", () => {
  test("defaults to English and fills placeholders", () => {
    expect(t("Delete {name}?", { name: "Visa" })).toBe("Delete Visa?");
  });

  test("returns Spanish once selected", () => {
    setCurrentLanguage("es");
    expect(t("Delete {name}?", { name: "Visa" })).toBe("¿Eliminar Visa?");
  });

  test("inserts values containing replacement patterns literally", () => {
    expect(t("Delete {name}?", { name: "$& cash" })).toBe("Delete $& cash?");
  });

  test("falls back to English for an unknown language", () => {
    setCurrentLanguage("fr");
    expect(t("Cancel")).toBe("Cancel");
  });
});

describe("localized display", () => {
  test("translates only the default account's name", () => {
    setCurrentLanguage("es");
    expect(accountLabel("Main account")).toBe("Cuenta principal");
    expect(accountLabel("BAC")).toBe("BAC");
  });

  test("formats dates in the selected language", () => {
    setCurrentLanguage("es");
    expect(formatDisplayDate("2026-01-02")).toBe("02 Ene 2026");
    expect(formatMonthYear(new Date(2026, 8, 1, 12))).toBe("setiembre de 2026");
    setCurrentLanguage("en");
    expect(formatMonthYear(new Date(2026, 8, 1, 12))).toBe("September 2026");
  });
});

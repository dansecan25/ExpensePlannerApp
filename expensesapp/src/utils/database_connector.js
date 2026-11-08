import { open } from "react-native-nitro-sqlite";
import { isSupportedLanguage, t } from "../i18n/i18n";

export const getDB = () => {
  if (!globalThis.__financeDB) {
    globalThis.__financeDB = open({ name: "finance123.sqlite" });
  }
  return globalThis.__financeDB;
};

const getDefaultAccountId = async db => {
  const findMainAccount = () =>
    db.execute(
      `SELECT id FROM accounts
       WHERE name COLLATE NOCASE = 'Main account'
       LIMIT 1;`,
    );
  let result = await findMainAccount();
  if (result.rows.length) {
    return result.rows.item(0).id;
  }
  const accounts = await db.execute("SELECT id FROM accounts LIMIT 1;");
  if (!accounts.rows.length) {
    const [salary, movements] = await Promise.all([
      db.execute("SELECT balance FROM salary ORDER BY id LIMIT 1;"),
      db.execute(
        "SELECT id FROM months_expenses UNION ALL SELECT id FROM subscriptions LIMIT 1;",
      ),
    ]);
    if (!salary.rows.length && !movements.rows.length) {
      return null;
    }
    await db.executeAsync(
      "INSERT OR IGNORE INTO accounts (name, color, opening_balance) VALUES (?, ?, ?);",
      [
        "Main account",
        "#4261a0",
        Number(salary.rows.item(0)?.balance || 0),
      ],
    );
    result = await findMainAccount();
    return result.rows.length ? result.rows.item(0).id : null;
  }
  await db.executeAsync(
    "INSERT OR IGNORE INTO accounts (name, color, opening_balance) VALUES (?, ?, 0);",
    ["Main account", "#4261a0"],
  );
  result = await findMainAccount();
  return result.rows.length ? result.rows.item(0).id : null;
};

const readRows = result => {
  const rows = [];
  for (let index = 0; index < result.rows.length; index += 1) {
    rows.push(result.rows.item(index));
  }
  return rows;
};

const DATABASE_BACKUP_FORMAT = "expense-planner-app-database";
const DATABASE_TABLES = [
  "salary",
  "salary_schedule_changes",
  "salary_deductions",
  "other_taxes",
  "accounts",
  "tags",
  "months_expenses",
  "subscriptions",
  "account_transfers",
  "expense_tags",
  "yearly_expenses",
];

const ensureColumn = async (db, table, column, definition) => {
  const result = await db.execute(`PRAGMA table_info(${table});`);
  const exists = readRows(result).some(row => row.name === column);
  if (!exists) {
    await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  }
};

export const getLocalDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const isValidLocalDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

export const initDatabase = async () => {
  const db = getDB();

  await db.executeBatchAsync([
    {
      query: `
        CREATE TABLE IF NOT EXISTS salary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL,
          balance REAL NOT NULL DEFAULT 0,
          last_deposit TEXT,
          currency TEXT,
          fixed BOOL DEFAULT 1,
          deposits_date TEXT,
          fixed_day INTEGER,
          account_id INTEGER,
          savings_mode_enabled INTEGER NOT NULL DEFAULT 0,
          savings_mode_amount REAL NOT NULL DEFAULT 0,
          theme_mode TEXT NOT NULL DEFAULT 'system',
          setup_complete INTEGER NOT NULL DEFAULT 1
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS salary_schedule_changes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          effective_date TEXT NOT NULL UNIQUE,
          amount REAL,
          income_type TEXT NOT NULL,
          deposits_date TEXT,
          fixed_day INTEGER,
          account_id INTEGER
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS salary_deductions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          min_salary REAL NOT NULL,
          max_salary REAL,
          percentage REAL NOT NULL
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS other_taxes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          percentage REAL NOT NULL
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#4261a0',
          opening_balance REAL NOT NULL DEFAULT 0
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          color TEXT NOT NULL DEFAULT '#4261a0',
          is_savings_group INTEGER NOT NULL DEFAULT 0
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS months_expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          value REAL NOT NULL,
          inflated_value REAL,
          account_id INTEGER,
          kind TEXT NOT NULL DEFAULT 'expense',
          is_savings INTEGER NOT NULL DEFAULT 0,
          recurrence_frequency TEXT,
          recurrence_end_date TEXT,
          recurrence_active INTEGER NOT NULL DEFAULT 1,
          recurrence_stopped_date TEXT,
          is_savings_withdrawal INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (account_id) REFERENCES accounts(id)
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS expense_tags (
          expense_id INTEGER NOT NULL,
          tag_id INTEGER NOT NULL,
          PRIMARY KEY (expense_id, tag_id),
          FOREIGN KEY (expense_id) REFERENCES months_expenses(id) ON DELETE CASCADE,
          FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS subscriptions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          amount REAL NOT NULL,
          account_id INTEGER,
          tag_id INTEGER,
          start_date TEXT NOT NULL,
          frequency TEXT NOT NULL,
          interval_days INTEGER,
          is_savings INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1,
          FOREIGN KEY (account_id) REFERENCES accounts(id),
          FOREIGN KEY (tag_id) REFERENCES tags(id)
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS account_transfers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date TEXT NOT NULL,
          from_account_id INTEGER NOT NULL,
          to_account_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          description TEXT,
          recurrence_frequency TEXT,
          recurrence_end_date TEXT,
          recurrence_active INTEGER NOT NULL DEFAULT 1,
          recurrence_stopped_date TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (from_account_id) REFERENCES accounts(id),
          FOREIGN KEY (to_account_id) REFERENCES accounts(id)
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS yearly_expenses (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          year INTEGER NOT NULL UNIQUE
        );
      `,
    },
  ]);

  await ensureColumn(db, "salary", "balance", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "salary", "last_deposit", "TEXT");
  await ensureColumn(db, "salary", "currency", "TEXT");
  await ensureColumn(db, "salary", "fixed", "BOOL DEFAULT 1");
  await ensureColumn(db, "salary", "deposits_date", "TEXT");
  await ensureColumn(db, "salary", "fixed_day", "INTEGER");
  await ensureColumn(db, "salary", "account_id", "INTEGER");
  await ensureColumn(db, "salary", "savings_mode_enabled", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "salary", "savings_mode_amount", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(
    db,
    "salary",
    "theme_mode",
    "TEXT NOT NULL DEFAULT 'system'",
  );
  await ensureColumn(db, "salary", "setup_complete", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "accounts", "opening_balance", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "accounts", "account_type", "TEXT NOT NULL DEFAULT 'bank'");
  await ensureColumn(db, "accounts", "credit_cut_day", "INTEGER");
  await ensureColumn(db, "accounts", "credit_payment_day", "INTEGER");
  await ensureColumn(db, "tags", "color", "TEXT NOT NULL DEFAULT '#4261a0'");
  await ensureColumn(db, "tags", "is_savings_group", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "months_expenses", "kind", "TEXT NOT NULL DEFAULT 'expense'");
  await ensureColumn(db, "months_expenses", "is_savings", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "months_expenses", "recurrence_frequency", "TEXT");
  await ensureColumn(db, "months_expenses", "recurrence_end_date", "TEXT");
  await ensureColumn(db, "months_expenses", "recurrence_active", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "months_expenses", "recurrence_stopped_date", "TEXT");
  await ensureColumn(db, "months_expenses", "is_savings_withdrawal", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "months_expenses", "created_at", "TEXT");
  await ensureColumn(db, "months_expenses", "account_id", "INTEGER");
  await ensureColumn(db, "months_expenses", "savings_used", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "salary_schedule_changes", "account_id", "INTEGER");
  await ensureColumn(db, "account_transfers", "recurrence_frequency", "TEXT");
  await ensureColumn(db, "account_transfers", "recurrence_end_date", "TEXT");
  await ensureColumn(
    db,
    "account_transfers",
    "recurrence_active",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await ensureColumn(db, "account_transfers", "recurrence_stopped_date", "TEXT");
  await ensureColumn(db, "months_expenses", "excluded_dates", "TEXT");
  await ensureColumn(db, "subscriptions", "excluded_dates", "TEXT");
  await ensureColumn(db, "subscriptions", "description", "TEXT");
  await ensureColumn(db, "subscriptions", "inflated_value", "REAL");
  await ensureColumn(db, "account_transfers", "excluded_dates", "TEXT");
  await ensureColumn(db, "salary", "excluded_dates", "TEXT");
  await ensureColumn(db, "salary", "language", "TEXT NOT NULL DEFAULT 'en'");
  await db.execute(`
    UPDATE months_expenses
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL;
  `);
  await syncSavingsGroupFlags(db);
  const defaultAccountId = await getDefaultAccountId(db);
  if (defaultAccountId !== null) {
    await db.executeAsync(
      "UPDATE salary SET account_id = ? WHERE account_id IS NULL;",
      [defaultAccountId],
    );
    await db.executeAsync(
      `UPDATE salary_schedule_changes
       SET account_id = (
         SELECT account_id FROM salary ORDER BY id LIMIT 1
       )
       WHERE account_id IS NULL;`,
    );
    await db.executeAsync(
      "UPDATE salary SET account_id = ? WHERE account_id IS NULL;",
      [defaultAccountId],
    );
    await db.executeAsync(
      `UPDATE salary_schedule_changes
       SET account_id = (
         SELECT account_id FROM salary ORDER BY id LIMIT 1
       )
       WHERE account_id IS NULL;`,
    );
    await db.executeAsync(
      "UPDATE months_expenses SET account_id = ? WHERE account_id IS NULL;",
      [defaultAccountId],
    );
    await db.executeAsync(
      "UPDATE subscriptions SET account_id = ? WHERE account_id IS NULL;",
      [defaultAccountId],
    );
  }
};

export const resetDatabase = async () => {
  const db = getDB();
  try {
    await db.executeBatchAsync([
      { query: "DROP TABLE IF EXISTS expense_tags;" },
      { query: "DROP TABLE IF EXISTS account_transfers;" },
      { query: "DROP TABLE IF EXISTS subscriptions;" },
      { query: "DROP TABLE IF EXISTS salary_schedule_changes;" },
      { query: "DROP TABLE IF EXISTS months_expenses;" },
      { query: "DROP TABLE IF EXISTS tags;" },
      { query: "DROP TABLE IF EXISTS accounts;" },
      { query: "DROP TABLE IF EXISTS yearly_expenses;" },
      { query: "DROP TABLE IF EXISTS other_taxes;" },
      { query: "DROP TABLE IF EXISTS salary_deductions;" },
      { query: "DROP TABLE IF EXISTS salary;" },
    ]);
    await initDatabase();
  } catch (error) {
    console.error("resetDatabase failed:", error);
    throw error;
  }
};

export const getSalary = async () => {
  const row = await getSalaryRow();
  return row ? row.amount : null;
};

export const getSalaryRow = async () => {
  const result = await getDB().execute("SELECT * FROM salary ORDER BY id LIMIT 1;");
  return result.rows.length ? result.rows.item(0) : null;
};

export const addSalary = async ({
  amount,
  currency,
  balance,
  fixed,
  deposits_date,
  fixed_day,
  salaryAccountName = "Main account",
  language = "en",
}) => {
  const db = getDB();
  const date = getLocalDate();
  await db.executeAsync(
    "INSERT OR IGNORE INTO accounts (name, color, opening_balance) VALUES (?, ?, 0);",
    [salaryAccountName.trim() || "Main account", "#4261a0"],
  );
  const salaryAccountResult = await db.execute(
    "SELECT id FROM accounts WHERE name = ? LIMIT 1;",
    [salaryAccountName.trim() || "Main account"],
  );
  const salaryAccountId = salaryAccountResult.rows.length
    ? salaryAccountResult.rows.item(0).id
    : await getDefaultAccountId(db);
  const result = await db.executeAsync(
    `INSERT INTO salary
      (amount, balance, last_deposit, currency, fixed, deposits_date, fixed_day, account_id, setup_complete, language)
     SELECT ?, ?, ?, ?, ?, ?, ?, ?, 0, ?
     WHERE NOT EXISTS (SELECT 1 FROM salary);`,
    [
      Number.isFinite(amount) ? amount : null,
      balance,
      date,
      currency,
      fixed ? 1 : 0,
      deposits_date || null,
      fixed_day ?? null,
      salaryAccountId,
      language,
    ],
  );
  await db.executeAsync(
    "INSERT OR IGNORE INTO accounts (name, color, opening_balance) VALUES (?, ?, ?);",
    ["Main account", "#4261a0", balance],
  );
  const mainAccountId = await getDefaultAccountId(db);
  if (mainAccountId !== null) {
    await db.executeAsync(
      "UPDATE months_expenses SET account_id = ? WHERE account_id IS NULL;",
      [mainAccountId],
    );
    await db.executeAsync(
      "UPDATE subscriptions SET account_id = ? WHERE account_id IS NULL;",
      [mainAccountId],
    );
  }
  return result.insertId;
};

export const updateSalaryAmount = async amount => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(t("Enter a salary amount greater than zero."));
  }
  const result = await getDB().executeAsync(
    "UPDATE salary SET amount = ? WHERE id = (SELECT id FROM salary ORDER BY id LIMIT 1);",
    [numericAmount],
  );
  if (result.rowsAffected === 0) {
    throw new Error(t("Set up an income profile before changing the salary."));
  }
};

export const updateSalarySavingsMode = async (enabled, amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error(t("Enter a savings amount of zero or more."));
  }
  const result = await getDB().executeAsync(
    `UPDATE salary
     SET savings_mode_enabled = ?, savings_mode_amount = ?
     WHERE id = (SELECT id FROM salary ORDER BY id LIMIT 1);`,
    [enabled ? 1 : 0, numericAmount],
  );
  if (result.rowsAffected === 0) {
    throw new Error(t("Set up an income profile before enabling Savings mode."));
  }
};

// With no profile yet there is nothing to update: setup keeps the choice in
// memory and saves it with the profile.
export const updateLanguage = async language => {
  if (!isSupportedLanguage(language)) {
    throw new Error(t("Choose a supported language."));
  }
  await getDB().executeAsync(
    "UPDATE salary SET language = ? WHERE id = (SELECT id FROM salary ORDER BY id LIMIT 1);",
    [language],
  );
};

export const updateThemeMode = async mode => {
  if (!["system", "light", "dark"].includes(mode)) {
    throw new Error(t("Choose system, light, or dark appearance."));
  }
  const result = await getDB().executeAsync(
    "UPDATE salary SET theme_mode = ? WHERE id = (SELECT id FROM salary ORDER BY id LIMIT 1);",
    [mode],
  );
  if (result.rowsAffected === 0) {
    throw new Error(t("Set up your profile before changing appearance."));
  }
};

export const getSalaryScheduleChanges = async () => {
  const result = await getDB().execute(
    "SELECT * FROM salary_schedule_changes ORDER BY effective_date ASC;",
  );
  return readRows(result);
};

export const saveSalaryScheduleChange = async ({
  effectiveDate,
  amount,
  incomeType,
  depositsDate,
  fixedDay,
  accountId,
}) => {
  if (!isValidLocalDate(effectiveDate)) {
    throw new Error(t("Choose a valid salary change effective date."));
  }
  if (!["fixed", "variable", "unemployed"].includes(incomeType)) {
    throw new Error(t("Choose fixed salary, variable income, or unemployed."));
  }
  const numericAmount =
    amount === null || amount === undefined || amount === ""
      ? null
      : Number(amount);
  if (
    incomeType === "fixed" &&
    (!Number.isFinite(numericAmount) ||
      numericAmount <= 0 ||
      !["Quincenal", "Last day of month", "Pre last day of month", "Fixed date"].includes(
        depositsDate,
      ) ||
      (depositsDate === "Fixed date" &&
        (!Number.isInteger(Number(fixedDay)) ||
          Number(fixedDay) < 1 ||
          Number(fixedDay) > 31)))
  ) {
    throw new Error(t("Enter a valid salary amount and deposit schedule."));
  }
  await getDB().executeBatchAsync([
    {
      query: "DELETE FROM salary_schedule_changes WHERE effective_date = ?;",
      params: [effectiveDate],
    },
    {
      query: `INSERT INTO salary_schedule_changes
        (effective_date, amount, income_type, deposits_date, fixed_day, account_id)
        VALUES (?, ?, ?, ?, ?, ?);`,
      params: [
        effectiveDate,
        incomeType === "fixed" ? numericAmount : null,
        incomeType,
        incomeType === "fixed" ? depositsDate : null,
        incomeType === "fixed" && depositsDate === "Fixed date"
          ? Number(fixedDay)
          : null,
        accountId ?? null,
      ],
    },
  ]);
};

export const insertSalaryDeductions = async ranges => {
  const db = getDB();
  const statements = [{ query: "DELETE FROM salary_deductions;" }];
  for (const range of ranges) {
    statements.push({
      query: `INSERT INTO salary_deductions (min_salary, max_salary, percentage)
       VALUES (?, ?, ?);`,
      params: [range.min_salary, range.max_salary ?? null, range.percentage],
    });
  }
  await db.executeBatchAsync(statements);
};

export const insertOtherTaxes = async taxes => {
  const db = getDB();
  const statements = [{ query: "DELETE FROM other_taxes;" }];
  for (const tax of taxes) {
    statements.push({
      query: "INSERT INTO other_taxes (name, percentage) VALUES (?, ?);",
      params: [tax.name, tax.percentage],
    });
  }
  await db.executeBatchAsync(statements);
};

export const saveDeductionConfiguration = async (ranges, taxes) => {
  const statements = [
    { query: "DELETE FROM salary_deductions;" },
    { query: "DELETE FROM other_taxes;" },
  ];
  for (const range of ranges) {
    statements.push({
      query: `INSERT INTO salary_deductions (min_salary, max_salary, percentage)
       VALUES (?, ?, ?);`,
      params: [range.min_salary, range.max_salary ?? null, range.percentage],
    });
  }
  for (const tax of taxes) {
    statements.push({
      query: "INSERT INTO other_taxes (name, percentage) VALUES (?, ?);",
      params: [tax.name, tax.percentage],
    });
  }
  statements.push({ query: "UPDATE salary SET setup_complete = 1;" });
  await getDB().executeBatchAsync(statements);
};

const validateCreditDay = (day, label) => {
  const numericDay = Number(day);
  if (!Number.isInteger(numericDay) || numericDay < 1 || numericDay > 31) {
    throw new Error(t("{label} must be a day of the month from 1 to 31.", { label }));
  }
  return numericDay;
};

export const createAccount = async (
  name,
  color = "#4261a0",
  openingBalance = 0,
  { accountType = "bank", cutDay = null, paymentDay = null } = {},
) => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error(t("Account name is required."));
  }
  const isCredit = accountType === "credit";
  if (isCredit && normalizedName.toLocaleLowerCase() === "main account") {
    throw new Error(t("Main account cannot be a credit account. Choose another name."));
  }
  const db = getDB();
  await db.executeAsync(
    `INSERT INTO accounts
      (name, color, opening_balance, account_type, credit_cut_day, credit_payment_day)
     VALUES (?, ?, ?, ?, ?, ?);`,
    [
      normalizedName,
      color,
      Number(openingBalance) || 0,
      isCredit ? "credit" : "bank",
      isCredit ? validateCreditDay(cutDay, t("Cut date")) : null,
      isCredit ? validateCreditDay(paymentDay, t("Payment date")) : null,
    ],
  );
  await getDefaultAccountId(db);
};

export const updateCreditAccountDates = async (id, cutDay, paymentDay) => {
  const result = await getDB().executeAsync(
    `UPDATE accounts
     SET credit_cut_day = ?, credit_payment_day = ?
     WHERE id = ? AND account_type = 'credit';`,
    [
      validateCreditDay(cutDay, t("Cut date")),
      validateCreditDay(paymentDay, t("Payment date")),
      id,
    ],
  );
  if (result.rowsAffected === 0) {
    throw new Error(t("The credit account could not be found."));
  }
};

export const deleteAccount = async id => {
  const db = getDB();
  const deletedResult = await db.execute(
    "SELECT name, opening_balance FROM accounts WHERE id = ?;",
    [id],
  );
  if (!deletedResult.rows.length) {
    throw new Error(t("The account could not be found."));
  }
  const deletedAccount = deletedResult.rows.item(0);
  const mainResult = await db.execute(
    "SELECT id FROM accounts WHERE name COLLATE NOCASE = 'Main account' LIMIT 1;",
  );
  const isMainAccount =
    mainResult.rows.length && Number(mainResult.rows.item(0).id) === Number(id);
  if (isMainAccount) {
    const fallback = await db.execute(
      "SELECT id FROM accounts WHERE id != ? ORDER BY id LIMIT 1;",
      [id],
    );
    if (fallback.rows.length) {
      const fallbackId = fallback.rows.item(0).id;
      await db.executeAsync(
        "UPDATE account_transfers SET from_account_id = ? WHERE from_account_id = ?;",
        [fallbackId, id],
      );
      await db.executeAsync(
        "UPDATE account_transfers SET to_account_id = ? WHERE to_account_id = ?;",
        [fallbackId, id],
      );
      await db.executeAsync(
        "DELETE FROM account_transfers WHERE from_account_id = to_account_id;",
      );
    } else {
      await db.executeAsync(
        "DELETE FROM account_transfers WHERE from_account_id = ? OR to_account_id = ?;",
        [id, id],
      );
    }
    await db.executeAsync(
      "UPDATE months_expenses SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync(
      "UPDATE subscriptions SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync(
      "UPDATE salary SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync(
      "UPDATE salary_schedule_changes SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync("DELETE FROM accounts WHERE id = ?;", [id]);
    await db.executeAsync(
      "INSERT INTO accounts (name, color, opening_balance) VALUES (?, ?, ?);",
      ["Main account", "#4261a0", Number(deletedAccount.opening_balance || 0)],
    );
    const replacementMainId = await getDefaultAccountId(db);
    await db.executeAsync(
      "UPDATE months_expenses SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    await db.executeAsync(
      "UPDATE subscriptions SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    await db.executeAsync(
      "UPDATE salary SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    await db.executeAsync(
      "UPDATE salary_schedule_changes SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    return;
  }

  const remaining = await db.execute(
    "SELECT id FROM accounts WHERE id != ? ORDER BY CASE WHEN name COLLATE NOCASE = 'Main account' THEN 0 ELSE 1 END, id LIMIT 1;",
    [id],
  );
  if (remaining.rows.length) {
    const remainingId = remaining.rows.item(0).id;
    await db.executeAsync(
      `UPDATE accounts
       SET opening_balance = opening_balance +
         (SELECT opening_balance FROM accounts WHERE id = ?)
       WHERE id = ?;`,
      [id, remainingId],
    );
    await db.executeAsync(
      "UPDATE months_expenses SET account_id = ? WHERE account_id = ?;",
      [remainingId, id],
    );
    await db.executeAsync(
      "UPDATE subscriptions SET account_id = ? WHERE account_id = ?;",
      [remainingId, id],
    );
    await db.executeAsync(
      "UPDATE salary SET account_id = ? WHERE account_id = ?;",
      [remainingId, id],
    );
    await db.executeAsync(
      "UPDATE salary_schedule_changes SET account_id = ? WHERE account_id = ?;",
      [remainingId, id],
    );
    await db.executeAsync(
      "UPDATE account_transfers SET from_account_id = ? WHERE from_account_id = ?;",
      [remainingId, id],
    );
    await db.executeAsync(
      "UPDATE account_transfers SET to_account_id = ? WHERE to_account_id = ?;",
      [remainingId, id],
    );
    await db.executeAsync(
      "DELETE FROM account_transfers WHERE from_account_id = to_account_id;",
    );
  } else {
    await db.executeAsync(
      `UPDATE salary
       SET balance = CASE
         WHEN (SELECT opening_balance FROM accounts WHERE id = ?) != 0
           THEN (SELECT opening_balance FROM accounts WHERE id = ?)
         ELSE balance
       END
       WHERE id = (SELECT id FROM salary ORDER BY id LIMIT 1);`,
      [id, id],
    );
    await db.executeAsync(
      "UPDATE months_expenses SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync(
      "UPDATE subscriptions SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync(
      "UPDATE salary SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync(
      "UPDATE salary_schedule_changes SET account_id = NULL WHERE account_id = ?;",
      [id],
    );
    await db.executeAsync(
      "DELETE FROM account_transfers WHERE from_account_id = ? OR to_account_id = ?;",
      [id, id],
    );
    await db.executeAsync("DELETE FROM accounts WHERE id = ?;", [id]);
    await db.executeAsync(
      "INSERT INTO accounts (name, color, opening_balance) VALUES (?, ?, ?);",
      ["Main account", "#4261a0", Number(deletedAccount.opening_balance || 0)],
    );
    const replacementMainId = await getDefaultAccountId(db);
    await db.executeAsync(
      "UPDATE months_expenses SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    await db.executeAsync(
      "UPDATE subscriptions SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    await db.executeAsync(
      "UPDATE salary SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    await db.executeAsync(
      "UPDATE salary_schedule_changes SET account_id = ? WHERE account_id IS NULL;",
      [replacementMainId],
    );
    return;
  }
  await db.executeAsync("DELETE FROM accounts WHERE id = ?;", [id]);
};

export const getAccountsCreated = async () => {
  const result = await getDB().execute(
    "SELECT * FROM accounts ORDER BY name COLLATE NOCASE ASC;",
  );
  return readRows(result);
};

export const createTag = async (name, color = "#4261a0") => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error(t("Tag name is required."));
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error(t("Tag color must be a six-digit hexadecimal color."));
  }
  const db = getDB();
  const existingResult = await db.execute(
    "SELECT id, name, color FROM tags WHERE name = ? COLLATE NOCASE;",
    [normalizedName],
  );
  if (existingResult.rows.length) {
    return existingResult.rows.item(0);
  }
  await db.executeAsync(
    "INSERT OR IGNORE INTO tags (name, color) VALUES (?, ?);",
    [normalizedName, color.toUpperCase()],
  );
  const result = await db.execute(
    "SELECT id, name, color FROM tags WHERE name = ? COLLATE NOCASE;",
    [normalizedName],
  );
  const tag = result.rows.length ? result.rows.item(0) : null;
  if (!tag) {
    throw new Error(t("The tag could not be created."));
  }
  return tag;
};

export const getAllTags = async () => {
  const result = await getDB().execute(
    "SELECT id, name, color, is_savings_group FROM tags ORDER BY name COLLATE NOCASE ASC;",
  );
  return readRows(result);
};

export const createSavingsGroupTag = async (name, color = "#4261a0") => {
  const tag = await createTag(name, color);
  await getDB().executeAsync(
    "UPDATE tags SET is_savings_group = 1 WHERE id = ?;",
    [tag.id],
  );
  return { ...tag, is_savings_group: 1 };
};

// A tag used on any savings movement is a savings group, whether it was
// created on the Savings screen or typed into a transaction form.
const syncSavingsGroupFlags = async db => {
  await db.executeAsync(
    `UPDATE tags
     SET is_savings_group = 1
     WHERE is_savings_group = 0
       AND id IN (
         SELECT et.tag_id
         FROM expense_tags et
         JOIN months_expenses e ON e.id = et.expense_id
         WHERE e.is_savings = 1
       );`,
  );
};

export const insertExpense = async (
  name,
  value,
  inflatedValue,
  tags = [],
  accountId,
  date,
  description,
  options = {},
) => {
  const normalizedName = name.trim();
  const numericValue = Number(value);
  const kind = options.kind || "expense";
  if (!normalizedName || !Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error(t("Enter an expense name and a positive amount."));
  }
  if (!["income", "expense", "savings", "savings_use"].includes(kind)) {
    throw new Error(t("Choose a valid transaction type."));
  }
  if (!isValidLocalDate(date)) {
    throw new Error(t("Enter a valid transaction date."));
  }
  const numericInflatedValue =
    inflatedValue === undefined || inflatedValue === null || inflatedValue === ""
      ? null
      : Number(inflatedValue);
  if (
    numericInflatedValue !== null &&
    (!Number.isFinite(numericInflatedValue) || numericInflatedValue < numericValue)
  ) {
    throw new Error(t("The projected amount must be at least the transaction amount."));
  }
  const recurrenceFrequency = options.recurrenceFrequency ?? null;
  const recurrenceEndDate = options.recurrenceEndDate || null;
  if (
    recurrenceFrequency !== null &&
    (kind === "income" ||
      !["weekly", "monthly", "yearly"].includes(recurrenceFrequency))
  ) {
    throw new Error(t("Choose a valid recurrence for a deduction."));
  }
  if (
    recurrenceEndDate !== null &&
    (!isValidLocalDate(recurrenceEndDate) ||
      recurrenceEndDate < date ||
      recurrenceFrequency === null)
  ) {
    throw new Error(t("Choose a valid recurrence end date."));
  }
  const db = getDB();
  const resolvedAccountId = accountId ?? (await getDefaultAccountId(db));
  const result = await db.executeAsync(
    `INSERT INTO months_expenses
      (date, name, description, value, inflated_value, account_id, kind, is_savings,
       recurrence_frequency, recurrence_end_date, is_savings_withdrawal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      date,
      normalizedName,
      description || null,
      numericValue,
      numericInflatedValue,
      resolvedAccountId,
      kind,
      kind === "savings" || options.isSavings ? 1 : 0,
      recurrenceFrequency,
      recurrenceEndDate,
      kind !== "income" && options.isSavingsWithdrawal ? 1 : 0,
    ],
  );

  for (const tagId of tags) {
    await db.executeAsync(
      "INSERT OR IGNORE INTO expense_tags (expense_id, tag_id) VALUES (?, ?);",
      [result.insertId, tagId],
    );
  }
  await syncSavingsGroupFlags(db);
  return result.insertId;
};

export const updateSavingsAmountUsed = async (expenseId, amountUsed) => {
  const numericAmount = Number(amountUsed);
  if (!Number.isInteger(Number(expenseId)) || !Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error(t("Enter a valid amount used from savings."));
  }
  const result = await getDB().executeAsync(
    `UPDATE months_expenses
     SET savings_used = ?
     WHERE id = ? AND is_savings = 1;`,
    [numericAmount, Number(expenseId)],
  );
  if (result.rowsAffected === 0) {
    throw new Error(t("The savings movement could not be found."));
  }
};

export const deleteExpense = async id => {
  const db = getDB();
  await db.executeAsync("DELETE FROM expense_tags WHERE expense_id = ?;", [id]);
  await db.executeAsync("DELETE FROM months_expenses WHERE id = ?;", [id]);
};

export const stopExpenseRecurrence = async id => {
  await getDB().executeAsync(
    `UPDATE months_expenses
     SET recurrence_active = 0, recurrence_stopped_date = ?
     WHERE id = ?
       AND recurrence_frequency IS NOT NULL
       AND recurrence_active = 1;`,
    [getLocalDate(), id],
  );
};

export const deleteSavingsGroupTag = async tagId => {
  const db = getDB();
  await db.executeAsync(
    `DELETE FROM expense_tags
     WHERE tag_id = ?
       AND expense_id IN (
         SELECT id FROM months_expenses WHERE is_savings = 1
       );`,
    [tagId],
  );
  await db.executeAsync(
    "UPDATE tags SET is_savings_group = 0 WHERE id = ?;",
    [tagId],
  );
  await db.executeAsync(
    `DELETE FROM tags
     WHERE id = ?
       AND NOT EXISTS (SELECT 1 FROM expense_tags WHERE tag_id = ?)
       AND NOT EXISTS (SELECT 1 FROM subscriptions WHERE tag_id = ?);`,
    [tagId, tagId, tagId],
  );
};

export const assignSavingsMovementTag = async (expenseId, tagId) => {
  const db = getDB();
  const expense = await db.execute(
    "SELECT id FROM months_expenses WHERE id = ? AND is_savings = 1;",
    [expenseId],
  );
  if (!expense.rows.length) {
    throw new Error(t("The savings movement could not be found."));
  }
  await db.executeAsync(
    "INSERT OR IGNORE INTO expense_tags (expense_id, tag_id) VALUES (?, ?);",
    [expenseId, tagId],
  );
  await syncSavingsGroupFlags(db);
};

export const getExpensesBy = async ({
  name = null,
  minValue = null,
  maxValue = null,
  tagId = null,
  accountId = null,
  dateFrom = null,
  dateTo = null,
  kind = null,
  isSavings = null,
} = {}) => {
  let query = `
    SELECT DISTINCT e.*, GROUP_CONCAT(t.name, ', ') AS tags,
      GROUP_CONCAT(et.tag_id, ',') AS tag_ids
    FROM months_expenses e
    LEFT JOIN expense_tags et ON e.id = et.expense_id
    LEFT JOIN tags t ON et.tag_id = t.id
    WHERE 1 = 1
  `;
  const params = [];
  if (name) {
    query += " AND e.name LIKE ?";
    params.push(`%${name}%`);
  }
  if (minValue !== null) {
    query += " AND e.value >= ?";
    params.push(minValue);
  }
  if (maxValue !== null) {
    query += " AND e.value <= ?";
    params.push(maxValue);
  }
  if (accountId !== null) {
    query += " AND e.account_id = ?";
    params.push(accountId);
  }
  if (tagId !== null) {
    query += " AND et.tag_id = ?";
    params.push(tagId);
  }
  if (dateFrom) {
    query += " AND substr(e.date, 1, 10) >= ?";
    params.push(dateFrom);
  }
  if (dateTo) {
    query += " AND substr(e.date, 1, 10) <= ?";
    params.push(dateTo);
  }
  if (kind) {
    query += " AND e.kind = ?";
    params.push(kind);
  }
  if (isSavings !== null) {
    query += " AND e.is_savings = ?";
    params.push(isSavings ? 1 : 0);
  }
  query += " GROUP BY e.id ORDER BY e.date DESC, e.id DESC;";
  return readRows(await getDB().execute(query, params));
};

export const getExpensesForToday = async () =>
  getExpensesBy({
    dateFrom: getLocalDate(),
    dateTo: getLocalDate(),
    kind: "expense",
  });

export const getExpensesForMonth = async (year, month) => {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  const result = await getDB().execute(
    `SELECT * FROM months_expenses
     WHERE date >= ? AND date < ?
     ORDER BY date ASC, id ASC;`,
    [start, end],
  );
  return readRows(result);
};

export const addSubscription = async ({
  name,
  amount,
  accountId,
  tagId,
  startDate,
  frequency,
  intervalDays,
}) => {
  const normalizedName = name.trim();
  const numericAmount = Number(amount);
  if (!normalizedName || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error(t("Enter a subscription name and a positive amount."));
  }
  if (!isValidLocalDate(startDate) || !["monthly", "annual", "custom"].includes(frequency)) {
    throw new Error(t("Choose a start date and a valid recurrence."));
  }
  if (frequency === "custom" && (!Number.isInteger(intervalDays) || intervalDays < 1)) {
    throw new Error(t("Custom recurrence must be at least one day."));
  }
  const db = getDB();
  const resolvedAccountId = accountId ?? (await getDefaultAccountId(db));
  await db.executeAsync(
    `INSERT INTO subscriptions
      (name, amount, account_id, tag_id, start_date, frequency, interval_days)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      normalizedName,
      numericAmount,
      resolvedAccountId,
      tagId ?? null,
      startDate,
      frequency,
      frequency === "custom" ? intervalDays : null,
    ],
  );
};

export const getSubscriptions = async () => {
  const result = await getDB().execute(
    `SELECT s.*, a.name AS account_name, t.name AS tag_name
     FROM subscriptions s
     LEFT JOIN accounts a ON a.id = s.account_id
     LEFT JOIN tags t ON t.id = s.tag_id
     ORDER BY s.active DESC, s.name COLLATE NOCASE ASC;`,
  );
  return readRows(result);
};

export const setSubscriptionActive = async (id, active) => {
  await getDB().executeAsync(
    "UPDATE subscriptions SET active = ? WHERE id = ?;",
    [active ? 1 : 0, id],
  );
};

export const deleteSubscription = async id => {
  await getDB().executeAsync("DELETE FROM subscriptions WHERE id = ?;", [id]);
};

export const getAccountTransfers = async () => {
  const result = await getDB().execute(
    `SELECT t.*, source.name AS from_account_name, destination.name AS to_account_name
     FROM account_transfers t
     LEFT JOIN accounts source ON source.id = t.from_account_id
     LEFT JOIN accounts destination ON destination.id = t.to_account_id
     ORDER BY t.date DESC, t.id DESC;`,
  );
  return readRows(result);
};

export const createAccountTransfer = async ({
  date,
  fromAccountId,
  toAccountId,
  amount,
  availableBalance,
  recurrenceFrequency = null,
  recurrenceEndDate = null,
  description = "",
}) => {
  const numericAmount = Number(amount);
  const numericAvailableBalance = Number(availableBalance);
  if (
    !isValidLocalDate(date) ||
    !Number.isInteger(Number(fromAccountId)) ||
    Number(fromAccountId) < 1 ||
    !Number.isInteger(Number(toAccountId)) ||
    Number(toAccountId) < 1 ||
    Number(fromAccountId) === Number(toAccountId) ||
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0 ||
    !Number.isFinite(numericAvailableBalance) ||
    numericAvailableBalance < numericAmount ||
    (recurrenceFrequency !== null &&
      !["weekly", "monthly", "yearly"].includes(recurrenceFrequency)) ||
    (recurrenceEndDate !== null &&
      (!isValidLocalDate(recurrenceEndDate) ||
        recurrenceEndDate < date ||
        recurrenceFrequency === null))
  ) {
    throw new Error(
      t("Choose a valid date, two different accounts, and an amount within the source account's available balance."),
    );
  }
  const result = await getDB().executeAsync(
    `INSERT INTO account_transfers
      (date, from_account_id, to_account_id, amount, description,
       recurrence_frequency, recurrence_end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      date,
      Number(fromAccountId),
      Number(toAccountId),
      numericAmount,
      description.trim() || null,
      recurrenceFrequency,
      recurrenceEndDate,
    ],
  );
  return result.insertId;
};

export const deleteAccountTransfer = async id => {
  const result = await getDB().executeAsync(
    "DELETE FROM account_transfers WHERE id = ?;",
    [Number(id)],
  );
  if (result.rowsAffected === 0) {
    throw new Error(t("The account transfer could not be found."));
  }
};

export const stopAccountTransferRecurrence = async id => {
  const result = await getDB().executeAsync(
    `UPDATE account_transfers
     SET recurrence_active = 0, recurrence_stopped_date = ?
     WHERE id = ?
       AND recurrence_frequency IS NOT NULL
       AND recurrence_active = 1;`,
    [getLocalDate(), Number(id)],
  );
  if (result.rowsAffected === 0) {
    throw new Error(t("This recurring transfer is already stopped or no longer exists."));
  }
};

export const getCashflowData = async () => {
  const [
    salary,
    expenses,
    accounts,
    tags,
    subscriptions,
    salaryChanges,
    salaryDeductions,
    otherTaxes,
    accountTransfers,
  ] = await Promise.all([
    getSalaryRow(),
    getExpensesBy(),
    getAccountsCreated(),
    getAllTags(),
    getSubscriptions(),
    getSalaryScheduleChanges(),
    getDB().execute(
      "SELECT min_salary, max_salary, percentage FROM salary_deductions ORDER BY min_salary;",
    ),
    getDB().execute("SELECT name, percentage FROM other_taxes;"),
    getAccountTransfers(),
  ]);
  return {
    salary,
    expenses,
    accounts,
    tags,
    subscriptions,
    salaryChanges,
    salaryDeductions: readRows(salaryDeductions),
    otherTaxes: readRows(otherTaxes),
    accountTransfers,
  };
};

export const exportDatabaseBackup = async () => {
  const db = getDB();
  const tables = {};
  for (const table of DATABASE_TABLES) {
    tables[table] = readRows(await db.execute(`SELECT * FROM "${table}";`));
  }
  return {
    format: DATABASE_BACKUP_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
};

const validateDatabaseBackup = async backup => {
  if (
    !backup ||
    backup.format !== DATABASE_BACKUP_FORMAT ||
    backup.version !== 1 ||
    !backup.tables ||
    typeof backup.tables !== "object" ||
    Array.isArray(backup.tables)
  ) {
    throw new Error(t("This is not a supported Expense Planner database backup."));
  }
  const providedTables = Object.keys(backup.tables).sort();
  const expectedTables = [...DATABASE_TABLES]
    .filter(table => table !== "account_transfers")
    .sort();
  const allowedTables = [...DATABASE_TABLES].sort();
  if (
    providedTables.some(table => !allowedTables.includes(table)) ||
    expectedTables.some(table => !providedTables.includes(table))
  ) {
    throw new Error(t("The backup does not contain all expected database tables."));
  }

  const db = getDB();
  const columnsByTable = new Map();
  for (const table of DATABASE_TABLES) {
    const columns = readRows(await db.execute(`PRAGMA table_info("${table}");`));
    const columnNames = new Set(columns.map(column => column.name));
    columnsByTable.set(table, columnNames);
    if (
      backup.tables[table] !== undefined &&
      !Array.isArray(backup.tables[table])
    ) {
      throw new Error(t('The backup data for "{table}" is invalid.', { table }));
    }
    for (const row of backup.tables[table] || []) {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw new Error(t('The backup contains an invalid row in "{table}".', { table }));
      }
      for (const [column, value] of Object.entries(row)) {
        if (!columnNames.has(column)) {
          throw new Error(
            t('The backup contains an unsupported "{field}" field.', { field: `${table}.${column}` }),
          );
        }
        if (
          value !== null &&
          typeof value !== "string" &&
          typeof value !== "number" &&
          typeof value !== "boolean"
        ) {
          throw new Error(t('The backup contains an invalid value in "{table}".', { table }));
        }
        if (typeof value === "number" && !Number.isFinite(value)) {
          throw new Error(t('The backup contains an invalid number in "{table}".', { table }));
        }
      }
    }
  }
  return columnsByTable;
};

export const replaceDatabaseFromBackup = async backupContent => {
  let backup;
  try {
    backup =
      typeof backupContent === "string"
        ? JSON.parse(backupContent)
        : backupContent;
  } catch (error) {
    throw new Error(t("The selected backup file is not valid JSON."));
  }

  const columnsByTable = await validateDatabaseBackup(backup);
  const db = getDB();
  // Backups made before languages existed should not switch the app's language.
  const languageBeforeRestore = (await getSalaryRow())?.language;
  let transactionStarted = false;
  try {
    await db.executeAsync("PRAGMA foreign_keys = OFF;");
    await db.executeAsync("BEGIN IMMEDIATE;");
    transactionStarted = true;

    for (const table of [...DATABASE_TABLES].reverse()) {
      await db.executeAsync(`DELETE FROM "${table}";`);
    }

    for (const table of DATABASE_TABLES) {
      const allowedColumns = columnsByTable.get(table);
      for (const row of backup.tables[table] || []) {
        const entries = Object.entries(
          table === "salary" && row.language === undefined && languageBeforeRestore
            ? { ...row, language: languageBeforeRestore }
            : row,
        ).filter(([column]) =>
          allowedColumns.has(column),
        );
        if (!entries.length) {
          throw new Error(t('The backup contains an empty row in "{table}".', { table }));
        }
        const columns = entries.map(([column]) => `"${column}"`).join(", ");
        const placeholders = entries.map(() => "?").join(", ");
        const values = entries.map(([, value]) =>
          typeof value === "boolean" ? (value ? 1 : 0) : value,
        );
        await db.executeAsync(
          `INSERT INTO "${table}" (${columns}) VALUES (${placeholders});`,
          values,
        );
      }
    }

    const defaultAccountId = await getDefaultAccountId(db);
    if (defaultAccountId !== null) {
      await db.executeAsync(
        "UPDATE months_expenses SET account_id = ? WHERE account_id IS NULL;",
        [defaultAccountId],
      );
      await db.executeAsync(
        "UPDATE subscriptions SET account_id = ? WHERE account_id IS NULL;",
        [defaultAccountId],
      );
    }
    await syncSavingsGroupFlags(db);

    const foreignKeyViolations = readRows(
      await db.execute("PRAGMA foreign_key_check;"),
    );
    if (foreignKeyViolations.length) {
      throw new Error(t("The backup contains invalid account, tag, or movement references."));
    }
    await db.executeAsync("COMMIT;");
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) {
      try {
        await db.executeAsync("ROLLBACK;");
      } catch (rollbackError) {
        console.error("Failed to roll back database restore:", rollbackError);
      }
    }
    console.error("Database restore failed:", error);
    throw error;
  } finally {
    await db.executeAsync("PRAGMA foreign_keys = ON;");
  }
};

/* ------------------------------------------------------------------ */
/* Movement editing (Balance > movement dashboard > pencil button)     */
/* ------------------------------------------------------------------ */

const MOVEMENT_KINDS = ["income", "expense", "savings", "savings_use"];

const dateParts = value => value.slice(0, 10).split("-").map(Number);

const daysBetweenDates = (from, to) => {
  const [fromYear, fromMonth, fromDay] = dateParts(from);
  const [toYear, toMonth, toDay] = dateParts(to);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) -
      Date.UTC(fromYear, fromMonth - 1, fromDay)) /
      86400000,
  );
};

const addDaysToDate = (value, days) => {
  const [year, month, day] = dateParts(value);
  return getLocalDate(new Date(year, month - 1, day + days, 12));
};

const splitExcludedDates = value =>
  String(value || "")
    .split(",")
    .map(date => date.trim())
    .filter(Boolean);

const EXCLUDABLE_TABLES = {
  expense: "months_expenses",
  subscription: "subscriptions",
  transfer: "account_transfers",
  salary: "salary",
};

const addExcludedDate = async (db, sourceType, sourceId, date) => {
  const table = EXCLUDABLE_TABLES[sourceType];
  const result = await db.execute(
    `SELECT excluded_dates FROM ${table} WHERE id = ?;`,
    [sourceId],
  );
  if (!result.rows.length) {
    throw new Error(t("The original movement could not be found."));
  }
  const dates = new Set(splitExcludedDates(result.rows.item(0).excluded_dates));
  dates.add(date);
  await db.executeAsync(`UPDATE ${table} SET excluded_dates = ? WHERE id = ?;`, [
    [...dates].sort().join(","),
    sourceId,
  ]);
};

const shiftExcludedDates = async (db, sourceType, sourceId, existing, delta) => {
  if (!delta || !existing.excluded_dates) {
    return;
  }
  await db.executeAsync(
    `UPDATE ${EXCLUDABLE_TABLES[sourceType]} SET excluded_dates = ? WHERE id = ?;`,
    [
      splitExcludedDates(existing.excluded_dates)
        .map(date => addDaysToDate(date, delta))
        .sort()
        .join(","),
      sourceId,
    ],
  );
};

const readSingleRow = async (db, query, params) => {
  const result = await db.execute(query, params);
  return result.rows.length ? result.rows.item(0) : null;
};

const validateMovementValues = values => {
  const amount = Number(values.amount);
  const inflated =
    values.inflatedValue === undefined ||
    values.inflatedValue === null ||
    values.inflatedValue === ""
      ? null
      : Number(values.inflatedValue);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(t("Enter a positive amount."));
  }
  if (!isValidLocalDate(values.date)) {
    throw new Error(t("Enter a valid date."));
  }
  if (inflated !== null && (!Number.isFinite(inflated) || inflated < amount)) {
    throw new Error(t("The projected amount must be at least the actual amount."));
  }
  return { amount, inflated };
};

const validateRecurrence = (frequency, endDate, startDate, kind) => {
  if (!frequency) {
    return;
  }
  if (
    !["weekly", "monthly", "yearly"].includes(frequency) ||
    kind === "income" ||
    kind === "savings_use"
  ) {
    throw new Error(
      t("Only deductions and savings can repeat. Turn off repeating or change the type."),
    );
  }
  if (endDate && (!isValidLocalDate(endDate) || endDate < startDate)) {
    throw new Error(t("Choose a valid recurrence end date."));
  }
};

const savingsFlagsFor = (kind, existing) => {
  if (existing && existing.kind === kind) {
    return {
      isSavings: Number(existing.is_savings) === 1 ? 1 : 0,
      isSavingsWithdrawal: Number(existing.is_savings_withdrawal) === 1 ? 1 : 0,
    };
  }
  return {
    isSavings: kind === "savings" ? 1 : 0,
    isSavingsWithdrawal: kind === "savings_use" ? 1 : 0,
  };
};

const replaceExpenseTags = async (db, expenseId, tagIds) => {
  if (!Array.isArray(tagIds)) {
    return;
  }
  await db.executeAsync("DELETE FROM expense_tags WHERE expense_id = ?;", [
    expenseId,
  ]);
  for (const tagId of tagIds) {
    await db.executeAsync(
      "INSERT OR IGNORE INTO expense_tags (expense_id, tag_id) VALUES (?, ?);",
      [expenseId, tagId],
    );
  }
  await syncSavingsGroupFlags(db);
};

const insertStandaloneExpense = async (db, values, existing) => {
  const { amount, inflated } = validateMovementValues(values);
  if (!MOVEMENT_KINDS.includes(values.kind)) {
    throw new Error(t("Choose a valid transaction type."));
  }
  const name = String(values.name || "").trim();
  if (!name) {
    throw new Error(t("Enter a name."));
  }
  const flags = savingsFlagsFor(values.kind, existing);
  const accountId = values.accountId ?? (await getDefaultAccountId(db));
  const result = await db.executeAsync(
    `INSERT INTO months_expenses
      (date, name, description, value, inflated_value, account_id, kind,
       is_savings, is_savings_withdrawal)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      values.date,
      name,
      String(values.description || "").trim() || null,
      amount,
      values.kind === "expense" ? inflated : null,
      accountId,
      values.kind,
      flags.isSavings,
      flags.isSavingsWithdrawal,
    ],
  );
  await replaceExpenseTags(db, result.insertId, values.tagIds || []);
  return result.insertId;
};

const updateExpenseRow = async (db, existing, values, startDate) => {
  const { amount, inflated } = validateMovementValues({
    ...values,
    date: startDate,
  });
  if (!MOVEMENT_KINDS.includes(values.kind)) {
    throw new Error(t("Choose a valid transaction type."));
  }
  const name = String(values.name || "").trim();
  if (!name) {
    throw new Error(t("Enter a name."));
  }
  const frequency = values.recurrenceFrequency || null;
  const endDate = frequency ? values.recurrenceEndDate || null : null;
  validateRecurrence(frequency, endDate, startDate, values.kind);
  const wasRecurring = Boolean(existing.recurrence_frequency);
  const flags = savingsFlagsFor(values.kind, existing);
  await db.executeAsync(
    `UPDATE months_expenses
     SET date = ?, name = ?, description = ?, value = ?, inflated_value = ?,
         account_id = ?, kind = ?, is_savings = ?, is_savings_withdrawal = ?,
         recurrence_frequency = ?, recurrence_end_date = ?,
         recurrence_active = ?, recurrence_stopped_date = ?
     WHERE id = ?;`,
    [
      startDate,
      name,
      String(values.description || "").trim() || null,
      amount,
      values.kind === "expense" ? inflated : null,
      values.accountId ?? existing.account_id ?? (await getDefaultAccountId(db)),
      values.kind,
      flags.isSavings,
      flags.isSavingsWithdrawal,
      frequency,
      endDate,
      frequency && wasRecurring ? existing.recurrence_active ?? 1 : 1,
      frequency && wasRecurring ? existing.recurrence_stopped_date : null,
      existing.id,
    ],
  );
  await replaceExpenseTags(db, existing.id, values.tagIds);
  await shiftExcludedDates(
    db,
    "expense",
    existing.id,
    existing,
    daysBetweenDates(existing.date, startDate),
  );
};

const insertStandaloneTransfer = async (db, values) => {
  await db.executeAsync(
    `INSERT INTO account_transfers
      (date, from_account_id, to_account_id, amount, description)
     VALUES (?, ?, ?, ?, ?);`,
    [
      values.date,
      Number(values.fromAccountId),
      Number(values.toAccountId),
      Number(values.amount),
      String(values.description || "").trim() || null,
    ],
  );
};

const validateTransferValues = values => {
  validateMovementValues(values);
  if (
    !Number.isInteger(Number(values.fromAccountId)) ||
    !Number.isInteger(Number(values.toAccountId)) ||
    Number(values.fromAccountId) < 1 ||
    Number(values.toAccountId) < 1 ||
    Number(values.fromAccountId) === Number(values.toAccountId)
  ) {
    throw new Error(t("Choose two different accounts for the transfer."));
  }
};

/**
 * Saves an edit made from the Edit movement screen.
 *  sourceType: "expense" | "subscription" | "transfer" | "salary"
 *  scope: "instance" (only the selected occurrence) | "all" (whole series)
 *  occurrenceDate: the date of the occurrence that was opened
 * "all" on a series shifts the series start by the same number of days the
 * opened occurrence was moved, so editing the date of one occurrence moves
 * every occurrence.
 */
export const saveMovementEdit = async ({
  sourceType,
  sourceId,
  scope,
  occurrenceDate,
  values,
}) => {
  const db = getDB();
  const id = Number(sourceId);
  if (sourceType === "expense") {
    const existing = await readSingleRow(
      db,
      "SELECT * FROM months_expenses WHERE id = ?;",
      [id],
    );
    if (!existing) {
      throw new Error(t("The movement could not be found."));
    }
    const recurring = Boolean(existing.recurrence_frequency);
    if (!recurring || scope === "all") {
      const startDate = recurring
        ? addDaysToDate(
            existing.date,
            daysBetweenDates(occurrenceDate, values.date),
          )
        : values.date;
      await updateExpenseRow(db, existing, values, startDate);
      return;
    }
    await insertStandaloneExpense(db, values, existing);
    await addExcludedDate(db, "expense", id, occurrenceDate);
    return;
  }

  if (sourceType === "subscription") {
    const existing = await readSingleRow(
      db,
      "SELECT * FROM subscriptions WHERE id = ?;",
      [id],
    );
    if (!existing) {
      throw new Error(t("The subscription could not be found."));
    }
    if (scope === "instance") {
      await insertStandaloneExpense(db, values, null);
      await addExcludedDate(db, "subscription", id, occurrenceDate);
      return;
    }
    const startDate = addDaysToDate(
      existing.start_date,
      daysBetweenDates(occurrenceDate, values.date),
    );
    const { amount, inflated } = validateMovementValues({
      ...values,
      date: startDate,
    });
    const name = String(values.name || "").trim();
    const frequency = values.frequency;
    const intervalDays = Number(values.intervalDays);
    if (!name) {
      throw new Error(t("Enter a name."));
    }
    if (!["monthly", "annual", "custom"].includes(frequency)) {
      throw new Error(t("Choose a valid recurrence."));
    }
    if (frequency === "custom" && (!Number.isInteger(intervalDays) || intervalDays < 1)) {
      throw new Error(t("Custom recurrence must be at least one day."));
    }
    if (values.kind !== "expense" && values.kind !== "savings") {
      throw new Error(t("A subscription must be a deduction or a savings contribution."));
    }
    await db.executeAsync(
      `UPDATE subscriptions
       SET name = ?, amount = ?, inflated_value = ?, description = ?,
           account_id = ?, tag_id = ?, start_date = ?, frequency = ?,
           interval_days = ?, is_savings = ?
       WHERE id = ?;`,
      [
        name,
        amount,
        values.kind === "expense" ? inflated : null,
        String(values.description || "").trim() || null,
        values.accountId ?? existing.account_id,
        Array.isArray(values.tagIds) ? values.tagIds[0] ?? null : existing.tag_id,
        startDate,
        frequency,
        frequency === "custom" ? intervalDays : null,
        values.kind === "savings" ? 1 : 0,
        id,
      ],
    );
    await shiftExcludedDates(
      db,
      "subscription",
      id,
      existing,
      daysBetweenDates(existing.start_date, startDate),
    );
    return;
  }

  if (sourceType === "transfer") {
    const existing = await readSingleRow(
      db,
      "SELECT * FROM account_transfers WHERE id = ?;",
      [id],
    );
    if (!existing) {
      throw new Error(t("The account transfer could not be found."));
    }
    validateTransferValues(values);
    const recurring = Boolean(existing.recurrence_frequency);
    if (recurring && scope === "instance") {
      await insertStandaloneTransfer(db, values);
      await addExcludedDate(db, "transfer", id, occurrenceDate);
      return;
    }
    const startDate = recurring
      ? addDaysToDate(
          existing.date,
          daysBetweenDates(occurrenceDate, values.date),
        )
      : values.date;
    const frequency = values.recurrenceFrequency || null;
    const endDate = frequency ? values.recurrenceEndDate || null : null;
    if (frequency && !["weekly", "monthly", "yearly"].includes(frequency)) {
      throw new Error(t("Choose a valid recurrence."));
    }
    if (endDate && (!isValidLocalDate(endDate) || endDate < startDate)) {
      throw new Error(t("Choose a valid recurrence end date."));
    }
    await db.executeAsync(
      `UPDATE account_transfers
       SET date = ?, from_account_id = ?, to_account_id = ?, amount = ?,
           description = ?, recurrence_frequency = ?, recurrence_end_date = ?,
           recurrence_active = ?, recurrence_stopped_date = ?
       WHERE id = ?;`,
      [
        startDate,
        Number(values.fromAccountId),
        Number(values.toAccountId),
        Number(values.amount),
        String(values.description || "").trim() || null,
        frequency,
        endDate,
        frequency && recurring ? existing.recurrence_active ?? 1 : 1,
        frequency && recurring ? existing.recurrence_stopped_date : null,
        id,
      ],
    );
    await shiftExcludedDates(
      db,
      "transfer",
      id,
      existing,
      daysBetweenDates(existing.date, startDate),
    );
    return;
  }

  if (sourceType === "salary") {
    // Salary deposits are generated from the salary schedule, so a single
    // deposit is edited by replacing it with a standalone movement.
    await insertStandaloneExpense(db, values, null);
    await addExcludedDate(db, "salary", id, occurrenceDate);
    return;
  }
  throw new Error(t("This movement cannot be edited."));
};

/**
 * Deletes a movement from the Edit movement screen.
 *  scope "instance": only the opened occurrence (the series keeps going)
 *  scope "all": the record and every occurrence derived from it
 */
export const deleteMovement = async ({
  sourceType,
  sourceId,
  scope,
  occurrenceDate,
}) => {
  const db = getDB();
  const id = Number(sourceId);
  if (sourceType === "expense") {
    const existing = await readSingleRow(
      db,
      "SELECT * FROM months_expenses WHERE id = ?;",
      [id],
    );
    if (!existing) {
      throw new Error(t("The movement could not be found."));
    }
    if (!existing.recurrence_frequency || scope === "all") {
      await deleteExpense(id);
    } else {
      await addExcludedDate(db, "expense", id, occurrenceDate);
    }
    return;
  }
  if (sourceType === "subscription") {
    if (scope === "all") {
      await deleteSubscription(id);
    } else {
      await addExcludedDate(db, "subscription", id, occurrenceDate);
    }
    return;
  }
  if (sourceType === "transfer") {
    const existing = await readSingleRow(
      db,
      "SELECT * FROM account_transfers WHERE id = ?;",
      [id],
    );
    if (!existing) {
      throw new Error(t("The account transfer could not be found."));
    }
    if (!existing.recurrence_frequency || scope === "all") {
      await deleteAccountTransfer(id);
    } else {
      await addExcludedDate(db, "transfer", id, occurrenceDate);
    }
    return;
  }
  if (sourceType === "salary") {
    await addExcludedDate(db, "salary", id, occurrenceDate);
    return;
  }
  throw new Error(t("This movement cannot be deleted."));
};
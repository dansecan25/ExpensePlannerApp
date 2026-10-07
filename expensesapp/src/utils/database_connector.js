import { open } from "react-native-nitro-sqlite";

export const getDB = () => {
  if (!globalThis.__financeDB) {
    globalThis.__financeDB = open({ name: "finance123.sqlite" });
  }
  return globalThis.__financeDB;
};

const readRows = result => {
  const rows = [];
  for (let index = 0; index < result.rows.length; index += 1) {
    rows.push(result.rows.item(index));
  }
  return rows;
};

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
          savings_mode_enabled INTEGER NOT NULL DEFAULT 0,
          savings_mode_amount REAL NOT NULL DEFAULT 0,
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
          fixed_day INTEGER
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
          color TEXT NOT NULL DEFAULT '#4261a0'
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
  await ensureColumn(db, "salary", "savings_mode_enabled", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "salary", "savings_mode_amount", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "salary", "setup_complete", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "accounts", "opening_balance", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "tags", "color", "TEXT NOT NULL DEFAULT '#4261a0'");
  await ensureColumn(db, "months_expenses", "kind", "TEXT NOT NULL DEFAULT 'expense'");
  await ensureColumn(db, "months_expenses", "is_savings", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "months_expenses", "recurrence_frequency", "TEXT");
  await ensureColumn(db, "months_expenses", "recurrence_end_date", "TEXT");
  await ensureColumn(db, "months_expenses", "recurrence_active", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "months_expenses", "recurrence_stopped_date", "TEXT");
  await ensureColumn(db, "months_expenses", "is_savings_withdrawal", "INTEGER NOT NULL DEFAULT 0");
  await ensureColumn(db, "months_expenses", "created_at", "TEXT");
  await ensureColumn(db, "months_expenses", "account_id", "INTEGER");
  await db.execute(`
    UPDATE months_expenses
    SET created_at = CURRENT_TIMESTAMP
    WHERE created_at IS NULL;
  `);
};

export const resetDatabase = async () => {
  const db = getDB();
  try {
    await db.executeBatchAsync([
      { query: "DROP TABLE IF EXISTS expense_tags;" },
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
}) => {
  const db = getDB();
  const date = getLocalDate();
  const result = await db.executeAsync(
    `INSERT INTO salary
      (amount, balance, last_deposit, currency, fixed, deposits_date, fixed_day, setup_complete)
     SELECT ?, ?, ?, ?, ?, ?, ?, 0
     WHERE NOT EXISTS (SELECT 1 FROM salary);`,
    [
      Number.isFinite(amount) ? amount : null,
      balance,
      date,
      currency,
      fixed ? 1 : 0,
      deposits_date || null,
      fixed_day ?? null,
    ],
  );
  await db.executeAsync(
    "INSERT OR IGNORE INTO accounts (name, color, opening_balance) VALUES (?, ?, ?);",
    ["Main account", "#4261a0", balance],
  );
  return result.insertId;
};

export const updateSalaryAmount = async amount => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Enter a salary amount greater than zero.");
  }
  const result = await getDB().executeAsync(
    "UPDATE salary SET amount = ? WHERE id = (SELECT id FROM salary ORDER BY id LIMIT 1);",
    [numericAmount],
  );
  if (result.rowsAffected === 0) {
    throw new Error("Set up an income profile before changing the salary.");
  }
};

export const updateSalarySavingsMode = async (enabled, amount) => {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error("Enter a savings amount of zero or more.");
  }
  const result = await getDB().executeAsync(
    `UPDATE salary
     SET savings_mode_enabled = ?, savings_mode_amount = ?
     WHERE id = (SELECT id FROM salary ORDER BY id LIMIT 1);`,
    [enabled ? 1 : 0, numericAmount],
  );
  if (result.rowsAffected === 0) {
    throw new Error("Set up an income profile before enabling Savings mode.");
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
}) => {
  if (!isValidLocalDate(effectiveDate)) {
    throw new Error("Choose a valid salary change effective date.");
  }
  if (!["fixed", "variable", "unemployed"].includes(incomeType)) {
    throw new Error("Choose fixed salary, variable income, or unemployed.");
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
    throw new Error("Enter a valid salary amount and deposit schedule.");
  }
  await getDB().executeBatchAsync([
    {
      query: "DELETE FROM salary_schedule_changes WHERE effective_date = ?;",
      params: [effectiveDate],
    },
    {
      query: `INSERT INTO salary_schedule_changes
        (effective_date, amount, income_type, deposits_date, fixed_day)
        VALUES (?, ?, ?, ?, ?);`,
      params: [
        effectiveDate,
        incomeType === "fixed" ? numericAmount : null,
        incomeType,
        incomeType === "fixed" ? depositsDate : null,
        incomeType === "fixed" && depositsDate === "Fixed date"
          ? Number(fixedDay)
          : null,
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

export const createAccount = async (
  name,
  color = "#4261a0",
  openingBalance = 0,
) => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Account name is required.");
  }
  await getDB().executeAsync(
    "INSERT INTO accounts (name, color, opening_balance) VALUES (?, ?, ?);",
    [normalizedName, color, Number(openingBalance) || 0],
  );
};

export const deleteAccount = async id => {
  const db = getDB();
  const remaining = await db.execute(
    "SELECT id FROM accounts WHERE id != ? ORDER BY id LIMIT 1;",
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
    throw new Error("Tag name is required.");
  }
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    throw new Error("Tag color must be a six-digit hexadecimal color.");
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
    throw new Error("The tag could not be created.");
  }
  return tag;
};

export const getAllTags = async () => {
  const result = await getDB().execute(
    "SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE ASC;",
  );
  return readRows(result);
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
  if (!normalizedName || !Number.isFinite(numericValue) || numericValue <= 0) {
    throw new Error("Enter an expense name and a positive amount.");
  }
  if (!isValidLocalDate(date)) {
    throw new Error("Enter a valid transaction date.");
  }
  const numericInflatedValue =
    inflatedValue === undefined || inflatedValue === null || inflatedValue === ""
      ? null
      : Number(inflatedValue);
  if (
    numericInflatedValue !== null &&
    (!Number.isFinite(numericInflatedValue) || numericInflatedValue < numericValue)
  ) {
    throw new Error("The projected amount must be at least the transaction amount.");
  }
  const recurrenceFrequency = options.recurrenceFrequency ?? null;
  const recurrenceEndDate = options.recurrenceEndDate || null;
  if (
    recurrenceFrequency !== null &&
    (options.kind === "income" ||
      !["weekly", "monthly", "yearly"].includes(recurrenceFrequency))
  ) {
    throw new Error("Choose a valid recurrence for a deduction.");
  }
  if (
    recurrenceEndDate !== null &&
    (!isValidLocalDate(recurrenceEndDate) ||
      recurrenceEndDate < date ||
      recurrenceFrequency === null)
  ) {
    throw new Error("Choose a valid recurrence end date.");
  }
  const db = getDB();
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
      accountId ?? null,
      options.kind === "income" ? "income" : "expense",
      options.isSavings ? 1 : 0,
      recurrenceFrequency,
      recurrenceEndDate,
      options.kind !== "income" && options.isSavingsWithdrawal ? 1 : 0,
    ],
  );

  for (const tagId of tags) {
    await db.executeAsync(
      "INSERT OR IGNORE INTO expense_tags (expense_id, tag_id) VALUES (?, ?);",
      [result.insertId, tagId],
    );
  }
  return result.insertId;
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
    throw new Error("The savings movement could not be found.");
  }
  await db.executeAsync(
    "INSERT OR IGNORE INTO expense_tags (expense_id, tag_id) VALUES (?, ?);",
    [expenseId, tagId],
  );
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
    throw new Error("Enter a subscription name and a positive amount.");
  }
  if (!isValidLocalDate(startDate) || !["monthly", "annual", "custom"].includes(frequency)) {
    throw new Error("Choose a start date and a valid recurrence.");
  }
  if (frequency === "custom" && (!Number.isInteger(intervalDays) || intervalDays < 1)) {
    throw new Error("Custom recurrence must be at least one day.");
  }
  await getDB().executeAsync(
    `INSERT INTO subscriptions
      (name, amount, account_id, tag_id, start_date, frequency, interval_days)
     VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      normalizedName,
      numericAmount,
      accountId ?? null,
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
  };
};

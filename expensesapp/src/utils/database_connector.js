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
          setup_complete INTEGER NOT NULL DEFAULT 1
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
          name TEXT NOT NULL UNIQUE
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
  await ensureColumn(db, "salary", "setup_complete", "INTEGER NOT NULL DEFAULT 1");
  await ensureColumn(db, "accounts", "opening_balance", "REAL NOT NULL DEFAULT 0");
  await ensureColumn(db, "months_expenses", "kind", "TEXT NOT NULL DEFAULT 'expense'");
  await ensureColumn(db, "months_expenses", "is_savings", "INTEGER NOT NULL DEFAULT 0");
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

export const insertSalaryDeductions = async ranges => {
  const db = getDB();
  const statements = [{ query: "DELETE FROM salary_deductions;" }];
  for (const range of ranges) {
    statements.push({
      query: `INSERT INTO salary_deductions (min_salary, max_salary, percentage)
       VALUES (?, ?, ?);`,
      args: [range.min_salary, range.max_salary ?? null, range.percentage],
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
      args: [tax.name, tax.percentage],
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
      args: [range.min_salary, range.max_salary ?? null, range.percentage],
    });
  }
  for (const tax of taxes) {
    statements.push({
      query: "INSERT INTO other_taxes (name, percentage) VALUES (?, ?);",
      args: [tax.name, tax.percentage],
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

export const createTag = async name => {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("Group name is required.");
  }
  await getDB().executeAsync(
    "INSERT OR IGNORE INTO tags (name) VALUES (?);",
    [normalizedName],
  );
};

export const getAllTags = async () => {
  const result = await getDB().execute(
    "SELECT id, name FROM tags ORDER BY name COLLATE NOCASE ASC;",
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
  const db = getDB();
  const result = await db.executeAsync(
    `INSERT INTO months_expenses
      (date, name, description, value, inflated_value, account_id, kind, is_savings)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      date,
      normalizedName,
      description || null,
      numericValue,
      numericInflatedValue,
      accountId ?? null,
      options.kind === "income" ? "income" : "expense",
      options.isSavings ? 1 : 0,
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
    SELECT DISTINCT e.*, GROUP_CONCAT(t.name, ', ') AS tags
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
    salaryDeductions,
    otherTaxes,
  ] = await Promise.all([
    getSalaryRow(),
    getExpensesBy(),
    getAccountsCreated(),
    getAllTags(),
    getSubscriptions(),
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
    salaryDeductions: readRows(salaryDeductions),
    otherTaxes: readRows(otherTaxes),
  };
};

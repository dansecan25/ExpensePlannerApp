import { open } from 'react-native-nitro-sqlite';

let dbInstance = null;

export const getDB = () => {
  if (!globalThis.__financeDB) {
    globalThis.__financeDB = open({ name: 'finance123.sqlite' });
  }
  return globalThis.__financeDB;
};
export const initDatabase = async () => {
  const db = getDB();

  await db.executeBatchAsync([
    {
      query: `
        CREATE TABLE IF NOT EXISTS salary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL,
          balance REAL,
          last_deposit TEXT,
          currency TEXT,
          fixed BOOL,
          deposits_date TEXT,
          fixed_day INTEGER
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS salary_deductions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          min_salary REAL,
          max_salary REAL,
          percentage REAL
        );
      `,
    },
    {
      query:`
      CREATE TABLE IF NOT EXISTS other_taxes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name REAL,
        percentage REAL
      );
      `
    },
    {
      query:`
      CREATE TABLE IF NOT EXISTS yearly_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL UNIQUE
      );
      `
    },
    {
      query: `
      CREATE TABLE IF NOT EXISTS months_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        -- backend sets this automatically (ISO date recommended)
        date TEXT NOT NULL,

        -- expense name (can repeat)
        name TEXT NOT NULL,

        -- optional description
        description TEXT,

        -- real and inflated values
        value REAL NOT NULL,
        inflated_value REAL,

        -- optional account
        account_id INTEGER,

        FOREIGN KEY (account_id) REFERENCES accounts(id)
      );
      `
    },

    {
      query: `
      CREATE TABLE IF NOT EXISTS expense_tags (
        expense_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,

        PRIMARY KEY (expense_id, tag_id),

        FOREIGN KEY (expense_id) REFERENCES months_expenses(id),
        FOREIGN KEY (tag_id) REFERENCES tags(id)
      );
      `
    },

    {
      query:`
      CREATE TABLE IF NOT EXISTS accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL
      );

      `
    },
  ]);
};

export const resetDatabase = async () => {
  const db = getDB();

  try {
    await db.executeBatchAsync([
      {
        query: `DROP TABLE IF EXISTS salary;`,
      },
      {
        query: `DROP TABLE IF EXISTS salary_deductions;`,
      },
      {
        query: `DROP TABLE IF EXISTS other_taxes;`,
      },
      {
        query: `
          CREATE TABLE salary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            amount REAL,
            currency TEXT,
            fixed BOOL,
            deposits_date TEXT,
            fixed_day INTEGER
          );
        `,
      },
      {
        query: `
          CREATE TABLE salary_deductions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            min_salary REAL,
            max_salary REAL,
            percentage REAL
          );
        `,
      },
      {
        query: `
          CREATE TABLE other_taxes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name REAL,
            percentage REAL
          );
        `,
      },
    ]);

    console.log("Database reset successfully");
  } catch (err) {
    console.error("resetDatabase failed:", err);
    throw err;
  }
};


export const getSalary = async () => {
  const db = getDB();

  const result = await db.execute(
    `SELECT amount FROM salary LIMIT 1;`
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows.item(0).amount;
};

export const getSalaryRow = async () => {
  const db = getDB();

  const result = await db.execute(
    `SELECT * FROM salary LIMIT 1;`
  );

  if (!result.rows || result.rows.length === 0) {
    return null;
  }

  return result.rows.item(0);
};
export const addSalary = async ({
  amount,
  currency,
  balance,
  fixed,
  deposits_date,
  fixed_day,
}) => {
  try {
    const db = getDB();

    const todayISO = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    await db.executeAsync(
      `
      INSERT INTO salary (
        amount,
        balance,
        last_deposit,
        currency,
        fixed,
        deposits_date,
        fixed_day
      ) VALUES (?, ?, ?, ?, ?, ?, ?);
      `,
      [
        amount,
        balance,
        todayISO,
        currency,
        fixed ? 1 : 0,
        deposits_date,
        fixed_day ?? null,
      ]
    );
  } catch (err) {
    console.error("addSalary failed:", err);
    throw err;
  }
};


export const insertSalaryDeductions = async (ranges) => {
  const db = getDB();

  for (const r of ranges) {
    if (r.max_salary === null) {
      await db.execute(
        `
        INSERT INTO salary_deductions (min_salary, max_salary, percentage)
        VALUES (?, NULL, ?);
        `,
        [r.min_salary, r.percentage]
      );
    } else {
      await db.execute(
        `
        INSERT INTO salary_deductions (min_salary, max_salary, percentage)
        VALUES (?, ?, ?);
        `,
        [r.min_salary, r.max_salary, r.percentage]
      );
    }
  }
};



export const insertOtherTaxes = async (taxes) => {
  const db = getDB();

  for (const { name, percentage } of taxes) {
    await db.execute(
      `
      INSERT INTO other_taxes (
        name,
        percentage
      ) VALUES (?, ?);
      `,
      [name, percentage]
    );
  }
};

export const insertExpense = async (
  name,
  value,
  inflatedValue,
  tags = [],
  accountId,
  date,
  description
) => {
  const db = getDB();

  const columns = ["date", "name", "value"];
  const placeholders = ["?", "?", "?"];
  const params = [date, name, value];

  if (description !== undefined && description !== "") {
    columns.push("description");
    placeholders.push("?");
    params.push(description);
  }

  if (inflatedValue !== undefined && inflatedValue !== null) {
    columns.push("inflated_value");
    placeholders.push("?");
    params.push(inflatedValue);
  }

  if (accountId !== undefined && accountId !== null) {
    columns.push("account_id");
    placeholders.push("?");
    params.push(accountId);
  }

  const query = `
    INSERT INTO months_expenses (
      ${columns.join(", ")}
    ) VALUES (
      ${placeholders.join(", ")}
    );
  `;

  try {
    const result = await db.executeAsync(query, params);
    const expenseId = result.insertId;

    // insert tag relations
    for (const tagId of tags) {
      await db.executeAsync(
        `
        INSERT INTO expense_tags (expense_id, tag_id)
        VALUES (?, ?);
        `,
        [expenseId, tagId]
      );
    }

    return expenseId;
  } catch (e) {
    console.error("Error when storing on db:", e);
    return -1;
  }
};



export const deleteExpense = async (id) => {
  const db = getDB();

  await db.executeBatchAsync([
    {
      // remove relationships only
      query: `
        DELETE FROM expense_tags
        WHERE expense_id = ?;
      `,
      args: [id],
    },
    {
      // remove the expense itself
      query: `
        DELETE FROM months_expenses
        WHERE id = ?;
      `,
      args: [id],
    },
  ]);
};


//params that are received with value, are the query search params
export const getExpensesBy = async ({
  name = null,
  minValue = null,
  maxValue = null,
  tagId = null,
  accountId = null,
  dateFrom = null,
  dateTo = null,
}) => {
  const db = getDB();

  let query = `
    SELECT DISTINCT e.*
    FROM months_expenses e
    LEFT JOIN expense_tags et ON e.id = et.expense_id
    WHERE 1 = 1
  `;

  const params = [];

  if (name) {
    query += ` AND e.name LIKE ?`;
    params.push(`%${name}%`);
  }

  if (minValue !== null) {
    query += ` AND e.value >= ?`;
    params.push(minValue);
  }

  if (maxValue !== null) {
    query += ` AND e.value <= ?`;
    params.push(maxValue);
  }

  if (accountId !== null) {
    query += ` AND e.account_id = ?`;
    params.push(accountId);
  }

  if (tagId !== null) {
    query += ` AND et.tag_id = ?`;
    params.push(tagId);
  }

  if (dateFrom) {
    query += ` AND e.date >= ?`;
    params.push(dateFrom);
  }

  if (dateTo) {
    query += ` AND e.date <= ?`;
    params.push(dateTo);
  }

  const result = await db.execute(query, params);

  const expenses = [];
  for (let i = 0; i < result.rows.length; i++) {
    expenses.push(result.rows.item(i));
  }

  return expenses;
};

export const getExpensesForToday = async () => {
  try{
    const db = getDB();

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const result = await db.execute(
      `
      SELECT id, name, value, inflated_value
      FROM months_expenses
      WHERE date LIKE ?
      ORDER BY date DESC;
      `,
      [`${today}%`]
    );

    const expenses = [];
    for (let i = 0; i < result.rows.length; i++) {
      expenses.push(result.rows.item(i));
    }
    console.log("Day expenses are: ",expenses)
    return expenses;
  }catch(e){
    console.error("Error while getting day expenses: ",e);
    return [];
  }
};


//get all accounts created on db
export const getAccountsCreated = async () => {
  const db = getDB();

  const result = await db.execute(
    `SELECT * FROM accounts ORDER BY name ASC;`
  );

  const accounts = [];
  for (let i = 0; i < result.rows.length; i++) {
    accounts.push(result.rows.item(i));
  }

  return accounts;
};

export const getExpensesForMonth = async (year, month) => {
  const db = getDB();

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
  //console.log("Calling get expenses");
  const result = await db.execute(
    `
    SELECT id, name, value, inflated_value, date, account_id
    FROM months_expenses
    WHERE date >= ? AND date < ?
    ORDER BY date ASC;
    `,
    [start, end]
  );

  const expenses = [];
  for (let i = 0; i < result.rows.length; i++) {
    expenses.push(result.rows.item(i));
  }
  return expenses;
};


export const createTag = async (name) => {
  const db = getDB();

  await db.executeAsync(
    `
    INSERT OR IGNORE INTO tags (name)
    VALUES (?);
    `,
    [name.trim()]
  );
};


export const getAllTags = async () => {
  const db = getDB();

  const result = await db.execute(
    `
    SELECT id, name
    FROM tags
    ORDER BY name ASC;
    `
  );

  return result.rows?._array ?? [];
};


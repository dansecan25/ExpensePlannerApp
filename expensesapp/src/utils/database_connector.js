import { open } from 'react-native-nitro-sqlite';

let dbInstance = null;

export const getDB = () => {
  if (!globalThis.__financeDB) {
    globalThis.__financeDB = open({ name: 'finance3.sqlite' });
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
    }
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
  fixed,
  deposits_date,
  fixed_day,
}) => {
  try {
    console.log("Getting db")
    const db = getDB();
    console.log("DB WENT THROUGH, SALARY IS: ",amount)
    console.log(currency)
    console.log(fixed)
    console.log(deposits_date)
    console.log(fixed_day)
    await db.executeAsync(
      `
      INSERT INTO salary (
        amount,
        currency,
        fixed,
        deposits_date,
        fixed_day
      ) VALUES (?, ?, ?, ?, ?);
      `,
      [
        amount,
        currency,
        fixed ? 1 : 0,
        deposits_date,
        fixed_day,
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





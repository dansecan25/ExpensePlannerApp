import { open } from 'react-native-nitro-sqlite';

let dbInstance = null;

export const getDB = () => {
  if (!dbInstance) {
    dbInstance = open({ name: 'finance.sqlite' });
  }
  return dbInstance;
};

export const initDatabase = async () => {
  const db = getDB();

  await db.executeBatchAsync([
    {
      query: `
        CREATE TABLE IF NOT EXISTS user_settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          first_time BOOLEAN,
          theme TEXT
        );
      `,
    },
    {
      query: `
        CREATE TABLE IF NOT EXISTS salary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          amount REAL,
          pay_type TEXT,
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
  ]);
};

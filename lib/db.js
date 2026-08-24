import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    const usaSSL =
      process.env.NODE_ENV === 'production' ||
      /sslmode=require/.test(connectionString || '');
    pool = new Pool({
      connectionString,
      ssl: usaSSL ? { rejectUnauthorized: false } : false,
    });
  }
  return pool;
}

export async function query(text, params) {
  const pool = getPool();
  const result = await pool.query(text, params);
  return result.rows;
}

export async function getClient() {
  const pool = getPool();
  return pool.connect();
}
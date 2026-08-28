import { Pool } from 'pg';

let pool;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL || '';
    const usaSSL =
      process.env.NODE_ENV === 'production' ||
      /sslmode=/.test(connectionString);
    // Limpia sslmode de la URL para evitar el Warning de pg-connection-string
    // y lo manejamos manualmente con ssl: { rejectUnauthorized: false }
    const cleanConnectionString = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '').replace(/\?&/, '?');
    pool = new Pool({
      connectionString: cleanConnectionString || connectionString,
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
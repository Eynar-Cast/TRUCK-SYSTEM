/**
 * ejecutar-migraciones.js — Aplica los archivos SQL de db/migraciones en orden.
 *
 * - Cada archivo se ejecuta completo (pg admite múltiples sentencias).
 * - Los archivos son idempotentes (IF NOT EXISTS / ON CONFLICT),
 *   por lo que re-ejecutarlos es seguro.
 * - Uso:  node scripts/ejecutar-migraciones.js
 *   (requiere DATABASE_URL en el entorno o en .env.local)
 */
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

function cargarEnvLocal() {
  if (process.env.DATABASE_URL) return;
  const ruta = path.join(__dirname, '..', '.env.local');
  if (!fs.existsSync(ruta)) return;
  for (const linea of fs.readFileSync(ruta, 'utf8').split(/\r?\n/)) {
    const m = linea.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
    if (m) {
      process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, '');
      return;
    }
  }
}

async function main() {
  cargarEnvLocal();
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL no definida (.env.local o entorno).');
    process.exit(1);
  }

  const carpeta = path.join(__dirname, '..', 'db', 'migraciones');
  const archivos = fs.readdirSync(carpeta).filter(f => f.endsWith('.sql')).sort();

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=require/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false,
  });

  for (const archivo of archivos) {
    const sql = fs.readFileSync(path.join(carpeta, archivo), 'utf8');
    try {
      await pool.query(sql);
      console.log(`OK  ${archivo}`);
    } catch (err) {
      console.error(`FALLO ${archivo}:`, err.message);
      await pool.end();
      process.exit(1);
    }
  }

  await pool.end();
  console.log(`Migraciones aplicadas: ${archivos.length} archivo(s).`);
}

main().catch(err => { console.error(err); process.exit(1); });

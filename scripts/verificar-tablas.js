/**
 * verificar-tablas.js — Verificación puntual del esquema nuevo (solo lectura).
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
    if (m) { process.env.DATABASE_URL = m[1].trim().replace(/^["']|["']$/g, ''); return; }
  }
}

async function main() {
  cargarEnvLocal();
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=require/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false,
  });
  const tablas = await pool.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('flota','seguros','catalogos','conductor_referencias','conductor_seguros')
    ORDER BY table_name`);
  const colsChoferes = await pool.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_name='choferes' AND column_name IN ('documento','licencia','calificacion') ORDER BY column_name`);
  const catalogos = await pool.query(`SELECT tipo, count(*)::int AS n FROM catalogos GROUP BY tipo ORDER BY tipo`);
  console.log('Tablas:', tablas.rows.map(r => r.table_name).join(', '));
  console.log('Columnas choferes:', colsChoferes.rows.map(r => r.column_name).join(', '));
  console.log('Catálogos sembrados:', JSON.stringify(catalogos.rows));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

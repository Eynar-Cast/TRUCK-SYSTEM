/** Limpieza de datos de prueba usados en la verificación funcional. */
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

  const idsChoferes = await pool.query(`SELECT id FROM choferes WHERE nombre = 'Juan Perez Test'`);
  for (const { id } of idsChoferes.rows) {
    await pool.query('DELETE FROM conductor_seguros WHERE chofer_id = $1', [id]);
    await pool.query('DELETE FROM conductor_referencias WHERE chofer_id = $1', [id]);
  }
  await pool.query(`DELETE FROM choferes WHERE nombre = 'Juan Perez Test'`);
  await pool.query(`DELETE FROM seguros WHERE placa = '1234-BCD' AND poliza LIKE 'POL-TEST%'`);
  const restantesSeguros = await pool.query(`SELECT count(*)::int AS n FROM seguros WHERE placa = '1234-BCD'`);
  if (restantesSeguros.rows[0].n === 0) {
    await pool.query(`DELETE FROM flota WHERE placa = '1234-BCD'`);
  }
  await pool.query(`DELETE FROM catalogos WHERE (tipo='tipo_vehiculo' AND valor='Camion') OR (tipo='modelo' AND valor='500 1622')`);

  const resumen = await pool.query(`
    SELECT
      (SELECT count(*)::int FROM flota) AS flota,
      (SELECT count(*)::int FROM seguros) AS seguros,
      (SELECT count(*)::int FROM choferes) AS choferes,
      (SELECT count(*)::int FROM conductor_referencias) AS referencias,
      (SELECT count(*)::int FROM conductor_seguros) AS seguros_individuales,
      (SELECT count(*)::int FROM catalogos) AS catalogos`);
  console.log('Limpieza OK. Registros actuales:', JSON.stringify(resumen.rows[0]));
  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });

const fs = require('fs'), path = require('path'), { Pool } = require('pg');
let u;
for (const l of fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = l.match(/^\s*DATABASE_URL\s*=\s*(.+)\s*$/);
  if (m) { u = m[1].trim().replace(/^["']|["']$/g, ''); break; }
}
const p = new Pool({ connectionString: u, ssl: /sslmode=require/.test(u) ? { rejectUnauthorized: false } : false });
(async () => {
  await p.query(`DELETE FROM seguros WHERE placa = '1250-FRH'`);
  console.log('polizas 1250-FRH eliminadas, re-insertando en orden correcto...');
  await p.end();
})().catch(e => { console.error(e.message); process.exit(1); });

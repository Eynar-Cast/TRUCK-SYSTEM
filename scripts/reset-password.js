const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const [, , username, password] = process.argv;

  if (!username || !password) {
    console.log('Uso: node --env-file=.env.local scripts/reset-password.js <username> <password-nueva>');
    console.log('Ejemplo: node --env-file=.env.local scripts/reset-password.js admin MiClaveSegura2026');
    process.exit(1);
  }
  if (password.length < 6) {
    console.log('La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=require/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false,
  });

  const hash = await bcrypt.hash(password, 10);
  const res = await pool.query(
    `UPDATE usuarios SET password_hash = $1 WHERE username = $2 RETURNING username, nombre`,
    [hash, username]
  );

  if (res.rowCount === 0) {
    console.log(`⚠️  No existe ningún usuario con username "${username}".`);
  } else {
    console.log(`✅ Contraseña actualizada para: ${res.rows[0].nombre} (${res.rows[0].username})`);
  }

  await pool.end();
}

main().catch(console.error);
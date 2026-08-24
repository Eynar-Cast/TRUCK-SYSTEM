const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

async function main() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=require/.test(process.env.DATABASE_URL || '') ? { rejectUnauthorized: false } : false,
  });

  const username = 'admin';
  const passwordPlano = 'admin123'; // cámbiala después de tu primer login
  const hash = await bcrypt.hash(passwordPlano, 10);

  await pool.query(
    `INSERT INTO usuarios (username, password_hash, nombre, cargo, role)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (username) DO NOTHING`,
    [username, hash, 'Administrador', 'Admin']
  );

  console.log('Usuario admin creado (o ya existía). Usuario: admin / Contraseña: admin123');
  await pool.end();
}

main().catch(console.error);
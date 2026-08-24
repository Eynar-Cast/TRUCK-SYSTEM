import bcrypt from 'bcryptjs';
import { query } from './db';

export async function buscarUsuarioPorUsername(username) {
  const rows = await query(
    'SELECT * FROM usuarios WHERE username = $1 AND activo = true',
    [username]
  );
  return rows[0] || null;
}

export async function verificarPassword(passwordPlano, hash) {
  return bcrypt.compare(passwordPlano, hash);
}

export async function hashPassword(passwordPlano) {
  return bcrypt.hash(passwordPlano, 10);
}
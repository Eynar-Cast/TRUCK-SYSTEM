import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { hashPassword } from '@/lib/auth';

export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const usuarios = await query(`
    SELECT u.id, u.username, u.nombre, u.cargo, u.role, u.activo, u.creado,
           (SELECT COUNT(*) FROM compras c WHERE c.user_id = u.id) AS n_compras
    FROM usuarios u
    WHERE u.role != 'admin'
    ORDER BY u.creado DESC
  `);
  return NextResponse.json({ usuarios });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { username, password, nombre, cargo } = await request.json();
  if (!username?.trim() || !password || !nombre?.trim()) {
    return NextResponse.json({ error: 'Nombre, usuario y contraseña son obligatorios' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const existente = await query('SELECT id FROM usuarios WHERE username = $1', [username.toLowerCase()]);
  if (existente.length > 0) {
    return NextResponse.json({ error: 'Ese nombre de usuario ya existe' }, { status: 400 });
  }

  const hash = await hashPassword(password);
  const rows = await query(
    `INSERT INTO usuarios (username, password_hash, nombre, cargo, role)
     VALUES ($1,$2,$3,$4,'user') RETURNING id, username, nombre, cargo, role, activo, creado`,
    [username.toLowerCase(), hash, nombre, cargo || null]
  );

  return NextResponse.json({ usuario: rows[0] }, { status: 201 });
}
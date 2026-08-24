import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { verificarPassword, hashPassword } from '@/lib/auth';

export async function PUT(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { passwordActual, passwordNuevo } = await request.json();

  if (!passwordActual || !passwordNuevo) {
    return NextResponse.json({ error: 'Completa ambos campos' }, { status: 400 });
  }
  if (passwordNuevo.length < 6) {
    return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 });
  }

  const rows = await query('SELECT password_hash FROM usuarios WHERE id = $1', [sesion.id]);
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  const valida = await verificarPassword(passwordActual, rows[0].password_hash);
  if (!valida) {
    return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 });
  }

  const nuevoHash = await hashPassword(passwordNuevo);
  await query('UPDATE usuarios SET password_hash = $1 WHERE id = $2', [nuevoHash, sesion.id]);

  return NextResponse.json({ ok: true });
}
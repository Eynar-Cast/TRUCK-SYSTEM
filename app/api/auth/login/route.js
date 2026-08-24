import { NextResponse } from 'next/server';
import { buscarUsuarioPorUsername, verificarPassword } from '@/lib/auth';
import { crearSesion } from '@/lib/session';

export async function POST(request) {
  const { username, password } = await request.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: 'Usuario y contraseña son obligatorios' },
      { status: 400 }
    );
  }

  const usuario = await buscarUsuarioPorUsername(username);
  if (!usuario) {
    return NextResponse.json(
      { error: 'Usuario o contraseña incorrectos' },
      { status: 401 }
    );
  }

  const passwordOk = await verificarPassword(password, usuario.password_hash);
  if (!passwordOk) {
    return NextResponse.json(
      { error: 'Usuario o contraseña incorrectos' },
      { status: 401 }
    );
  }

  await crearSesion(usuario);

  return NextResponse.json({
    id: usuario.id,
    nombre: usuario.nombre,
    role: usuario.role,
  });
}
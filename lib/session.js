import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import crypto from 'crypto';
import { query } from './db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const COOKIE_NAME = 'gc_session';
const DURACION = '8h';

/**
 * Crea una sesión nueva para el usuario.
 *
 * Genera un identificador aleatorio ("sid") y lo guarda tanto en la
 * cookie (dentro del JWT) como en la base de datos (usuarios.session_id).
 * Esto invalida automáticamente cualquier sesión anterior de esa misma
 * cuenta: solo el sid más reciente guardado en la BD es válido, así que
 * si alguien ya tenía sesión abierta en otro dispositivo, su cookie deja
 * de servir en cuanto se inicia sesión de nuevo desde otro lado.
 */
export async function crearSesion(usuario) {
  const sid = crypto.randomBytes(16).toString('hex');

  await query('UPDATE usuarios SET session_id = $1 WHERE id = $2', [sid, usuario.id]);

  const token = await new SignJWT({
    id: usuario.id,
    username: usuario.username,
    nombre: usuario.nombre,
    role: usuario.role,
    sid,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(DURACION)
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  });
}

/**
 * Lee y valida la sesión actual.
 *
 * Además de verificar que el JWT sea válido y no haya expirado, confirma
 * contra la base de datos que el "sid" siga siendo el sesión activa de
 * ese usuario. Si alguien inició sesión después desde otro dispositivo,
 * el sid ya no coincide y esta función devuelve null (como si no hubiera
 * sesión), lo que redirige automáticamente a /login.
 */
export async function obtenerSesion() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);

    const rows = await query(
      'SELECT session_id, activo FROM usuarios WHERE id = $1',
      [payload.id]
    );
    const usuario = rows[0];

    if (!usuario || !usuario.activo || usuario.session_id !== payload.sid) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function cerrarSesion() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret);
      // Limpia el session_id en la BD para que esta cookie (si alguien
      // la copiara) tampoco sirva después de cerrar sesión.
      await query('UPDATE usuarios SET session_id = NULL WHERE id = $1 AND session_id = $2', [payload.id, payload.sid]);
    } catch {
      // token inválido o expirado, no hay nada que limpiar
    }
  }

  cookieStore.delete(COOKIE_NAME);
}
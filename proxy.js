import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
// Rutas exclusivas solo para admin
const RUTAS_SOLO_ADMIN = ['/historial', '/usuarios', '/gastos-choferes'];
// Rutas accesibles para admin y secretaria ARIAS
const RUTAS_SECRETARIA = ['/flota', '/viajes', '/impuestos', '/seguros', '/choferes', '/reportes', '/catalogos', '/gastos-placa'];
// Rutas de compras (solo user y admin)
const RUTAS_USER = ['/nueva-compra', '/mis-compras', '/devoluciones', '/gasto-chofer', '/mis-gastos'];

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login') {
    return NextResponse.next();
  }

  const token = request.cookies.get('gc_session')?.value;
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role;
    if (RUTAS_SOLO_ADMIN.some(r => pathname.startsWith(r)) && role !== 'admin') {
      return NextResponse.redirect(new URL(role === 'secretaria' ? '/flota' : '/nueva-compra', request.url));
    }
    if (RUTAS_SECRETARIA.some(r => pathname.startsWith(r)) && !['admin','secretaria'].includes(role)) {
      return NextResponse.redirect(new URL('/nueva-compra', request.url));
    }
    if (RUTAS_USER.some(r => pathname.startsWith(r)) && role === 'secretaria') {
      return NextResponse.redirect(new URL('/flota', request.url));
    }
    // si entra a "/" deja que app/page.js decida
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next|imagenes|favicon.ico).*)'],
};
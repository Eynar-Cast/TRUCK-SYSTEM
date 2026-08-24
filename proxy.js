import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
const RUTAS_ADMIN = ['/historial', '/choferes', '/gastos-choferes', '/usuarios', '/exportar', '/limpiar-datos'];

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
    if (RUTAS_ADMIN.some(r => pathname.startsWith(r)) && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/nueva-compra', request.url));
    }
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next|imagenes|favicon.ico).*)'],
};
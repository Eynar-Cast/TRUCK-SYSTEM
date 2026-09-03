import { NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);
// Rutas exclusivas solo para admin
const RUTAS_SOLO_ADMIN = ['/usuarios'];
// Rutas para admin + supervisor (historial y gastos conductores)
const RUTAS_SUPERVISOR = ['/historial', '/gastos-choferes'];
// Rutas accesibles para admin y secretaria ARIAS (y supervisor)
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
      const dest = role === 'supervisor' ? '/historial' : role === 'secretaria' ? '/flota' : '/nueva-compra';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (RUTAS_SUPERVISOR.some(r => pathname.startsWith(r)) && !['admin','supervisor'].includes(role)) {
      const dest = role === 'secretaria' ? '/flota' : '/nueva-compra';
      return NextResponse.redirect(new URL(dest, request.url));
    }
    if (RUTAS_SECRETARIA.some(r => pathname.startsWith(r)) && !['admin','secretaria','supervisor'].includes(role)) {
      return NextResponse.redirect(new URL('/nueva-compra', request.url));
    }
    if (RUTAS_USER.some(r => pathname.startsWith(r)) && ['secretaria','supervisor'].includes(role)) {
      return NextResponse.redirect(new URL(role==='supervisor' ? '/historial' : '/flota', request.url));
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
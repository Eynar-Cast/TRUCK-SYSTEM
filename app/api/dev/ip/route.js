import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request){
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : request.headers.get('x-real-ip') || 'unknown';
  const rows = await query(`SELECT valor FROM config WHERE clave='dev_ip' LIMIT 1`).catch(()=>[]);
  const allowed = rows[0]?.valor || null;
  return NextResponse.json({ ip, allowed, match: allowed ? ip===allowed : null });
}

export async function POST(request){
  const devKey = request.headers.get('x-dev-key');
  if(devKey !== process.env.DEV_MANTENIMIENTO_KEY){
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const { ip } = await request.json().catch(()=>({}));
  if(!ip) return NextResponse.json({ error: 'IP requerida' }, { status: 400 });
  await query(`INSERT INTO config (clave, valor) VALUES ('dev_ip', $1) ON CONFLICT (clave) DO UPDATE SET valor=$1, actualizado=now()`, [ip]);
  return NextResponse.json({ ok:true, allowed: ip });
}

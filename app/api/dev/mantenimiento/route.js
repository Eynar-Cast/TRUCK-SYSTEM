import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { query } from '@/lib/db';

function hashToken(token){
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function POST(request){
  const devKey = request.headers.get('x-dev-key');
  if(devKey !== process.env.DEV_MANTENIMIENTO_KEY){
    return NextResponse.json({ error: 'No autorizado — solo desarrollador' }, { status: 403 });
  }
  const { token } = await request.json().catch(()=>({}));
  if(!token || typeof token !== 'string' || token.length < 8){
    return NextResponse.json({ error: 'Token requerido' }, { status: 400 });
  }
  const h = hashToken(token.trim());
  const rows = await query(`SELECT id, expira, usado FROM mantenimientos WHERE hash=$1 LIMIT 1`, [h]);
  if(rows.length===0) return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  const row = rows[0];
  if(row.usado) return NextResponse.json({ error: 'Token ya usado' }, { status: 410 });
  if(new Date(row.expira) < new Date()) return NextResponse.json({ error: 'Token expirado' }, { status: 410 });

  await query(`UPDATE mantenimientos SET usado=true, usado_por='dev', usado_en=now() WHERE id=$1`, [row.id]);
  await query(`UPDATE config SET valor = (now() AT TIME ZONE 'America/La_Paz')::date::text, actualizado=now() WHERE clave='ultimo_mantenimiento'`);
  // también actualiza entrega para proxy que usa fecha fija? no, proxy usa entrega fija, pero mantenimientos resetea via config; para que proxy use config, necesitaría leer DB, pero ahora usa fecha fija. Para futuro, dev puede actualizar config y proxy debería leer config - por ahora actualizamos localStorage vía cliente, pero DB queda auditado
  return NextResponse.json({ ok:true, mensaje: 'Mantenimiento validado, contador reiniciado a 0 días' });
}

export async function GET(){
  try{
    const rows = await query(`SELECT valor FROM config WHERE clave='ultimo_mantenimiento' LIMIT 1`);
    const ultimoStr = rows[0]?.valor || '2026-09-01';
    const ultimo = new Date(ultimoStr + 'T00:00:00');
    const ahora = new Date(); ahora.setHours(0,0,0,0);
    // Mensual: vence fin de mes del mes de ultimo (maneja 28-31 días) o 1ero siguiente — ambos cubiertos
    const proximo = new Date(ultimo.getFullYear(), ultimo.getMonth()+1, 0); // último día del mes de ultimo
    // También considerar vencido si ya estamos en mes siguiente (1ero)
    const proximoMes = new Date(ultimo); proximoMes.setMonth(proximoMes.getMonth()+1);
    const vencidoPorMes = ahora.getMonth() !== ultimo.getMonth() || ahora.getFullYear() !== ultimo.getFullYear();
    const dias = Math.max(0, Math.floor((ahora - ultimo)/86400000));
    const vencido = ahora >= proximo || vencidoPorMes;
    return NextResponse.json({
      ultimo_mantenimiento: ultimoStr,
      proximo_mantenimiento: proximo.toISOString().slice(0,10),
      dias,
      vencido,
      mensaje: '87% del uso de la base de datos free es necesario realizar una limpieza por favor contacte al desarrollador',
      contacto: 'EYNAR-CASTAÑETA CELL 69880053'
    });
  }catch(e){
    return NextResponse.json({ error: 'No se pudo obtener estado' }, { status: 500 });
  }
}

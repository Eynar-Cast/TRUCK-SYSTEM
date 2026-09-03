import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

export async function GET(request){
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) return NextResponse.json({ error:'No autorizado'}, {status:403});
  const { searchParams } = new URL(request.url);
  const placa = (searchParams.get('placa')||'').trim().toUpperCase();
  if (!placa) return NextResponse.json({ error:'Placa requerida'}, {status:400});
  const periodo = searchParams.get('periodo')||'todo'; // dia, semana, mes, todo, anual
  const desde = searchParams.get('desde')||'';
  const hasta = searchParams.get('hasta')||'';

  // construir filtro fecha por periodo
  let filtroFecha = '';
  const paramsFecha = [];
  // helper para agregar filtro a queries diferentes columnas
  function whereFecha(col){
    if (desde || hasta){
      let c=[];
      if (desde) c.push(`${col} >= '${desde}'::date`);
      if (hasta) c.push(`${col} < ('${hasta}'::date + interval '1 day')`);
      return c.length ? ` AND ${c.join(' AND ')}` : '';
    }
    if (periodo==='dia') return ` AND ${col} >= date_trunc('day', now() AT TIME ZONE 'America/La_Paz')`;
    if (periodo==='semana') return ` AND ${col} >= date_trunc('week', now() AT TIME ZONE 'America/La_Paz')`;
    if (periodo==='mes') return ` AND ${col} >= date_trunc('month', now() AT TIME ZONE 'America/La_Paz')`;
    if (periodo==='anual') return ` AND ${col} >= date_trunc('year', now() AT TIME ZONE 'America/La_Paz')`;
    return '';
  }
  // para gastos por placa: filtrar por placa exacta
  const flotaRows = await query('SELECT id, placa, marca, modelo FROM flota WHERE placa=$1 LIMIT 1', [placa]);
  const flotaId = flotaRows[0]?.id || null;

  const wherePlaca = 'placa = $1';
  // consultas en paralelo
  const [viajes, gastosChofer, compras, llantas, aceites, impuestos, seguros, segurosCarga] = await Promise.all([
    query(`SELECT count(*)::int as total FROM viajes WHERE placa=$1 ${whereFecha('fecha_carga')}`, [placa]),
    query(`SELECT COALESCE(SUM(monto),0)::float8 as total, COUNT(*)::int as n FROM gastos_chofer WHERE placa=$1 ${whereFecha('fecha')}`, [placa]),
    query(`SELECT COALESCE(SUM(precio),0)::float8 as total, COUNT(*)::int as n FROM compras WHERE placa=$1 ${whereFecha('fecha')}`, [placa]),
    query(`SELECT COALESCE(SUM(costo),0)::float8 as total, COUNT(*)::int as n FROM llantas WHERE flota_id=$1 ${flotaId? whereFecha('fecha_cambio'): ''}`, flotaId?[flotaId]:[0]),
    query(`SELECT COALESCE(SUM(costo),0)::float8 as total, COUNT(*)::int as n FROM aceites WHERE flota_id=$1 ${flotaId? whereFecha('fecha_ultimo_cambio'): ''}`, flotaId?[flotaId]:[0]),
    query(`SELECT COALESCE(SUM(monto),0)::float8 as total, COUNT(*)::int as n FROM impuestos WHERE placa=$1 ${whereFecha('fecha_registro')}`, [placa]),
    query(`SELECT COALESCE(SUM(importe_pagado),0)::float8 as total, COUNT(*)::int as n FROM seguros WHERE placa=$1 ${periodo==='anual' || periodo==='todo' ? '' : whereFecha('fecha_pago')}`, [placa]),
    query(flotaId? `SELECT COALESCE(SUM(0),0)::float8 as total FROM seguros_carga WHERE flota_id=$1` : `SELECT 0::float8 as total`, flotaId?[flotaId]:[]),
  ]);

  // detalle historial
  const [viajesList, llantasList, aceitesList] = await Promise.all([
    query(`SELECT id, fecha_carga, tramo, producto, estado FROM viajes WHERE placa=$1 ORDER BY fecha_carga DESC LIMIT 20`, [placa]),
    flotaId? query(`SELECT id, fecha_cambio, llantas_tracto, llantas_chata, marca, costo, proxima_fecha FROM llantas WHERE flota_id=$1 ORDER BY fecha_cambio DESC LIMIT 20`, [flotaId]): [],
    flotaId? query(`SELECT id, tipo, marca, fecha_ultimo_cambio, costo FROM aceites WHERE flota_id=$1 ORDER BY fecha_ultimo_cambio DESC LIMIT 20`, [flotaId]): [],
  ]);

  const totalGeneral = (gastosChofer[0]?.total||0) + (compras[0]?.total||0) + (llantas[0]?.total||0) + (aceites[0]?.total||0) + (impuestos[0]?.total||0);

  return NextResponse.json({
    placa, flota: flotaRows[0]||null,
    periodo,
    resumen: {
      viajes: viajes[0]?.total||0,
      gastos_chofer: gastosChofer[0],
      repuestos: compras[0],
      llantas: llantas[0],
      aceites: aceites[0],
      impuestos: impuestos[0],
      seguros: seguros[0],
      total_general: totalGeneral,
    },
    historial: { viajes: viajesList, llantas: llantasList, aceites: aceitesList }
  });
}

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';

const PAGE_SIZE = 50;

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const periodo = searchParams.get('periodo') || 'todo';
  const choferId = searchParams.get('choferId') || '';
  const desde = searchParams.get('desde') || '';
  const hasta = searchParams.get('hasta') || '';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit'), 10) || PAGE_SIZE));
  const offset = (page - 1) * limit;

  let whereClauses = ['1=1'];
  const params = [];

  if (sesion.role !== 'admin') {
    params.push(sesion.id);
    whereClauses.push(`g.user_id = $${params.length}`);
  } else if (choferId) {
    params.push(choferId);
    whereClauses.push(`g.chofer_id = $${params.length}`);
  }

  if (desde || hasta) {
    if (desde) { params.push(desde); whereClauses.push(`g.fecha >= $${params.length}::date`); }
    if (hasta) { params.push(hasta); whereClauses.push(`g.fecha < ($${params.length}::date + interval '1 day')`); }
  } else {
    if (periodo === 'dia') whereClauses.push("g.fecha >= date_trunc('day', now())");
    if (periodo === 'semana') whereClauses.push("g.fecha >= date_trunc('week', now())");
    if (periodo === 'mes') whereClauses.push("g.fecha >= date_trunc('month', now())");
  }

  const whereSQL = whereClauses.join(' AND ');

  // Ejecutar query paginada + COUNT EN PARALELO
  const [gastos, countResult] = await Promise.all([
    query(
      `SELECT g.id, g.chofer_id, g.user_id, g.nombre, g.monto, g.descripcion,
             g.tiene_factura, g.pagado, g.tipo_pago, g.fecha,
             c.nombre AS chofer_nombre, c.placa AS chofer_placa, u.nombre AS usuario_nombre
      FROM gastos_chofer g
      JOIN choferes c ON c.id = g.chofer_id
      JOIN usuarios u ON u.id = g.user_id
      WHERE ${whereSQL}
      ORDER BY g.fecha DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total
       FROM gastos_chofer g
       WHERE ${whereSQL}`,
      params
    ),
  ]);

  const totalCount = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  return NextResponse.json({
    gastos,
    pagination: { page, limit, totalCount, totalPages },
  });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { choferId, nombre, monto, descripcion, tieneFactura, fotoFactura, pagado, tipoPago, fotoQr, enlace, numero_factura, numero_comprobante, placa, flota_id } = await request.json();

  if (!choferId) return NextResponse.json({ error: 'Selecciona un chofer' }, { status: 400 });
  if (!nombre?.trim()) return NextResponse.json({ error: 'El nombre del gasto es obligatorio' }, { status: 400 });
  if (!monto || monto <= 0) return NextResponse.json({ error: 'Ingresa un monto válido' }, { status: 400 });
  // ya no es obligatorio QR imagen; se valida texto comprobante opcional
  const enlaceTxt = (enlace || fotoFactura || fotoQr || '').trim() || null;
  const numFact = (numero_factura || '').trim() || null;
  const numComp = (numero_comprobante || '').trim() || null;
  let placaNorm = placa ? String(placa).trim().toUpperCase() : null;
  let flotaId = flota_id ? Number(flota_id) : null;
  if (flotaId && (!Number.isInteger(flotaId)||flotaId<=0)) flotaId=null;
  // si no viene placa/flota, derivar de chofer
  if (!placaNorm && !flotaId) {
    const c = await query('SELECT placa FROM choferes WHERE id=$1', [choferId]);
    if (c.length) placaNorm = c[0].placa;
  }
  if (placaNorm && !flotaId) {
    const f = await query('SELECT id FROM flota WHERE placa=$1 LIMIT 1', [placaNorm]);
    if (f.length) flotaId=f[0].id;
  } else if (flotaId && !placaNorm) {
    const f = await query('SELECT placa FROM flota WHERE id=$1', [flotaId]);
    if (f.length) placaNorm=f[0].placa;
  }

  const rows = await query(
    `INSERT INTO gastos_chofer (chofer_id, user_id, nombre, monto, descripcion, tiene_factura, foto_factura, pagado, tipo_pago, foto_qr, enlace, numero_factura, numero_comprobante, placa, flota_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [choferId, sesion.id, nombre, monto, descripcion || null, !!tieneFactura, fotoFactura || null, !!pagado, pagado ? tipoPago : null, fotoQr || null, enlaceTxt, numFact, numComp, placaNorm, flotaId]
  );

  return NextResponse.json({ gasto: rows[0] }, { status: 201 });
}

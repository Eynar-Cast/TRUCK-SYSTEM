import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { validarImpuesto, normalizarPlaca } from '@/lib/flota';

async function asegurarTablaImpuestos(){
  try{
    await query(`CREATE TABLE IF NOT EXISTS impuestos (
      id SERIAL PRIMARY KEY, flota_id INTEGER REFERENCES flota(id) ON DELETE SET NULL, placa TEXT NOT NULL,
      concepto TEXT, monto NUMERIC(12,2) CHECK (monto IS NULL OR monto >= 0), fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
      pagado BOOLEAN NOT NULL DEFAULT FALSE, fecha_pago DATE, observaciones TEXT, creado TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  }catch{}
}

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try{
    await asegurarTablaImpuestos();
    const { searchParams } = new URL(request.url);
    const placa = searchParams.get('placa')?.trim();
    const pagado = searchParams.get('pagado');
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit'), 10) || 50));
    const offset = (page - 1) * limit;
    const clausulas = [];
    const params = [];
    if (placa) { params.push(placa.toUpperCase()); clausulas.push(`i.placa = $${params.length}`); }
    if (pagado === 'true' || pagado === 'false') { params.push(pagado==='true'); clausulas.push(`i.pagado = $${params.length}`); }
    const where = clausulas.length ? 'WHERE ' + clausulas.join(' AND ') : '';
    const rows = await query(
      `SELECT i.*, f.marca, f.modelo FROM impuestos i LEFT JOIN flota f ON f.id = i.flota_id ${where} ORDER BY i.fecha_registro DESC, i.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    const cnt = await query(`SELECT COUNT(*)::int AS total, SUM(CASE WHEN pagado=false THEN 1 ELSE 0 END)::int AS pendientes, COALESCE(SUM(CASE WHEN pagado=false THEN monto ELSE 0 END),0)::float8 AS deuda FROM impuestos i ${where}`, params);
    return NextResponse.json({ impuestos: rows, resumen: cnt[0], pagination: { page, limit, totalCount: cnt[0]?.total||0, totalPages: Math.ceil((cnt[0]?.total||0)/limit) } });
  }catch(e){
    console.error('GET /api/impuestos', e);
    return NextResponse.json({ error: 'Error al cargar impuestos', impuestos: [], resumen: {total:0,pendientes:0,deuda:0}, pagination:{page:1,limit:50,totalCount:0,totalPages:1} }, {status:500});
  }
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try{
    await asegurarTablaImpuestos();
    const body = await request.json();
    const val = validarImpuesto(body);
    if (!val.ok) return NextResponse.json({ error: val.error }, { status: 400 });
    const d = val.datos;
    let flota_id = d.flota_id;
    let placa = d.placa;
    if (flota_id) {
      const f = await query('SELECT placa FROM flota WHERE id=$1', [flota_id]);
      if (f.length===0) return NextResponse.json({ error: 'Camión no existe' }, { status: 400 });
      placa = f[0].placa;
    } else {
      const f = await query('SELECT id FROM flota WHERE placa=$1 LIMIT 1', [placa]);
      if (f.length>0) flota_id = f[0].id;
      else return NextResponse.json({ error: `La placa ${placa} no existe en Flota` }, { status: 400 });
    }
    if (!flota_id) return NextResponse.json({ error: 'Placa debe ser de un camión registrado' }, { status: 400 });
    const rows = await query(
      `INSERT INTO impuestos (flota_id, placa, concepto, monto, fecha_registro, pagado, fecha_pago, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [flota_id, placa, d.concepto, d.monto, d.fecha_registro, d.pagado, d.fecha_pago, d.observaciones]
    );
    return NextResponse.json({ impuesto: rows[0] }, { status: 201 });
  }catch(e){
    console.error('POST /api/impuestos', e);
    return NextResponse.json({ error: 'Error al crear impuesto' }, { status: 500 });
  }
}

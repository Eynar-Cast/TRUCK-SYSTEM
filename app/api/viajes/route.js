import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { validarViaje, normalizarPlaca } from '@/lib/flota';

async function asegurarTablaViajes() {
  try {
    await query(`CREATE TABLE IF NOT EXISTS viajes (
      id SERIAL PRIMARY KEY, placa TEXT NOT NULL, flota_id INTEGER REFERENCES flota(id) ON DELETE SET NULL,
      tipo TEXT, chofer_id INTEGER REFERENCES choferes(id) ON DELETE SET NULL, chofer_nombre TEXT,
      tramo TEXT, fecha_carga DATE, producto TEXT, cantidad_palets INTEGER CHECK (cantidad_palets IS NULL OR cantidad_palets >= 0),
      fecha_entrada DATE, fecha_llegada DATE, planilla TEXT, codigo_carga TEXT, observaciones TEXT, estado TEXT CHECK (estado IN ('Programado','En ruta','Entregado','Cancelado')) DEFAULT 'En ruta', creado TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    await query(`ALTER TABLE viajes ADD COLUMN IF NOT EXISTS estado TEXT CHECK (estado IN ('Programado','En ruta','Entregado','Cancelado')) DEFAULT 'En ruta'`);
  } catch {}
}

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  try {
    await asegurarTablaViajes();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();
    const placa = searchParams.get('placa')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit'), 10) || 50));
    const offset = (page - 1) * limit;

    const clausulas = [];
    const params = [];
    if (q) {
      params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
      const p1 = params.length - 3, p2 = params.length - 2, p3 = params.length -1, p4 = params.length;
      clausulas.push(`(v.placa ILIKE $${p1} OR v.tramo ILIKE $${p2} OR v.producto ILIKE $${p3} OR COALESCE(v.codigo_carga,'') ILIKE $${p4})`);
    }
    if (placa) {
      params.push(placa.toUpperCase());
      clausulas.push(`v.placa = $${params.length}`);
    }
    const where = clausulas.length ? 'WHERE ' + clausulas.join(' AND ') : '';
    const rows = await query(
      `SELECT v.*, f.id AS flota_exists FROM viajes v LEFT JOIN flota f ON f.id = v.flota_id ${where} ORDER BY v.fecha_carga DESC NULLS LAST, v.id DESC LIMIT $${params.length+1} OFFSET $${params.length+2}`,
      [...params, limit, offset]
    );
    const cnt = await query(`SELECT COUNT(*)::int AS total FROM viajes v ${where}`, params);
    return NextResponse.json({ viajes: rows, pagination: { page, limit, totalCount: cnt[0]?.total||0, totalPages: Math.ceil((cnt[0]?.total||0)/limit) } });
  } catch (e) {
    console.error('GET /api/viajes', e);
    return NextResponse.json({ error: 'Error al cargar viajes', viajes: [], pagination: { page:1, limit:50, totalCount:0, totalPages:1 } }, { status: 500 });
  }
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  try {
    await asegurarTablaViajes();
    const body = await request.json();
    const val = validarViaje(body);
    if (!val.ok) return NextResponse.json({ error: val.error }, { status: 400 });
    const d = val.datos;
  // Derivar flota_id/chofer si no se envió pero placa coincide
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
  let chofer_id = d.chofer_id;
  let chofer_nombre = d.chofer_nombre;
  if (chofer_id) {
    const c = await query('SELECT nombre FROM choferes WHERE id=$1', [chofer_id]);
    if (c.length===0) return NextResponse.json({ error: 'Conductor no existe' }, { status: 400 });
    chofer_nombre = c[0].nombre;
  }
  const rows = await query(
    `INSERT INTO viajes (placa, flota_id, tipo, chofer_id, chofer_nombre, tramo, fecha_carga, producto, cantidad_palets, fecha_entrada, fecha_llegada, planilla, codigo_carga, observaciones, estado)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [placa, flota_id, d.tipo, chofer_id, chofer_nombre, d.tramo, d.fecha_carga, d.producto, d.cantidad_palets, d.fecha_entrada, d.fecha_llegada, d.planilla, d.codigo_carga, d.observaciones, d.estado]
  );
  return NextResponse.json({ viaje: rows[0] }, { status: 201 });
  } catch (e) {
    console.error('POST /api/viajes', e);
    return NextResponse.json({ error: 'Error al crear viaje' }, { status: 500 });
  }
}

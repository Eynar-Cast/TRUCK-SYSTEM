import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

const MESES_CICLO = 3; // cambio programado cada 3 meses

function validarLlantas(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const entero = v => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isInteger(n) && n >= 0 && n <= 30 ? n : undefined;
  };
  const fecha = v => {
    const t = String(v ?? '').trim();
    if (t === '') return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(`${t}T00:00:00`).getTime()) ? t : undefined;
  };

  const tracto = entero(body.llantas_tracto);
  if (tracto === undefined) return { error: 'Cantidad de llantas del tracto inválida' };
  const chata = entero(body.llantas_chata);
  if (chata === undefined) return { error: 'Cantidad de llantas de la chata inválida' };
  if (tracto === null && chata === null) return { error: 'Registre la cantidad de llantas del tracto o de la chata' };

  const cambio = fecha(body.fecha_cambio);
  if (cambio === undefined) return { error: 'Fecha de cambio inválida' };
  let proxima = fecha(body.proxima_fecha);
  if (proxima === undefined) return { error: 'Próxima fecha de cambio inválida' };
  // Ciclo programado: si no se indica próxima, se calcula a 3 meses del último cambio
  if (!proxima && cambio) {
    const d = new Date(`${cambio}T00:00:00`);
    d.setMonth(d.getMonth() + MESES_CICLO);
    proxima = d.toISOString().slice(0, 10);
  }

  return {
    datos: {
      llantas_tracto: tracto,
      llantas_chata: chata,
      marca: texto(body.marca),
      fecha_cambio: cambio,
      proxima_fecha: proxima,
      observacion: texto(body.observacion),
    },
  };
}

export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const validacion = validarLlantas(await request.json());
  if (validacion.error) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  const existe = await query('SELECT id FROM flota WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const rows = await query(
    `INSERT INTO llantas (flota_id, llantas_tracto, llantas_chata, marca, fecha_cambio, proxima_fecha, observacion)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [id, d.llantas_tracto, d.llantas_chata, d.marca, d.fecha_cambio, d.proxima_fecha, d.observacion]
  );
  return NextResponse.json({ llanta: rows[0] }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!esID(itemId)) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

  const rows = await query('DELETE FROM llantas WHERE id = $1 AND flota_id = $2 RETURNING id', [itemId, id]);
  if (rows.length === 0) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

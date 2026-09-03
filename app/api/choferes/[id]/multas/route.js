import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

/** Multas del conductor: fecha, motivo, monto + campos plantilla (placa histórica, nro viaje, pagos). */
function validarMulta(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const t = String(body.fecha ?? '').trim();
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(`${t}T00:00:00`).getTime()) ? t : null;
  if (!fecha) return { error: 'La fecha de la multa es obligatoria' };

  const motivo = texto(body.motivo);
  if (!motivo) return { error: 'El motivo de la multa es obligatorio' };

  let monto = body.monto === '' || body.monto === null || body.monto === undefined ? null : Number(body.monto);
  if (monto !== null && (!isFinite(monto) || monto < 0)) {
    return { error: 'El monto debe ser un número mayor o igual a 0' };
  }

  // Campos plantilla: nro_viaje, placa, flota_id, importe_pagado, fecha_pago
  const nro_viaje = texto(body.nro_viaje);
  let placa = texto(body.placa);
  if (placa) placa = placa.toUpperCase().replace(/\s+/g, '');
  let flota_id = body.flota_id === '' || body.flota_id == null ? null : Number(body.flota_id);
  if (flota_id !== null && (!Number.isInteger(flota_id) || flota_id <= 0)) flota_id = null;

  let importe_pagado = body.importe_pagado === '' || body.importe_pagado == null ? null : Number(body.importe_pagado);
  if (importe_pagado !== null && (!isFinite(importe_pagado) || importe_pagado < 0)) {
    return { error: 'El importe pagado debe ser un número mayor o igual a 0' };
  }
  if (importe_pagado !== null && monto !== null && importe_pagado > monto) {
    return { error: 'El importe pagado no puede ser mayor al monto de la multa' };
  }

  const fp = String(body.fecha_pago ?? '').trim();
  const fecha_pago = fp === '' ? null : (/^\d{4}-\d{2}-\d{2}$/.test(fp) && !isNaN(new Date(`${fp}T00:00:00`).getTime()) ? fp : null);
  if (fp !== '' && !fecha_pago) return { error: 'Fecha de pago inválida (AAAA-MM-DD)' };

  return { datos: { fecha, motivo, monto, observaciones: texto(body.observaciones), nro_viaje, placa, flota_id, importe_pagado, fecha_pago } };
}

export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const validacion = validarMulta(await request.json());
  if (validacion.error) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  const existe = await query('SELECT id FROM choferes WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  // Si se eligió un camión (flota_id), derivar placa para snapshot histórico
  let placaFinal = d.placa;
  let flotaIdFinal = d.flota_id;
  if (flotaIdFinal) {
    const f = await query('SELECT id, placa FROM flota WHERE id = $1', [flotaIdFinal]);
    if (f.length === 0) return NextResponse.json({ error: 'Camión seleccionado no existe' }, { status: 400 });
    placaFinal = f[0].placa;
  } else if (placaFinal) {
    // Intentar resolver flota_id por placa para trazabilidad (no obligatorio)
    const f = await query('SELECT id FROM flota WHERE placa = $1 LIMIT 1', [placaFinal]);
    if (f.length > 0) flotaIdFinal = f[0].id;
  }

  const rows = await query(
    'INSERT INTO multas (chofer_id, fecha, motivo, monto, observaciones, nro_viaje, placa, flota_id, importe_pagado, fecha_pago) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [id, d.fecha, d.motivo, d.monto, d.observaciones, d.nro_viaje, placaFinal, flotaIdFinal, d.importe_pagado, d.fecha_pago]
  );
  return NextResponse.json({ multa: rows[0] }, { status: 201 });
}

export async function PUT(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }
  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });
  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!esID(itemId)) return NextResponse.json({ error: 'Multa no encontrada' }, { status: 404 });
  const body = await request.json();
  // Permitir actualizar solo campos de pago/observaciones sin alterar fecha/motivo original si no se envían
  const importe_pagado = body.importe_pagado === '' || body.importe_pagado == null ? null : Number(body.importe_pagado);
  if (importe_pagado !== null && (!isFinite(importe_pagado) || importe_pagado < 0)) {
    return NextResponse.json({ error: 'Importe pagado inválido' }, { status: 400 });
  }
  const fp = String(body.fecha_pago ?? '').trim();
  const fecha_pago = fp === '' ? null : (/^\d{4}-\d{2}-\d{2}$/.test(fp) && !isNaN(new Date(`${fp}T00:00:00`).getTime()) ? fp : null);
  if (fp !== '' && !fecha_pago) return NextResponse.json({ error: 'Fecha de pago inválida' }, { status: 400 });
  const observaciones = body.observaciones !== undefined ? String(body.observaciones ?? '').trim() || null : undefined;

  // Verificar que la multa existe y pertenece al chofer
  const actual = await query('SELECT monto FROM multas WHERE id=$1 AND chofer_id=$2', [itemId, id]);
  if (actual.length === 0) return NextResponse.json({ error: 'Multa no encontrada' }, { status: 404 });
  if (importe_pagado !== null && actual[0].monto !== null && importe_pagado > Number(actual[0].monto)) {
    return NextResponse.json({ error: 'Importe pagado no puede superar el monto' }, { status: 400 });
  }

  const sets = [];
  const params2 = [];
  if (importe_pagado !== undefined) { params2.push(importe_pagado); sets.push(`importe_pagado=$${params2.length}`); }
  if (fecha_pago !== undefined) { params2.push(fecha_pago); sets.push(`fecha_pago=$${params2.length}`); }
  if (observaciones !== undefined) { params2.push(observaciones); sets.push(`observaciones=$${params2.length}`); }
  if (sets.length === 0) return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  params2.push(itemId, id);
  const sql = `UPDATE multas SET ${sets.join(', ')} WHERE id=$${params2.length-1} AND chofer_id=$${params2.length} RETURNING *`;
  const rows = await query(sql, params2);
  return NextResponse.json({ multa: rows[0] });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Conductor no encontrado' }, { status: 404 });

  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!esID(itemId)) return NextResponse.json({ error: 'Multa no encontrada' }, { status: 404 });

  const rows = await query('DELETE FROM multas WHERE id = $1 AND chofer_id = $2 RETURNING id', [itemId, id]);
  if (rows.length === 0) return NextResponse.json({ error: 'Multa no encontrada' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

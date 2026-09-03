import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { esID } from '@/lib/utils';

const TIPOS = ['motor', 'caja', 'corona'];

function validarAceite(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const fecha = v => {
    const t = String(v ?? '').trim();
    if (t === '') return null;
    return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(`${t}T00:00:00`).getTime()) ? t : undefined;
  };

  if (!TIPOS.includes(body.tipo)) return { error: 'Tipo de aceite inválido (motor, caja o corona)' };

  const ultimo = fecha(body.fecha_ultimo_cambio);
  if (ultimo === undefined) return { error: 'Fecha del último cambio inválida' };
  const proxima = fecha(body.proxima_fecha);
  if (proxima === undefined) return { error: 'Próxima fecha de cambio inválida' };
  if (!ultimo && !proxima) return { error: 'Registre al menos una fecha de cambio' };

  const costo = body.costo===''||body.costo==null?null:Number(body.costo);
  if (costo!==null && (!isFinite(costo)||costo<0)) return { error: 'Costo inválido' };
  return {
    datos: {
      tipo: body.tipo,
      marca: texto(body.marca),
      fecha_ultimo_cambio: ultimo,
      proxima_fecha: proxima,
      observacion: texto(body.observacion),
      costo, numero_factura: texto(body.numero_factura), numero_comprobante: texto(body.numero_comprobante), enlace: texto(body.enlace),
    },
  };
}

export async function POST(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const validacion = validarAceite(await request.json());
  if (validacion.error) return NextResponse.json({ error: validacion.error }, { status: 400 });
  const d = validacion.datos;

  const existe = await query('SELECT id FROM flota WHERE id = $1', [id]);
  if (existe.length === 0) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const rows = await query(
    `INSERT INTO aceites (flota_id, tipo, marca, fecha_ultimo_cambio, proxima_fecha, observacion, costo, numero_factura, numero_comprobante, enlace)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [id, d.tipo, d.marca, d.fecha_ultimo_cambio, d.proxima_fecha, d.observacion, d.costo, d.numero_factura, d.numero_comprobante, d.enlace]
  );
  return NextResponse.json({ aceite: rows[0] }, { status: 201 });
}

export async function DELETE(request, { params }) {
  const sesion = await obtenerSesion();
  if (!sesion || !['admin','secretaria'].includes(sesion.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const { id } = await params;
  if (!esID(id)) return NextResponse.json({ error: 'Vehículo no encontrado' }, { status: 404 });

  const itemId = new URL(request.url).searchParams.get('itemId');
  if (!esID(itemId)) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });

  const rows = await query('DELETE FROM aceites WHERE id = $1 AND flota_id = $2 RETURNING id', [itemId, id]);
  if (rows.length === 0) return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 });
  return NextResponse.json({ ok: true });
}

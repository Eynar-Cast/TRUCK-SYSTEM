import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { obtenerSesion } from '@/lib/session';
import { filtrosFlota, whereDe, joinSeguroActual, joinAlertasMantenimiento, joinViajeActivo, estadoVehiculoSql } from '@/lib/reportes';
import { validarDatosVehiculo, HOY_BOLIVIA_SQL, evaluarProxima, peorEstado, enRutaPorViaje } from '@/lib/flota';

// Orden permitido (lista blanca para evitar inyección en ORDER BY)
const ORDEN = {
  nro: 'f.id',
  placa: 'f.placa',
  tipo: 'f.tipo',
  marca: 'f.marca',
  modelo: 'f.modelo',
  serie: 'f.numero_serie',
  color: 'f.color',
  anio: 'f.anio',
  carga: 'f.carga_maxima_kg',
  estado: estadoVehiculoSql('f'),
};

const PAGE_SIZE = 50;

/** Estado agregado de aceites a partir del JSONB {tipo: próxima fecha}. */
function estadoAceitesDe(porTipo) {
  if (!porTipo || typeof porTipo !== 'object') return { estado: '', detalle: {} };
  const detalle = {};
  const estados = [];
  for (const [tipo, fecha] of Object.entries(porTipo)) {
    const estado = evaluarProxima(fecha);
    detalle[tipo] = { fecha, estado };
    estados.push(estado);
  }
  return { estado: peorEstado(estados), detalle };
}

const REQUIERE_CAMBIO = ['Cambiar ya', 'Por cambiar'];

export async function GET(request) {
  const sesion = await obtenerSesion();
  if (!sesion) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const filtro = whereDe(filtrosFlota(Object.fromEntries(searchParams.entries())));

  const orden = ORDEN[searchParams.get('sort')] || ORDEN.nro;
  const dir = searchParams.get('dir') === 'desc' ? 'DESC' : 'ASC';
  const page = Math.max(1, parseInt(searchParams.get('page'), 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit'), 10) || PAGE_SIZE));
  const offset = (page - 1) * limit;

  // Ejecutar query principal + count total EN PARALELO
  const [rows, countResult] = await Promise.all([
    query(
      `SELECT f.*, ch.nombre AS conductor_designado,
              seg.seguro_id, seg.seguro_aseguradora, seg.seguro_poliza,
              seg.seguro_vencimiento, COALESCE(seg.estado_seguro,'') AS estado_seguro_actual,
              llt.proxima AS llantas_proxima,
              ac.por_tipo AS aceites_proxima,
              viaje.viaje_id, viaje.viaje_tramo, viaje.viaje_producto, viaje.viaje_fecha_carga, viaje.viaje_fecha_llegada, viaje.viaje_codigo, viaje.viaje_chofer
       FROM flota f
       ${joinSeguroActual()}
       ${joinAlertasMantenimiento()}
       ${joinViajeActivo()}
       LEFT JOIN choferes ch ON ch.id = f.chofer_id
       ${filtro.texto}
       ORDER BY ${orden} ${dir} NULLS LAST, f.id ASC
       LIMIT $${filtro.params.length + 1} OFFSET $${filtro.params.length + 2}`,
      [...filtro.params, limit, offset]
    ),
    query(
      `SELECT COUNT(*)::int AS total FROM flota f ${filtro.texto}`,
      filtro.params
    ),
  ]);

  const totalCount = countResult[0]?.total || 0;
  const totalPages = Math.ceil(totalCount / limit);

  // Estados de llantas/aceites derivados de las fechas programadas + En ruta automático
  const vehiculos = rows.map(v => {
    const ac = estadoAceitesDe(v.aceites_proxima);
    const enRuta = !!v.viaje_id && enRutaPorViaje({ fecha_llegada: v.viaje_fecha_llegada });
    const estadoBase = v.estado_seguro_actual === 'Vencido' ? 'Seguro Vencido' : 'Disponible';
    return {
      ...v,
      en_ruta: enRuta,
      viaje_actual: v.viaje_id ? { id: v.viaje_id, tramo: v.viaje_tramo, producto: v.viaje_producto, fecha_carga: v.viaje_fecha_carga, fecha_llegada: v.viaje_fecha_llegada, codigo: v.viaje_codigo, chofer: v.viaje_chofer } : null,
      estado_vehiculo: enRuta ? 'En ruta' : estadoBase,
      llantas_proxima: v.llantas_proxima,
      llantas_estado: evaluarProxima(v.llantas_proxima),
      aceites_estado: ac.estado,
      aceites_detalle: ac.detalle,
    };
  });

  // Resumen global: COUNT optimizado — reutiliza los vehículos de la página actual
  // y hace una query separada solo para los contadores globales
  const resumenRows = await query(`
    SELECT count(*)::int AS total,
           count(*) FILTER (WHERE ${estadoVehiculoSql('f')} = 'Disponible')::int AS disponibles,
           count(*) FILTER (WHERE ${estadoVehiculoSql('f')} = 'Seguro Vencido')::int AS seguro_vencido
    FROM flota f`);
  const resumen = resumenRows[0];

  // Para "por_vencer" usamos EXISTS pero solo contamos (más ligero que JOIN LATERAL)
  const porVencerRows = await query(`
    SELECT COUNT(DISTINCT f.id)::int AS por_vencer
    FROM flota f
    WHERE EXISTS (
      SELECT 1 FROM seguros s
      WHERE s.placa = f.placa AND s.activo
        AND s.fecha_vencimiento >= ${HOY_BOLIVIA_SQL}
        AND s.fecha_vencimiento < ${HOY_BOLIVIA_SQL} + interval '30 days'
    )`);
  const porVencer = porVencerRows[0]?.por_vencer || 0;

  // llantas/aceites por cambiar se calculan del resumen paginado (datos ya en memoria)
  let llantasPorCambiar = 0;
  let aceitesPorCambiar = 0;
  for (const v of vehiculos) {
    if (REQUIERE_CAMBIO.includes(v.llantas_estado)) llantasPorCambiar++;
    if (REQUIERE_CAMBIO.includes(v.aceites_estado)) aceitesPorCambiar++;
  }

  return NextResponse.json({
    vehiculos,
    resumen: {
      ...resumen,
      por_vencer: porVencer,
      llantas_por_cambiar: llantasPorCambiar,
      aceites_por_cambiar: aceitesPorCambiar,
    },
    pagination: { page, limit, totalCount, totalPages },
  });
}

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion || sesion.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const body = await request.json();
  const validacion = validarDatosVehiculo(body);
  if (!validacion.ok) {
    return NextResponse.json({ error: validacion.error }, { status: 400 });
  }
  const d = validacion.datos;

  const existe = await query('SELECT id FROM flota WHERE placa = $1', [d.placa]);
  if (existe.length > 0) {
    return NextResponse.json({ error: `Ya existe un vehículo con la placa ${d.placa}` }, { status: 409 });
  }

  // Los catálogos se alimentan solos con lo registrado (evita escritura inconsistente)
  for (const [tipoCat, valor] of [['tipo_vehiculo', d.tipo], ['marca', d.marca], ['modelo', d.modelo]]) {
    await query(
      'INSERT INTO catalogos (tipo, valor) VALUES ($1,$2) ON CONFLICT (tipo, valor) DO NOTHING',
      [tipoCat, valor]
    );
  }

  if (d.chofer_id !== null) {
    const chofer = await query('SELECT id FROM choferes WHERE id = $1', [d.chofer_id]);
    if (chofer.length === 0) return NextResponse.json({ error: 'El conductor designado no existe' }, { status: 400 });
  }

  const rows = await query(
    `INSERT INTO flota (tipo, marca, modelo, placa, numero_serie, color, anio, carga_maxima_kg,
                        operador_logistico, chofer_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
    [d.tipo, d.marca, d.modelo, d.placa, d.numero_serie, d.color, d.anio, d.carga_maxima_kg,
     d.operador_logistico, d.chofer_id]
  );

  return NextResponse.json({ vehiculo: { ...rows[0], estado_seguro_actual: '', estado_vehiculo: 'Disponible' } }, { status: 201 });
}

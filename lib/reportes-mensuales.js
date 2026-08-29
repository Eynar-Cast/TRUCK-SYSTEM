/**
 * lib/reportes-mensuales.js — Definición de los reportes mensuales.
 * Cada tipo define su consulta (filtrada por el mes seleccionado),
 * sus columnas y cómo se arma cada fila. Compartido por la API JSON
 * y la exportación a Excel para que ambos respeten lo mismo.
 */
import { estadoSeguroSql, evaluarProxima } from './flota';

/** Rango [inicio, fin) del mes YYYY-MM en zona America/La_Paz. */
export function rangoMes(mes) {
  if (!/^\d{4}-\d{2}$/.test(mes || '')) return null;
  const inicio = `${mes}-01`;
  const d = new Date(`${inicio}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  const fin = d.toISOString().slice(0, 10);
  return { inicio, fin };
}

const EN_MES = col => `${col} >= $1::date AND ${col} < $2::date`;

export const REPORTES = {
  compras: {
    titulo: 'Reporte mensual de compras',
    columnas: [
      ['Fecha', 18], ['Usuario', 22], ['Producto', 28], ['Precio (Bs.)', 14],
      ['Factura', 10], ['Tipo de pago', 14], ['Devuelto', 10],
    ],
    sql: `
      SELECT c.id, c.fecha, u.nombre AS usuario, c.producto, c.precio,
             c.tiene_factura, c.tipo_pago, c.devuelto
      FROM compras c JOIN usuarios u ON u.id = c.user_id
      WHERE ${EN_MES('c.fecha')}
      ORDER BY c.fecha ASC`,
    fila: r => [
      new Date(r.fecha).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      r.usuario, r.producto, Number(r.precio),
      r.tiene_factura ? 'Sí' : 'No',
      r.tipo_pago === 'qr' ? 'QR' : 'Físico',
      r.devuelto ? 'Sí' : 'No',
    ],
  },

  devoluciones: {
    titulo: 'Reporte mensual de devoluciones',
    columnas: [
      ['Fecha', 18], ['Usuario', 22], ['Producto', 28], ['Motivo', 30], ['Tipo de reembolso', 20],
    ],
    sql: `
      SELECT d.id, d.fecha, u.nombre AS usuario, c.producto, d.motivo, d.tipo_pago
      FROM devoluciones d
      JOIN compras c ON c.id = d.compra_id
      JOIN usuarios u ON u.id = c.user_id
      WHERE ${EN_MES('d.fecha')}
      ORDER BY d.fecha ASC`,
    fila: r => [
      new Date(r.fecha).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      r.usuario, r.producto, r.motivo,
      r.tipo_pago === 'transferencia' ? 'Transferencia' : 'Cobro físico',
    ],
  },

  gastos_choferes: {
    titulo: 'Reporte mensual de gastos de conductores',
    columnas: [
      ['Fecha', 18], ['Conductor', 24], ['Gasto', 22], ['Monto (Bs.)', 14],
      ['Descripción', 30], ['Pagado', 10],
    ],
    sql: `
      SELECT g.id, g.fecha, ch.nombre AS conductor, g.nombre AS gasto, g.monto,
             g.descripcion, g.pagado
      FROM gastos_chofer g JOIN choferes ch ON ch.id = g.chofer_id
      WHERE ${EN_MES('g.fecha')}
      ORDER BY g.fecha ASC`,
    fila: r => [
      new Date(r.fecha).toLocaleString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      r.conductor, r.gasto, Number(r.monto), r.descripcion || '', r.pagado ? 'Sí' : 'No',
    ],
  },

  // ── FLOTA — idéntico a hoja "Flota" del Excel pero sin columnas vacías
  // La plantilla tiene 16 cols con 4 de mantenimiento vacías por falta de módulos Rutas/Mantenimiento.
  // Se eliminan Kms Preventivo/Actual/Falta/Estado para no generar vacíos (12 cols útiles).
  camiones: {
    titulo: 'FLOTA DE VEHICULOS',
    hoja: 'Flota',
    columnas: [
      ['Nro', 6.71], ['Tipo', 12.43], ['Marca', 14.86], ['Modelo', 14.14],
      ['Placa Vehiculo', 9.71], ['Nro serie', 18.43], ['Color', 14.43], ['Año', 8.86],
      ['Carga Máxima (Kg)', 10.43], ['Estado Vehiculo', 11.29],
      ['Ciclo para Mnnto Prevent. (Km)', 13.86], ['Kms Odómetro Inicial', 15],
    ],
    sql: `
      SELECT f.id, f.tipo, f.marca, f.modelo, f.placa, f.numero_serie, f.color, f.anio,
             f.carga_maxima_kg, f.ciclo_mantenimiento_km, f.odometro_inicial,
             ${estadoSeguroSql('seg.fecha_vencimiento')} AS estado_seguro
      FROM flota f
      LEFT JOIN LATERAL (
        SELECT s.fecha_vencimiento FROM seguros s
        WHERE s.placa = f.placa AND s.activo
        ORDER BY s.creado DESC, s.id DESC LIMIT 1
      ) seg ON TRUE
      WHERE ${EN_MES('f.creado')}
      ORDER BY f.id ASC`,
    fila: r => {
      const estadoVehiculo = r.estado_seguro === 'Vencido' ? 'Seguro Vencido' : 'Disponible';
      return [
        r.id, r.tipo, r.marca, r.modelo, r.placa, r.numero_serie || '', r.color || '', r.anio ?? '',
        r.carga_maxima_kg ?? '', estadoVehiculo,
        r.ciclo_mantenimiento_km ?? '', r.odometro_inicial ?? '',
      ];
    },
  },

  // ── SEGUROS — idéntico a hoja "Seguros" (9 columnas)
  seguros_camiones: {
    titulo: 'SEGUROS DE VEHICULOS',
    hoja: 'Seguros',
    columnas: [
      ['Nro', 6.71], ['Placa Vehiculo', 9.71], ['Aseguradora', 21.57], ['Poliza seguro', 13.71],
      ['Fecha de inicio', 12], ['Fecha de Vencimiento', 14], ['Importe Pagado ($)', 14], ['Fecha de Pago', 12], ['Estado Poliza', 11],
    ],
    sql: `
      SELECT s.id, s.placa, s.aseguradora, s.poliza, s.fecha_inicio, s.fecha_vencimiento,
             s.importe_pagado, s.fecha_pago,
             ${estadoSeguroSql('s.fecha_vencimiento')} AS estado_poliza
      FROM seguros s
      WHERE ${EN_MES('s.fecha_vencimiento')}
      ORDER BY s.fecha_vencimiento ASC`,
    fila: r => [
      r.id, r.placa, r.aseguradora, r.poliza,
      fmtDia(r.fecha_inicio), fmtDia(r.fecha_vencimiento),
      r.importe_pagado !== null ? Number(r.importe_pagado) : '',
      fmtDia(r.fecha_pago),
      r.estado_poliza || '',
    ],
  },

  // ── CONDUCTORES — idéntico a hoja "Conductores" (7 columnas)
  conductores: {
    titulo: 'DATOS DE LOS CONDUCTORES',
    hoja: 'Conductores',
    columnas: [
      ['Nro', 6.71], ['Doc Identidad', 13.86], ['Conductor', 25.43], ['Nro Licencia', 13.86],
      ['Dirección', 32.43], ['Teléfono/Celular', 18.71], ['Calificación', 12.71],
    ],
    sql: `
      SELECT id, documento, nombre, licencia, direccion, telefono, calificacion
      FROM choferes
      WHERE ${EN_MES('creado')}
      ORDER BY nombre ASC`,
    fila: r => [
      r.id, r.documento || '', r.nombre, r.licencia || '', r.direccion || '', r.telefono || '',
      r.calificacion ? '★'.repeat(r.calificacion) : '',
    ],
  },

  // ── MULTAS — idéntico a hoja "Multas" (11 columnas) con snapshot de placa para no alterar historial
  // Un conductor puede rotar por varios camiones: la placa/flota se guarda al registrar la multa
  multas: {
    titulo: 'MULTAS DE CONDUCTORES',
    hoja: 'Multas',
    columnas: [
      ['Nro', 6.71], ['Fecha', 10.71], ['Nro Viaje', 6.86], ['Placa Vehículo', 9.71],
      ['Conductor', 18.71], ['Infracción', 21.14], ['Importe multa ($)', 13.29], ['Importe pagado ($)', 14],
      ['Debe ($)', 11.86], ['Estado Pago', 12.71], ['Observaciones', 21],
    ],
    sql: `
      SELECT m.id, m.fecha, m.nro_viaje, m.placa AS placa_vehiculo, m.monto AS importe_multa,
             m.importe_pagado, m.fecha_pago, m.motivo AS infraccion, m.observaciones,
             ch.nombre AS conductor
      FROM multas m JOIN choferes ch ON ch.id = m.chofer_id
      WHERE ${EN_MES('m.fecha')}
      ORDER BY m.fecha ASC`,
    fila: r => {
      const importe = r.importe_multa !== null && r.importe_multa !== '' ? Number(r.importe_multa) : 0;
      const pagado = r.importe_pagado !== null && r.importe_pagado !== '' ? Number(r.importe_pagado) : 0;
      const debe = importe - pagado;
      let estadoPago = '';
      if (r.importe_multa === null) estadoPago = '';
      else if (debe <= 0) estadoPago = 'Pagado';
      else if (pagado > 0) estadoPago = 'Parcial';
      else estadoPago = 'Pendiente';
      return [
        r.id, fmtDia(r.fecha), r.nro_viaje || '', r.placa_vehiculo || '', r.conductor || '', r.infraccion || '',
        importe, pagado, debe, estadoPago, r.observaciones || '',
      ];
    },
  },

  // ── VIAJES — Reporte de viajes (14 cols, todo manual por teclado, mensual por fecha_carga)
  viajes: {
    titulo: 'REPORTE DE VIAJES',
    hoja: 'Viajes',
    columnas: [
      ['N', 6], ['Placa', 12], ['Tipo', 12], ['Chofer', 20], ['Tramo', 22],
      ['Fecha de carga', 14], ['Producto', 18], ['Cantidad palets', 12],
      ['Fecha entrada', 12], ['Fecha llegada', 12], ['Planilla', 14], ['Estado', 12], ['Observaciones', 22], ['Codigo de carga', 14],
    ],
    sql: `
      SELECT v.id, v.placa, v.tipo, v.chofer_nombre AS chofer, v.tramo,
             v.fecha_carga, v.producto, v.cantidad_palets,
             v.fecha_entrada, v.fecha_llegada, v.planilla, v.estado, v.observaciones, v.codigo_carga
      FROM viajes v
      WHERE ${EN_MES('v.fecha_carga')}
      ORDER BY v.fecha_carga ASC, v.id ASC`,
    fila: r => [
      r.id, r.placa, r.tipo || '', r.chofer || '', r.tramo || '',
      fmtDia(r.fecha_carga), r.producto || '', r.cantidad_palets ?? '',
      fmtDia(r.fecha_entrada), fmtDia(r.fecha_llegada), r.planilla || '', r.estado || '', r.observaciones || '', r.codigo_carga || '',
    ],
  },

  // ── IMPUESTOS — Reporte de impuestos por camión (8 cols, mensual por fecha_registro) — faltaba agregarlo
  impuestos: {
    titulo: 'IMPUESTOS DE VEHICULOS',
    hoja: 'Impuestos',
    columnas: [
      ['N', 6], ['Placa', 12], ['Concepto', 24], ['Monto (Bs.)', 14], ['Fecha registro', 14], ['Pagado', 10], ['Fecha pago', 14], ['Observaciones', 24],
    ],
    sql: `
      SELECT i.id, i.placa, i.concepto, i.monto, i.fecha_registro, i.pagado, i.fecha_pago, i.observaciones
      FROM impuestos i
      WHERE ${EN_MES('i.fecha_registro')}
      ORDER BY i.fecha_registro ASC, i.id ASC`,
    fila: r => [
      r.id, r.placa, r.concepto || '', r.monto != null ? Number(r.monto) : '', fmtDia(r.fecha_registro), r.pagado ? 'Sí' : 'No', fmtDia(r.fecha_pago), r.observaciones || '',
    ],
  },
};

function fmtDia(iso) {
  if (!iso) return '';
  const t = String(iso).slice(0, 10);
  const [a, m, d] = t.split('-');
  return `${d}/${m}/${a}`;
}

// Estado Vigente/Vencido calculado en JS (misma regla que estadoSeguroSql)
function evalEstadoLocal(fecha) {
  if (!fecha) return '';
  const hoy = new Date();
  const hoyDia = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));
  // Bolivia = UTC-4: convertir la fecha de calendario al mediodía UTC evita desplazamientos
  const f = new Date(`${String(fecha).slice(0, 10)}T12:00:00Z`);
  const ahoraBolivia = new Date(hoyDia.getTime() + 4 * 3600 * 1000);
  return f < ahoraBolivia ? 'Vencido' : 'Vigente';
}

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

  camiones: {
    titulo: 'Reporte mensual de camiones',
    columnas: [
      ['Nro', 6], ['Placa', 12], ['Color', 12], ['Tipo', 14], ['Año', 8],
      ['Modelo', 16], ['Operador logístico', 22], ['Conductor designado', 24],
    ],
    sql: `
      SELECT f.*, ch.nombre AS conductor_designado
      FROM flota f LEFT JOIN choferes ch ON ch.id = f.chofer_id
      WHERE ${EN_MES('f.creado')}
      ORDER BY f.id ASC`,
    fila: r => [r.id, r.placa, r.color || '', r.tipo, r.anio ?? '', r.modelo, r.operador_logistico || '', r.conductor_designado || ''],
  },

  llantas: {
    titulo: 'Reporte mensual de llantas',
    columnas: [
      ['Fecha de cambio', 14], ['Placa', 12], ['Llantas tracto', 14], ['Llantas chata', 14],
      ['Marca', 18], ['Próximo cambio', 14], ['Estado', 12], ['Observación', 26],
    ],
    sql: `
      SELECT l.*, f.placa
      FROM llantas l JOIN flota f ON f.id = l.flota_id
      WHERE ${EN_MES('l.fecha_cambio')}
      ORDER BY l.fecha_cambio ASC`,
    fila: r => [
      fmtDia(r.fecha_cambio), r.placa,
      r.llantas_tracto ?? '', r.llantas_chata ?? '',
      r.marca || '', fmtDia(r.proxima_fecha),
      evaluarProxima(r.proxima_fecha) || '—', r.observacion || '',
    ],
  },

  aceites: {
    titulo: 'Reporte mensual de aceites',
    columnas: [
      ['Último cambio', 14], ['Placa', 12], ['Aceite', 10], ['Marca', 18],
      ['Próximo cambio', 14], ['Estado', 12], ['Observación', 26],
    ],
    sql: `
      SELECT a.*, f.placa
      FROM aceites a JOIN flota f ON f.id = a.flota_id
      WHERE ${EN_MES('a.fecha_ultimo_cambio')}
      ORDER BY a.fecha_ultimo_cambio ASC`,
    fila: r => [
      fmtDia(r.fecha_ultimo_cambio), r.placa,
      r.tipo.charAt(0).toUpperCase() + r.tipo.slice(1),
      r.marca || '', fmtDia(r.proxima_fecha),
      evaluarProxima(r.proxima_fecha) || '—', r.observacion || '',
    ],
  },

  seguros_camiones: {
    titulo: 'Reporte mensual de seguros de camiones',
    columnas: [
      ['Vencimiento', 14], ['Placa', 12], ['Aseguradora', 22], ['Póliza', 16],
      ['Importe (Bs.)', 14], ['Estado', 12],
    ],
    sql: `
      SELECT s.*
      FROM seguros s
      WHERE ${EN_MES('s.fecha_vencimiento')}
      ORDER BY s.fecha_vencimiento ASC`,
    fila: r => [
      fmtDia(r.fecha_vencimiento), r.placa, r.aseguradora, r.poliza,
      r.importe_pagado !== null ? Number(r.importe_pagado) : '',
      evalEstadoLocal(r.fecha_vencimiento),
    ],
  },

  conductores: {
    titulo: 'Reporte mensual de conductores',
    columnas: [
      ['Nro', 6], ['Nombre completo', 28], ['Documento', 14], ['Licencia', 14],
      ['Teléfono', 14], ['Camión asignado', 14], ['Calificación', 12],
    ],
    sql: `
      SELECT *
      FROM choferes
      WHERE ${EN_MES('creado')}
      ORDER BY nombre ASC`,
    fila: r => [r.id, r.nombre, r.documento || '', r.licencia || '', r.telefono || '', r.placa, r.calificacion ? '★'.repeat(r.calificacion) : ''],
  },

  seguros_individuales: {
    titulo: 'Reporte mensual de seguros individuales',
    columnas: [
      ['Expiración', 14], ['Conductor', 28], ['Inicio', 14], ['Estado', 12],
    ],
    sql: `
      SELECT cs.*, c.nombre AS conductor
      FROM conductor_seguros cs JOIN choferes c ON c.id = cs.chofer_id
      WHERE ${EN_MES('cs.fecha_expiracion')}
      ORDER BY cs.fecha_expiracion ASC`,
    fila: r => [
      fmtDia(r.fecha_expiracion), r.conductor, fmtDia(r.fecha_inicio),
      evalEstadoLocal(r.fecha_expiracion),
    ],
  },

  multas: {
    titulo: 'Reporte mensual de multas',
    columnas: [
      ['Fecha', 14], ['Conductor', 28], ['Motivo', 30], ['Monto (Bs.)', 14], ['Observaciones', 30],
    ],
    sql: `
      SELECT m.*, c.nombre AS conductor
      FROM multas m JOIN choferes c ON c.id = m.chofer_id
      WHERE ${EN_MES('m.fecha')}
      ORDER BY m.fecha ASC`,
    fila: r => [
      fmtDia(r.fecha), r.conductor, r.motivo,
      r.monto !== null ? Number(r.monto) : '—',
      r.observaciones || '',
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

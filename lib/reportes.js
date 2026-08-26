/**
 * lib/reportes.js — Utilidades compartidas por los reportes aprobados
 * (Flota, Seguros, Conductores): construcción de filtros SQL y estilos
 * de exportación a Excel con ExcelJS (librería ya presente en el proyecto).
 */
import ExcelJS from 'exceljs';
import { estadoSeguroSql } from './flota';

// Re-exportación para que las rutas importen todo lo relativo a reportes de un solo lugar
export { estadoSeguroSql };

/** Convierte '' en null y recorta texto (para parámetros opcionales). */
export function textoO(valor) {
  const t = String(valor ?? '').trim();
  return t === '' ? null : t;
}

/** Valida una fecha YYYY-MM-DD; devuelve null si es inválida. */
export function fechaO(valor) {
  const t = String(valor ?? '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00`);
  return isNaN(d.getTime()) ? null : t;
}

/**
 * Estado del vehículo como expresión SQL (lógica Excel):
 * 1) rama "Mantenimiento" reservada para el módulo futuro;
 * 2) seguro más reciente ACTIVO asociado por PLACA vencido → 'Seguro Vencido';
 * 3) en cualquier otro caso → 'Disponible'.
 */
export function estadoVehiculoSql(f = 'f') {
  const seguroActual = `
    SELECT * FROM seguros s
    WHERE s.placa = ${f}.placa AND s.activo
    ORDER BY s.creado DESC, s.id DESC LIMIT 1`;
  return `(CASE WHEN (SELECT ${estadoSeguroSql('s.fecha_vencimiento')} FROM (${seguroActual}) s) = 'Vencido'
             THEN 'Seguro Vencido' ELSE 'Disponible' END)`;
}

/** Seguro activo más reciente de cada vehículo (equivalente a MATCH por placa + MAXIFS). */
export function joinSeguroActual() {
  return `
    LEFT JOIN LATERAL (
      SELECT s.id AS seguro_id, s.aseguradora AS seguro_aseguradora, s.poliza AS seguro_poliza,
             s.fecha_vencimiento AS seguro_vencimiento,
             ${estadoSeguroSql('s.fecha_vencimiento')} AS estado_seguro
      FROM seguros s
      WHERE s.placa = f.placa AND s.activo
      ORDER BY s.creado DESC, s.id DESC LIMIT 1
    ) seg ON TRUE`;
}

/**
 * Última programación de cambio de llantas y la próxima fecha vigente de
 * cada tipo de aceite (motor/caja/corona) del vehículo f.
 * Devuelve columnas: llantas_proxima (DATE) y aceites_proxima (JSONB {tipo: fecha}).
 */
export function joinAlertasMantenimiento() {
  return `
    LEFT JOIN LATERAL (
      SELECT l.proxima_fecha AS proxima
      FROM llantas l
      WHERE l.flota_id = f.id AND l.proxima_fecha IS NOT NULL
      ORDER BY l.id DESC
      LIMIT 1
    ) llt ON TRUE
    LEFT JOIN LATERAL (
      SELECT jsonb_object_agg(tipo, proxima) AS por_tipo
      FROM (
        SELECT DISTINCT ON (a.tipo) a.tipo AS tipo, a.proxima_fecha AS proxima
        FROM aceites a
        WHERE a.flota_id = f.id AND a.proxima_fecha IS NOT NULL
        ORDER BY a.tipo, a.fecha_ultimo_cambio DESC NULLS LAST, a.id DESC
      ) t
    ) ac ON TRUE`;
}

/**
 * Filtros del reporte de FLOTA. Devuelve { clausulas, params } para
 * armar el WHERE sobre la tabla flota (alias f) — usado por la API de
 * listado y por la exportación, garantizando que el Excel respete
 * exactamente lo filtrado en pantalla.
 */
export function filtrosFlota({ q, tipo, marca, modelo, estado }) {
  const clausulas = [];
  const params = [];
  const like = v => { params.push(`%${v}%`); return `$${params.length}`; };

  if ((q = textoO(q))) {
    clausulas.push(`(f.placa ILIKE ${like(q)} OR f.marca ILIKE ${like(q)} OR f.modelo ILIKE ${like(q)} OR COALESCE(f.numero_serie,'') ILIKE ${like(q)} OR COALESCE(f.operador_logistico,'') ILIKE ${like(q)})`);
  }
  if ((tipo = textoO(tipo))) { params.push(tipo); clausulas.push(`f.tipo = $${params.length}`); }
  if ((marca = textoO(marca))) { params.push(marca); clausulas.push(`f.marca = $${params.length}`); }
  if ((modelo = textoO(modelo))) { params.push(modelo); clausulas.push(`f.modelo = $${params.length}`); }
  if ((estado = textoO(estado))) {
    params.push(estado);
    clausulas.push(`${estadoVehiculoSql('f')} = $${params.length}`);
  }
  return { clausulas, params };
}

/**
 * Filtros del reporte de SEGUROS (alias s). Soporta búsqueda por placa/
 * aseguradora/póliza, filtro Vigente/Vencido y rangos de inicio/vencimiento.
 */
export function filtrosSeguros({ q, estado, inicio_desde, inicio_hasta, venc_desde, venc_hasta }) {
  const clausulas = [];
  const params = [];
  const like = v => { params.push(`%${v}%`); return `$${params.length}`; };

  if ((q = textoO(q))) {
    clausulas.push(`(s.placa ILIKE ${like(q)} OR s.aseguradora ILIKE ${like(q)} OR s.poliza ILIKE ${like(q)})`);
  }
  if ((estado = textoO(estado)) && estado !== '') {
    params.push(estado);
    clausulas.push(`${estadoSeguroSql('s.fecha_vencimiento')} = $${params.length}`);
  }
  if ((inicio_desde = fechaO(inicio_desde))) { params.push(inicio_desde); clausulas.push(`s.fecha_inicio >= $${params.length}::date`); }
  if ((inicio_hasta = fechaO(inicio_hasta))) { params.push(inicio_hasta); clausulas.push(`s.fecha_inicio <= $${params.length}::date`); }
  if ((venc_desde = fechaO(venc_desde))) { params.push(venc_desde); clausulas.push(`s.fecha_vencimiento >= $${params.length}::date`); }
  if ((venc_hasta = fechaO(venc_hasta))) { params.push(venc_hasta); clausulas.push(`s.fecha_vencimiento <= $${params.length}::date`); }

  return { clausulas, params };
}

/**
 * Filtros del reporte de CONDUCTORES (alias c).
 * q busca por nombre/documento/licencia; calificacion exacta 1-5.
 */
export function filtrosChoferes({ q, calificacion }) {
  const clausulas = [];
  const params = [];

  if ((q = String(q ?? '').trim())) {
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    const p1 = params.length - 2, p2 = params.length - 1, p3 = params.length;
    clausulas.push(`(c.nombre ILIKE $${p1} OR COALESCE(c.documento,'') ILIKE $${p2} OR COALESCE(c.licencia,'') ILIKE $${p3})`);
  }
  const calif = parseInt(calificacion, 10);
  if (calif >= 1 && calif <= 5) {
    params.push(calif);
    clausulas.push(`c.calificacion = $${params.length}`);
  }
  return { clausulas, params };
}

/** WHERE armado a partir de cláusulas/params previos. */
export function whereDe({ clausulas, params }) {
  return { texto: clausulas.length ? 'WHERE ' + clausulas.join(' AND ') : '', params };
}

// ---------- Exportación a Excel ----------

export function estilosExcel() {
  return {
    encabezado: { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } } },
    titulo:     { font: { bold: true, size: 14, color: { argb: 'FF0F172A' } } },
    subtitulo:  { font: { italic: true, color: { argb: 'FF475569' } } },
  };
}

/** Fecha corta dd/mm/yyyy para columnas DATE (sin problemas de zona horaria). */
export function fmtFechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(String(iso).length === 10 ? `${String(iso).slice(0, 10)}T00:00:00` : iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

/** Genera la respuesta .xlsx descargable a partir de un Workbook. */
export async function responderXlsx(wb, nombreBase) {
  const buffer = await wb.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${nombreBase}_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}

/** Crea un Workbook con metadatos estándar. */
export function nuevoWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Sistema de Transporte';
  wb.created = new Date();
  return wb;
}

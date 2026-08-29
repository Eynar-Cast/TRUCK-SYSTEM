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
 * Estado del vehículo como expresión SQL (lógica + viajes):
 * 1) Si tiene un viaje activo (fecha_llegada NULL o futura) → 'En ruta' (No disponible)
 * 2) rama "Mantenimiento" reservada para el módulo futuro;
 * 3) seguro más reciente ACTIVO asociado por PLACA vencido → 'Seguro Vencido';
 * 4) en cualquier otro caso → 'Disponible'.
 */
export function estadoVehiculoSql(f = 'f') {
  const seguroActual = `
    SELECT * FROM seguros s
    WHERE s.placa = ${f}.placa AND s.activo
    ORDER BY s.creado DESC, s.id DESC LIMIT 1`;
  return `(CASE
              WHEN EXISTS (SELECT 1 FROM viajes v WHERE v.placa = ${f}.placa AND (v.estado IN ('En ruta','Programado') OR (v.estado IS NULL AND (v.fecha_llegada IS NULL OR v.fecha_llegada >= (now() AT TIME ZONE 'America/La_Paz')::date))))
                THEN 'En ruta'
              WHEN (SELECT ${estadoSeguroSql('s.fecha_vencimiento')} FROM (${seguroActual}) s) = 'Vencido'
                THEN 'Seguro Vencido' ELSE 'Disponible' END)`;
}

/** Viaje activo más reciente del vehículo (para mostrar ruta/estado al buscar). */
export function joinViajeActivo() {
  return `
    LEFT JOIN LATERAL (
      SELECT v.id AS viaje_id, v.tramo AS viaje_tramo, v.producto AS viaje_producto,
             v.fecha_carga AS viaje_fecha_carga, v.fecha_llegada AS viaje_fecha_llegada,
             v.codigo_carga AS viaje_codigo, v.chofer_nombre AS viaje_chofer, v.estado AS viaje_estado
      FROM viajes v
      WHERE v.placa = f.placa
        AND (v.estado IN ('En ruta','Programado') OR (v.estado IS NULL AND (v.fecha_llegada IS NULL OR v.fecha_llegada >= (now() AT TIME ZONE 'America/La_Paz')::date)))
      ORDER BY v.fecha_carga DESC NULLS LAST, v.id DESC LIMIT 1
    ) viaje ON TRUE`;
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
    encabezado: { font: { bold: true, color: { argb: 'FFFFFFFF' } }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: { top: { style: 'thin', color: { argb: 'FFCBD5E1' } }, left: { style: 'thin', color: { argb: 'FFCBD5E1' } }, bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } }, right: { style: 'thin', color: { argb: 'FFCBD5E1' } } } },
    titulo:     { font: { bold: true, size: 14, color: { argb: 'FF0F172A' } } },
    subtitulo:  { font: { italic: true, color: { argb: 'FF475569' } } },
  };
}

// ---------- Plantilla idéntica al Excel control-de-flota-vehicular.xlsx ----------

export const PLANTILLA_COLORES = {
  tituloFill: 'FFC4EEFE',
  tituloFont: 'FF0F172A',
  grupoVerde: 'FF0C9B74',
  grupoVerdeOscuro: 'FF08674D',
  headerAzulOscuro: 'FF17406D',
  stripeClaro: 'FFC7E2FA',
  stripeMedio: 'FF90C6F6',
  borde: 'FFCBD5E1',
  blanco: 'FFFFFFFF',
};

const BORDE_FINO = {
  top: { style: 'thin', color: { argb: PLANTILLA_COLORES.borde } },
  left: { style: 'thin', color: { argb: PLANTILLA_COLORES.borde } },
  bottom: { style: 'thin', color: { argb: PLANTILLA_COLORES.borde } },
  right: { style: 'thin', color: { argb: PLANTILLA_COLORES.borde } },
};

export function esReportePlantilla(tipo) {
  return ['camiones', 'seguros_camiones', 'conductores', 'multas', 'viajes', 'impuestos'].includes(tipo);
}

/**
 * Crea una hoja con el diseño idéntico a la plantilla Excel:
 * - Título en fila 1 con fill C4EEFE, mergeado desde C hasta última columna
 * - Para Flota: fila 3 con dos grupos merged (C-L y M-R) con colores verde
 * - Fila de encabezados (Flota fila 5, resto fila 3) con fills por columna
 * - Datos con bordes finos, alineación, alturas y filtros idénticos
 * - Bandas alternas y fórmulas (Debe, Estado Pago) como en la plantilla
 */
export function generarHojaPlantilla(wb, tipo, def, filas, mes) {
  const hojaNombre = def.hoja || (tipo.charAt(0).toUpperCase() + tipo.slice(1));
  const ws = wb.addWorksheet(hojaNombre, {
    properties: { tabColor: { argb: PLANTILLA_COLORES.grupoVerde } },
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, horizontalCentered: true },
  });

  const numCols = def.columnas.length;
  const colInicio = 3; // C
  const colFin = colInicio + numCols - 1;
  const esFlota = tipo === 'camiones';

  // Anchos A y B (márgenes plantilla)
  ws.getColumn(1).width = 8.71;
  ws.getColumn(2).width = 1.71;
  for (let i = 0; i < numCols; i++) {
    ws.getColumn(colInicio + i).width = def.columnas[i][1] || 12;
  }

  // Alturas de filas plantilla
  ws.getRow(1).height = 18;
  ws.getRow(2).height = 7.5;
  if (esFlota) {
    ws.getRow(3).height = 18;
    ws.getRow(4).height = 7.5;
    ws.getRow(5).height = 28; // encabezados más altos (wrap)
  } else {
    ws.getRow(3).height = ws.getCell(3, colInicio).value ? 27 : 13.5;
    // Ajuste para Conductores que tiene header más alto
    if (tipo === 'conductores') ws.getRow(3).height = 27;
    else ws.getRow(3).height = 27;
  }

  // ── Título fila 1 (merge C1 -> última col) ──
  const tituloCell = ws.getCell(1, colInicio);
  tituloCell.value = def.titulo;
  tituloCell.font = { bold: true, size: 14, color: { argb: PLANTILLA_COLORES.tituloFont } };
  tituloCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.tituloFill } };
  tituloCell.alignment = { horizontal: 'center', vertical: 'middle' };
  tituloCell.border = BORDE_FINO;
  // Aplicar fill y borde a todas las celdas del merge
  for (let c = colInicio; c <= colFin; c++) {
    const cell = ws.getCell(1, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.tituloFill } };
    cell.border = BORDE_FINO;
  }
  // Celdas A1:B1 también con mismo fill para que se vea la banda completa como plantilla
  for (let c = 1; c < colInicio; c++) {
    const cell = ws.getCell(1, c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.tituloFill } };
  }
  ws.mergeCells(1, colInicio, 1, colFin);

  // Subtítulo con mes y fecha de generación (fila 2, centrado, pequeño)
  // No existe en plantilla original pero útil; lo ponemos en fila 2 como texto pequeño
  // Para ser 100% idéntico, lo omitimos visualmente — usamos nota en pie
  // ws.getCell(2, colInicio).value = `Mes: ${mes} — Generado: ${new Date().toLocaleDateString('es-BO')}`;

  // ── Grupos Flota fila 3 ──
  if (esFlota) {
    // Grupo 1: DATOS PRINCIPALES Y DISPONIBILIDAD (C3:L3)
    const g1 = ws.getCell(3, colInicio);
    g1.value = 'DATOS PRINCIPALES Y DISPONIBILIDAD DEL VEHÍCULO';
    g1.font = { bold: true, size: 9, color: { argb: 'FF0F172A' } };
    g1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.blanco } };
    g1.alignment = { horizontal: 'center', vertical: 'middle' };
    g1.border = BORDE_FINO;
    for (let c = colInicio; c <= 12; c++) {
      ws.getCell(3, c).border = BORDE_FINO;
      if (c !== colInicio) ws.getCell(3, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.blanco } };
    }
    ws.mergeCells(3, colInicio, 3, 12);

    // Grupo 2: DATOS Y CONTROL DEL MANTENIMIENTO (M3:R3)
    const g2 = ws.getCell(3, 13);
    g2.value = 'DATOS Y CONTROL DEL MANTENIMIENTO PREVENTIVO';
    g2.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    g2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.grupoVerde } };
    g2.alignment = { horizontal: 'center', vertical: 'middle' };
    g2.border = BORDE_FINO;
    for (let c = 13; c <= colFin; c++) {
      ws.getCell(3, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.grupoVerde } };
      ws.getCell(3, c).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      ws.getCell(3, c).border = BORDE_FINO;
    }
    ws.mergeCells(3, 13, 3, colFin);
  }

  // ── Encabezados ──
  const headerRowNum = esFlota ? 5 : 3;
  const headerRow = ws.getRow(headerRowNum);
  headerRow.height = esFlota ? 38 : 27;
  for (let i = 0; i < numCols; i++) {
    const col = colInicio + i;
    const cell = ws.getCell(headerRowNum, col);
    cell.value = def.columnas[i][0];
    cell.font = { bold: true, size: 9, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDE_FINO;
    // Fill por columna (idéntico a plantilla)
    if (esFlota) {
      // Col 10 (K desde 0) Estado Vehiculo -> azul oscuro
      // Cols 11-14 (0-index 10-13) -> verde 0C9B74
      // Cols 15-16 (14-15) -> verde oscuro 08674D
      let fill = PLANTILLA_COLORES.blanco;
      let fontColor = 'FF0F172A';
      if (i === 9) { fill = PLANTILLA_COLORES.headerAzulOscuro; fontColor = 'FFFFFFFF'; }
      else if (i >= 10 && i <= 13) { fill = PLANTILLA_COLORES.grupoVerde; fontColor = 'FFFFFFFF'; }
      else if (i >= 14) { fill = PLANTILLA_COLORES.grupoVerdeOscuro; fontColor = 'FFFFFFFF'; }
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.font = { bold: true, size: 9, color: { argb: fontColor } };
    } else {
      // Para Seguros/Multas/Conductores: header blanco limpio (como plantilla)
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.blanco } };
      // Alternativa si quieres header azul oscuro para todas, descomenta:
      // cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.headerAzulOscuro } };
      // cell.font = { bold: true, size: 9, color: { argb: 'FFFFFFFF' } };
    }
  }
  // Celdas A:B del header también con borde blanco para alineación
  for (let c = 1; c < colInicio; c++) {
    const cell = ws.getCell(headerRowNum, c);
    cell.border = BORDE_FINO;
  }

  // Filtro automático (como tabla de plantilla) — solo filas, sin columnas congeladas (evita columna B pegada)
  ws.autoFilter = { from: { row: headerRowNum, column: colInicio }, to: { row: headerRowNum, column: colFin } };
  ws.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRowNum }];

  // ── Datos ──
  const dataStartRow = headerRowNum + 1;
  const colLetter = n => {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };

  filas.forEach((r, idx) => {
    const rowNum = dataStartRow + idx;
    const row = ws.getRow(rowNum);
    row.height = 14;
    const valores = def.fila(r);

    for (let i = 0; i < numCols; i++) {
      const col = colInicio + i;
      const cell = ws.getCell(rowNum, col);
      let val = valores[i];

      // Para Flota, Nro es id numérico; para resto igual
      // Manejar números y fechas como texto ya formateado

      // Fórmulas idénticas a plantilla:
      // Multas: Debe (col K = 11) = I - J (Importe - Pagado)
      // Multas: Estado Pago (col L = 12) = IF(K=0,"Pagado",IF(K>0,"Pendiente",""))
      if (tipo === 'multas' && i === 8) {
        // Debe
        const colI = colLetter(colInicio + 6); // I
        const colJ = colLetter(colInicio + 7); // J
        cell.value = { formula: `${colI}${rowNum}-${colJ}${rowNum}`, result: val };
      } else if (tipo === 'multas' && i === 9) {
        const colK = colLetter(colInicio + 8);
        cell.value = { formula: `IF(${colK}${rowNum}=0,"Pagado",IF(${colK}${rowNum}>0,"Pendiente",""))`, result: val };
      } else if (tipo === 'seguros_camiones' && i === 8) {
        // Estado Poliza con fórmula idéntica: =IF(H="","",IF(H<TODAY(),"Vencido","Vigente"))
        // Pero ya lo calculamos server-side; dejamos valor y añadimos comentario de fórmula
        const colH = colLetter(colInicio + 5); // Fecha Vencimiento
        cell.value = { formula: `IF(${colH}${rowNum}="","",IF(${colH}${rowNum}<TODAY(),"Vencido","Vigente"))`, result: val };
      } else {
        cell.value = val;
      }

      // Estilos de celda de datos
      cell.border = BORDE_FINO;
      cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'center' : (typeof val === 'number' ? 'right' : 'left'), wrapText: i >= 5 };
      cell.font = { size: 9, color: { argb: 'FF1E293B' } };

      // Banda alterna
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.stripeClaro } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PLANTILLA_COLORES.blanco } };
      }

      // Formato numérico
      if (typeof val === 'number') {
        cell.numFmt = '#,##0.00';
      }
      // Columna Nro centrada y con fill ligero como plantilla (C4EEFE para Nro)
      if (i === 0) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    // Bordes para A:B de esta fila (margen)
    for (let c = 1; c < colInicio; c++) {
      ws.getCell(rowNum, c).border = BORDE_FINO;
    }
  });

  // Si no hay filas, mostrar fila vacía con mensaje
  if (filas.length === 0) {
    const rowNum = dataStartRow;
    const cell = ws.getCell(rowNum, colInicio);
    cell.value = 'Sin registros para el mes seleccionado';
    cell.font = { italic: true, size: 9, color: { argb: 'FF64748B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.mergeCells(rowNum, colInicio, rowNum, colFin);
    ws.getRow(rowNum).height = 18;
  }

  // Pie: generado el + mes (fila después de datos, pequeño)
  const pieRow = dataStartRow + Math.max(filas.length, 1) + 1;
  const pieCell = ws.getCell(pieRow, colInicio);
  pieCell.value = `Mes: ${mes}  •  Generado: ${new Date().toLocaleDateString('es-BO')} ${new Date().toLocaleTimeString('es-BO')}  •  ${filas.length} registro(s)`;
  pieCell.font = { italic: true, size: 8, color: { argb: 'FF64748B' } };
  pieCell.alignment = { horizontal: 'left', vertical: 'middle' };

  // Ajustes de impresión idénticos a plantilla
  ws.pageSetup.printArea = `${colLetter(colInicio)}1:${colLetter(colFin)}${pieRow}`;
  ws.pageSetup.margins = { left: 0.25, right: 0.25, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

  return ws;
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

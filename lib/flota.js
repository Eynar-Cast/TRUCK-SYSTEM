/**
 * lib/flota.js — Lógica derivada de Flota/Seguros.
 *
 * Traduce al backend las fórmulas del Excel de Control de Flota:
 *   - TODAY()  → fecha de HOY en zona America/La_Paz
 *   - IF()     → estados automáticos (nunca escritos por el usuario)
 *   - MATCH/INDEX → localizar el seguro de un vehículo POR PLACA
 *   - MAXIFS   → último registro histórico de un vehículo
 */

/** Fecha de hoy (solo día) en la zona horaria operativa. Equivalente a TODAY(). */
export const HOY_BOLIVIA_SQL = "(now() AT TIME ZONE 'America/La_Paz')::date";

/**
 * Fragmento SQL que deriva el estado de una póliza según su vencimiento.
 * @param {string} col columna DATE de vencimiento/expiración (calificada)
 * @returns {string} CASE que devuelve '' (sin fecha) | 'Vencido' | 'Vigente'
 */
export function estadoSeguroSql(col = 's.fecha_vencimiento') {
  return `(CASE WHEN ${col} IS NULL THEN ''
             WHEN ${col} < ${HOY_BOLIVIA_SQL} THEN 'Vencido'
             ELSE 'Vigente' END)`;
}

/** Estados posibles de un vehículo. */
export const ESTADOS_VEHICULO = ['Disponible', 'Seguro Vencido', 'Mantenimiento', 'En ruta'];

/** Días de anticipación para la alerta "Por cambiar" (llantas y aceites). */
export const AVISO_DIAS = 15;

/** Fecha de HOY en formato AAAA-MM-DD según el calendario de Bolivia (UTC-4). */
export function hoyBoliviaISO() {
  return new Date(Date.now() - 4 * 3600 * 1000).toISOString().slice(0, 10);
}

/** Normaliza cualquier entrada de fecha (Date | ISO | timestamp) a AAAA-MM-DD. */
export function fechaAISO(fecha) {
  if (!fecha) return '';
  if (fecha instanceof Date) {
    if (isNaN(fecha.getTime())) return '';
    // Las columnas DATE llegan como medianoche en la zona del servidor;
    // sumamos margen antes de leer la parte UTC para no correr un día.
    return new Date(fecha.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  }
  const s = String(fecha);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : '';
}

/**
 * Evalúa una próxima fecha programada de cambio (llantas o aceites).
 * Devuelve:
 *   'Cambiar ya'  → la fecha ya venció (u hoy es el día límite)
 *   'Por cambiar' → falta AVISO_DIAS días o menos
 *   'Al día'      → todavía hay margen
 *   ''            → sin fecha registrada
 * Determinística sin importar la zona horaria del servidor.
 */
export function evaluarProxima(fecha, diasAviso = AVISO_DIAS) {
  const f = fechaAISO(fecha);
  if (!f) return '';
  const hoy = hoyBoliviaISO();
  if (f <= hoy) return 'Cambiar ya';
  const limite = new Date(`${hoy}T00:00:00Z`);
  limite.setUTCDate(limite.getUTCDate() + diasAviso);
  return f <= limite.toISOString().slice(0, 10) ? 'Por cambiar' : 'Al día';
}

const PRIORIDAD_ESTADO = { 'Cambiar ya': 3, 'Por cambiar': 2, 'Al día': 1 };

/** De varios estados individuales devuelve el más crítico ('' si no hay ninguno). */
export function peorEstado(estados) {
  let mejor = '';
  for (const e of estados) {
    if (!e) continue;
    if (!mejor || PRIORIDAD_ESTADO[e] > PRIORIDAD_ESTADO[mejor]) mejor = e;
  }
  return mejor;
}

/**
 * Estado del vehículo:
 *   1) Si tiene un viaje activo (fecha_llegada NULL o futura) → 'En ruta' / No disponible
 *   2) Si tiene un mantenimiento con salida futura → 'Mantenimiento'
 *   3) Si no, revisa el seguro asociado POR PLACA: vencido → 'Seguro Vencido'
 *   4) En cualquier otro caso → 'Disponible'
 */
export function calcularEstadoVehiculo({ enMantenimiento = false, estadoSeguroActual = '', enRuta = false } = {}) {
  if (enRuta) return 'En ruta';
  if (enMantenimiento) return 'Mantenimiento';
  if (estadoSeguroActual === 'Vencido') return 'Seguro Vencido';
  return 'Disponible';
}

/** Determina si un camión está en ruta según su último viaje (estado o fecha_llegada). */
export function enRutaPorViaje(viaje) {
  if (!viaje) return false;
  if (viaje.estado) return viaje.estado === 'En ruta' || viaje.estado === 'Programado';
  const llegada = fechaAISO(viaje.fecha_llegada);
  if (!llegada) return true; // sin fecha de llegada = aún en ruta
  return llegada > hoyBoliviaISO();
}

/**
 * Normaliza una placa (mayúsculas, sin espacios extremos). La relación
 * vehículo↔seguro se hace por placa, así que siempre se guarda igual.
 */
export function normalizarPlaca(placa) {
  return String(placa || '').trim().toUpperCase().replace(/\s+/g, '');
}

// ---------------- Validaciones ----------------

function enteroO(valor, min, max) {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min || n > max) return undefined; // inválido
  return n;
}

function decimalO(valor, min) {
  if (valor === '' || valor === null || valor === undefined) return null;
  const n = Number(valor);
  if (!isFinite(n) || n < min) return undefined;
  return n;
}

function fechaISOValida(valor) {
  const t = String(valor ?? '').trim();
  if (t === '') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(t) && !isNaN(new Date(`${t}T00:00:00`).getTime()) ? t : undefined;
}

/**
 * Valida los datos del vehículo que introduce el usuario.
 * Devuelve { ok:true, datos } o { ok:false, error }.
 */
export function validarDatosVehiculo(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const tipo = texto(body.tipo);
  const marca = texto(body.marca);
  const modelo = texto(body.modelo);
  const placa = normalizarPlaca(body.placa);

  if (!tipo || !marca || !modelo) return { ok: false, error: 'Tipo, marca y modelo son obligatorios' };
  if (!placa) return { ok: false, error: 'La placa es obligatoria' };
  if (!/^[A-Z0-9-]{4,15}$/.test(placa)) return { ok: false, error: 'La placa debe tener entre 4 y 15 caracteres (letras, números o guion)' };

  const anio = enteroO(body.anio, 1950, 2100);
  if (anio === undefined) return { ok: false, error: 'El año debe ser un número entre 1950 y 2100' };

  const carga = decimalO(body.carga_maxima_kg, 0);
  if (carga === undefined) return { ok: false, error: 'La carga máxima debe ser un número mayor o igual a 0' };

  // Conductor designado: ID de chofer opcional
  let choferId = body.chofer_id === '' || body.chofer_id === null || body.chofer_id === undefined
    ? null
    : Number(body.chofer_id);
  if (choferId !== null && (!Number.isInteger(choferId) || choferId <= 0)) {
    return { ok: false, error: 'Conductor designado inválido' };
  }

  return {
    ok: true,
    datos: {
      tipo,
      marca,
      modelo,
      placa,
      numero_serie: texto(body.numero_serie),
      color: texto(body.color),
      anio,
      carga_maxima_kg: carga,
      operador_logistico: texto(body.operador_logistico),
      chofer_id: choferId,
    },
  };
}

/**
 * Valida un viaje básico (todo manual por teclado). Lo más básico posible.
 */
export function validarViaje(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const placa = normalizarPlaca(body.placa);
  if (!placa) return { ok: false, error: 'La placa es obligatoria' };
  const t = v => fechaISOValida(v);
  const fc = t(body.fecha_carga);
  if (fc === undefined) return { ok: false, error: 'Fecha de carga inválida' };
  const fe = t(body.fecha_entrada);
  if (fe === undefined) return { ok: false, error: 'Fecha de entrada inválida' };
  const fl = t(body.fecha_llegada);
  if (fl === undefined) return { ok: false, error: 'Fecha de llegada inválida' };
  const palets = enteroO(body.cantidad_palets, 0, 10000);
  if (palets === undefined) return { ok: false, error: 'Cantidad de palets inválida' };
  let choferId = body.chofer_id === '' || body.chofer_id == null ? null : Number(body.chofer_id);
  if (choferId !== null && (!Number.isInteger(choferId) || choferId <= 0)) choferId = null;
  let flotaId = body.flota_id === '' || body.flota_id == null ? null : Number(body.flota_id);
  if (flotaId !== null && (!Number.isInteger(flotaId) || flotaId <= 0)) flotaId = null;
  const estados = ['Programado','En ruta','Entregado','Cancelado'];
  let estado = texto(body.estado);
  if (estado && !estados.includes(estado)) return { ok: false, error: 'Estado inválido' };
  if (!estado) estado = 'En ruta';
  return {
    ok: true,
    datos: {
      placa, flota_id: flotaId, tipo: texto(body.tipo), chofer_id: choferId, chofer_nombre: texto(body.chofer_nombre),
      tramo: texto(body.tramo), fecha_carga: fc, producto: texto(body.producto), cantidad_palets: palets,
      fecha_entrada: fe, fecha_llegada: fl, planilla: texto(body.planilla), codigo_carga: texto(body.codigo_carga),
      observaciones: texto(body.observaciones), estado,
    },
  };
}

/**
 * Valida un impuesto por camión (lo más básico).
 */
export function validarImpuesto(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const placa = normalizarPlaca(body.placa);
  if (!placa) return { ok: false, error: 'La placa es obligatoria' };
  const concepto = texto(body.concepto);
  const monto = decimalO(body.monto, 0);
  if (monto === undefined) return { ok: false, error: 'Monto inválido' };
  const fr = fechaISOValida(body.fecha_registro);
  if (fr === undefined) return { ok: false, error: 'Fecha de registro inválida' };
  const fp = fechaISOValida(body.fecha_pago);
  if (fp === undefined) return { ok: false, error: 'Fecha de pago inválida' };
  let flotaId = body.flota_id === '' || body.flota_id == null ? null : Number(body.flota_id);
  if (flotaId !== null && (!Number.isInteger(flotaId) || flotaId <= 0)) flotaId = null;
  return {
    ok: true,
    datos: {
      placa, flota_id: flotaId, concepto, monto, fecha_registro: fr || hoyBoliviaISO(),
      pagado: !!body.pagado, fecha_pago: fp, observaciones: texto(body.observaciones),
    },
  };
}

/**
 * Valida los datos de una póliza. El estado NO se recibe: se deriva
 * automáticamente de la fecha de vencimiento.
 */
export function validarDatosSeguro(body = {}) {
  const texto = v => {
    const t = String(v ?? '').trim();
    return t === '' ? null : t;
  };
  const placa = normalizarPlaca(body.placa);
  const aseguradora = texto(body.aseguradora);
  const poliza = texto(body.poliza);

  if (!placa) return { ok: false, error: 'Debe asociar el seguro a una placa' };
  if (!aseguradora) return { ok: false, error: 'La aseguradora es obligatoria' };
  if (!poliza) return { ok: false, error: 'El número de póliza es obligatorio' };

  const inicio = fechaISOValida(body.fecha_inicio);
  if (inicio === undefined) return { ok: false, error: 'Fecha de inicio inválida (formato AAAA-MM-DD)' };
  const vencimiento = fechaISOValida(body.fecha_vencimiento);
  if (vencimiento === undefined) return { ok: false, error: 'Fecha de vencimiento inválida (formato AAAA-MM-DD)' };
  const pago = fechaISOValida(body.fecha_pago);
  if (pago === undefined) return { ok: false, error: 'Fecha de pago inválida (formato AAAA-MM-DD)' };

  if (inicio && vencimiento && inicio > vencimiento) {
    return { ok: false, error: 'La fecha de inicio no puede ser posterior al vencimiento' };
  }

  const importe = decimalO(body.importe_pagado, 0);
  if (importe === undefined) return { ok: false, error: 'El importe pagado debe ser un número mayor o igual a 0' };

  return {
    ok: true,
    datos: { placa, aseguradora, poliza, fecha_inicio: inicio, fecha_vencimiento: vencimiento, importe_pagado: importe, fecha_pago: pago },
  };
}

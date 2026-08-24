/**
 * Utilidades de formato — GestorCompras
 *
 * Centralizamos aquí las funciones de presentación para mantener
 * consistencia en toda la aplicación (moneda boliviana, fechas locales).
 */

/**
 * Formatea un valor numérico como moneda boliviana.
 * @param {number|string} monto – cantidad a formatear
 * @returns {string} Ej: "Bs. 1,250.00"
 */
export function fmt(monto) {
  const num = Number(monto);
  if (isNaN(num)) return 'Bs. 0.00';
  return 'Bs. ' + num.toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Verifica si un valor es un ID entero positivo válido (auto-increment).
 * @param {string|number} valor – valor a validar
 * @returns {boolean}
 */
export function esID(valor) {
  return /^[1-9][0-9]*$/.test(String(valor || ''));
}

/**
 * Formatea una fecha ISO / Date a formato legible boliviano.
 * @param {string|Date} fecha – cadena ISO o instancia Date
 * @returns {string} Ej: "26/07/2026 23:27"
 */
export function fmtDate(fecha) {
  if (!fecha) return '—';
  const d = new Date(fecha);
  if (isNaN(d.getTime())) return '—';

  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const anio = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');

  return `${dia}/${mes}/${anio} ${hora}:${min}`;
}
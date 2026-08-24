'use client';

import { useState } from 'react';
import UploadZone from '@/components/forms/UploadZone';
import Toast from '@/components/ui/Toast';

/**
 * NuevaCompraPage — formulario para registrar un nuevo producto comprado.
 *
 * Refactorizado para:
 *   - Usar UploadZone (drag-and-drop + validación de 5MB) en vez de <input type="file"> directo
 *   - Usar Toast para mensajes de éxito/error en vez de divs inline
 */

export default function NuevaCompraPage() {
  const [producto, setProducto] = useState('');
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tieneFactura, setTieneFactura] = useState(false);
  const [fotoFactura, setFotoFactura] = useState(null);
  const [tipoPago, setTipoPago] = useState('fisico');
  const [fotoQr, setFotoQr] = useState(null);
  const [toast, setToast] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setToast(null);

    if (!producto.trim()) return setToast({ mensaje: 'El nombre del producto es obligatorio', tipo: 'error' });
    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum <= 0) return setToast({ mensaje: 'Ingresa un precio válido', tipo: 'error' });
    if (tipoPago === 'qr' && !fotoQr) return setToast({ mensaje: 'Debes subir el comprobante QR', tipo: 'error' });

    setGuardando(true);
    try {
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto, precio: precioNum, descripcion, tieneFactura, fotoFactura, tipoPago, fotoQr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ mensaje: data.error || 'Error al registrar la compra', tipo: 'error' });
        setGuardando(false);
        return;
      }
      setToast({ mensaje: 'Compra registrada correctamente', tipo: 'exito' });
      // Limpiar formulario
      setProducto(''); setPrecio(''); setDescripcion('');
      setTieneFactura(false); setFotoFactura(null);
      setTipoPago('fisico'); setFotoQr(null);
    } catch {
      setToast({ mensaje: 'No se pudo conectar con el servidor', tipo: 'error' });
    }
    setGuardando(false);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Nueva Compra</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Registra un nuevo producto adquirido</p>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        {/* Producto y Precio */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del producto *</label>
            <input value={producto} onChange={e => setProducto(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="Ej: Filtro de aceite Volvo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Precio (Bs.) *</label>
            <input type="number" step="0.01" min="0" value={precio} onChange={e => setPrecio(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="0.00" />
          </div>
        </div>

        {/* Descripción */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción (opcional)</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            placeholder="Detalles adicionales del producto..." />
        </div>

        {/* Factura */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <input type="checkbox" className="accent-blue-600" checked={tieneFactura} onChange={e => { setTieneFactura(e.target.checked); if (!e.target.checked) setFotoFactura(null); }} />
            ¿Tiene factura?
          </label>
          {tieneFactura && (
            <UploadZone
              label="Foto de la factura"
              value={fotoFactura}
              onChange={setFotoFactura}
            />
          )}
        </div>

        {/* Tipo de Pago */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Tipo de pago *</label>
          <div className="flex gap-4 flex-wrap mb-2">
            <label className="flex items-center gap-2 text-sm dark:text-slate-200">
              <input type="radio" name="pago" className="accent-blue-600" checked={tipoPago === 'fisico'} onChange={() => { setTipoPago('fisico'); setFotoQr(null); }} />
              Pago físico (efectivo)
            </label>
            <label className="flex items-center gap-2 text-sm dark:text-slate-200">
              <input type="radio" name="pago" className="accent-blue-600" checked={tipoPago === 'qr'} onChange={() => setTipoPago('qr')} />
              Transferencia QR
            </label>
          </div>
          {tipoPago === 'qr' && (
            <UploadZone
              label="Comprobante de transferencia"
              value={fotoQr}
              onChange={setFotoQr}
            />
          )}
        </div>

        {/* Botón submit */}
        <button type="submit" disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg transition">
          {guardando ? 'Guardando...' : '✅ Registrar compra'}
        </button>
      </form>

      {/* Toast de notificación */}
      {toast && (
        <Toast
          mensaje={toast.mensaje}
          tipo={toast.tipo}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
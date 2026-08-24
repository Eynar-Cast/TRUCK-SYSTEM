'use client';
import { useState, useEffect, useCallback } from 'react';
import UploadZone from '@/components/forms/UploadZone';
import Toast from '@/components/ui/Toast';

function fmt(n) {
  return 'Bs. ' + Number(n).toFixed(2);
}
function fmtFecha(iso) {
  return new Date(iso).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function DevolucionesPage() {
  const [compras, setCompras] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [compraId, setCompraId] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tipoPago, setTipoPago] = useState('fisico');
  const [comprobante, setComprobante] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarCompras = useCallback(async () => {
    try {
      const res = await fetch('/api/compras?periodo=todo');
      const data = await res.json();
      if (res.ok) {
        setCompras(data.compras.filter(c => !c.devuelto));
      }
    } catch {
      setError('No se pudieron cargar las compras');
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargarCompras(); }, [cargarCompras]);

  const compraSeleccionada = compras.find(c => c.id === Number(compraId));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMensaje('');

    if (!compraId) return setError('Selecciona una compra');
    if (!motivo.trim()) return setError('El motivo es obligatorio');
    if (tipoPago === 'transferencia' && !comprobante) return setError('Sube el comprobante de transferencia');

    setGuardando(true);
    try {
      const res = await fetch('/api/devoluciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compraId: Number(compraId), motivo, tipoPago, comprobante }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al registrar la devolución');
        setGuardando(false);
        return;
      }
      setMensaje('Devolución registrada correctamente');
      setCompraId(''); setMotivo(''); setTipoPago('fisico'); setComprobante(null);
      await cargarCompras();
    } catch {
      setError('No se pudo conectar con el servidor');
    }
    setGuardando(false);
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Devoluciones</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Registra una devolución de producto</p>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Seleccionar compra a devolver</label>
          <select
            value={compraId}
            onChange={(e) => setCompraId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          >
            <option value="">{cargando ? 'Cargando compras...' : '— Selecciona una compra —'}</option>
            {compras.map(c => (
              <option key={c.id} value={c.id}>
                {c.producto} — {fmt(c.precio)} — {fmtFecha(c.fecha)}
              </option>
            ))}
          </select>
          {!cargando && compras.length === 0 && (
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No tienes compras disponibles para devolver.</p>
          )}
        </div>

        {compraSeleccionada && (
          <form onSubmit={handleSubmit}>
            <div className="p-3 rounded-lg mb-4 bg-orange-50 border border-orange-200 dark:bg-orange-950/40 dark:border-orange-900">
              <div className="font-semibold text-orange-800 dark:text-orange-300">{compraSeleccionada.producto}</div>
              <div className="text-sm text-orange-700 dark:text-orange-400">
                Precio: {fmt(compraSeleccionada.precio)} · Comprado: {fmtFecha(compraSeleccionada.fecha)}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Motivo de devolución *</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                placeholder="Describe el motivo de la devolución..."
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reembolso — Tipo *</label>
              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm dark:text-slate-200">
                  <input type="radio" className="accent-blue-600" checked={tipoPago === 'fisico'} onChange={() => { setTipoPago('fisico'); setComprobante(null); }} />
                  Cobro físico (efectivo)
                </label>
                <label className="flex items-center gap-2 text-sm dark:text-slate-200">
                  <input type="radio" className="accent-blue-600" checked={tipoPago === 'transferencia'} onChange={() => setTipoPago('transferencia')} />
                  Transferencia bancaria
                </label>
              </div>
            </div>

            {tipoPago === 'transferencia' && (
              <div className="mb-4">
                <UploadZone label="Comprobante de transferencia (reembolso)" value={comprobante} onChange={setComprobante} maxMB={4} />
              </div>
            )}

            <button
              type="submit"
              disabled={guardando}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg transition"
            >
              {guardando ? 'Guardando...' : '🔄 Registrar devolución'}
            </button>
          </form>
        )}
      </div>

      {mensaje && <Toast mensaje={mensaje} tipo="exito" onClose={() => setMensaje('')} />}
      {error && <Toast mensaje={error} tipo="error" onClose={() => setError('')} />}
    </div>
  );
}
'use client';
import { useState, useEffect, useCallback } from 'react';
import UploadZone from '@/components/forms/UploadZone';
import Toast from '@/components/ui/Toast';

export default function GastoChoferPage() {
  const [choferes, setChoferes] = useState([]);
  const [choferId, setChoferId] = useState('');
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tieneFactura, setTieneFactura] = useState(false);
  const [fotoFactura, setFotoFactura] = useState(null);
  const [tipoPago, setTipoPago] = useState('fisico');
  const [fotoQr, setFotoQr] = useState(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargandoChoferes, setCargandoChoferes] = useState(true);

  const cargarChoferes = useCallback(async () => {
    try {
      const res = await fetch('/api/choferes');
      const data = await res.json();
      if (res.ok) setChoferes(data.choferes);
    } catch {
      setError('No se pudieron cargar los choferes');
    }
    setCargandoChoferes(false);
  }, []);

  useEffect(() => { cargarChoferes(); }, [cargarChoferes]);

  const choferesActivos = choferes.filter(c => c.activo);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setMensaje('');

    if (!choferId) return setError('Selecciona un chofer');
    if (!nombre.trim()) return setError('El nombre del gasto es obligatorio');
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return setError('Ingresa un monto válido');
    if (tipoPago === 'qr' && !fotoQr) return setError('Debes subir el comprobante QR');

    setGuardando(true);
    try {
      const res = await fetch('/api/gastos-choferes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choferId, nombre, monto: montoNum, descripcion, tieneFactura, fotoFactura, pagado: true, tipoPago, fotoQr }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al registrar el gasto');
        setGuardando(false);
        return;
      }
      setMensaje('Gasto registrado correctamente');
      setChoferId(''); setNombre(''); setMonto(''); setDescripcion('');
      setTieneFactura(false); setFotoFactura(null);
      setTipoPago('fisico'); setFotoQr(null);
    } catch {
      setError('No se pudo conectar con el servidor');
    }
    setGuardando(false);
  }

  if (cargandoChoferes) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Gasto de Chofer</h1>
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mb-6">Registra un gasto asociado a un chofer</p>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 text-slate-400 dark:text-slate-500 text-sm">
          Cargando choferes...
        </div>
      </div>
    );
  }

  if (choferesActivos.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Gasto de Chofer</h1>
        <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mb-6">Registra un gasto asociado a un chofer</p>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-yellow-800 dark:bg-yellow-950/40 dark:border-yellow-900 dark:text-yellow-200 text-sm">
          ⚠️ No hay choferes activos registrados. El administrador debe registrar al menos un chofer antes de que puedas registrar gastos.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Gasto de Chofer</h1>
      <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm mb-6">Registra un gasto asociado a un chofer</p>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chofer *</label>
          <select value={choferId} onChange={e => setChoferId(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100">
            <option value="">— Selecciona un chofer —</option>
            {choferesActivos.map(c => (
              <option key={c.id} value={c.id}>{c.nombre} — {c.placa}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del gasto *</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="Ej: Combustible, Peaje..." />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Monto (Bs.) *</label>
            <input type="number" step="0.01" min="0" value={monto} onChange={e => setMonto(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              placeholder="0.00" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción (opcional)</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            placeholder="Detalles adicionales..." />
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            <input type="checkbox" className="accent-blue-600" checked={tieneFactura}
              onChange={e => { setTieneFactura(e.target.checked); if (!e.target.checked) setFotoFactura(null); }} />
            ¿Tiene factura?
          </label>
          {tieneFactura && (
            <UploadZone label="Foto de la factura" value={fotoFactura} onChange={setFotoFactura} maxMB={4} />
          )}
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Tipo de pago *</label>
          <div className="flex gap-4 flex-wrap mb-2">
            <label className="flex items-center gap-2 text-sm dark:text-slate-200">
              <input type="radio" className="accent-blue-600" checked={tipoPago === 'fisico'} onChange={() => { setTipoPago('fisico'); setFotoQr(null); }} />
              Pago físico
            </label>
            <label className="flex items-center gap-2 text-sm dark:text-slate-200">
              <input type="radio" className="accent-blue-600" checked={tipoPago === 'qr'} onChange={() => setTipoPago('qr')} />
              QR / Transferencia
            </label>
          </div>
          {tipoPago === 'qr' && (
            <UploadZone label="Comprobante QR / transferencia" value={fotoQr} onChange={setFotoQr} maxMB={4} />
          )}
        </div>

        <button type="submit" disabled={guardando}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg transition">
          {guardando ? 'Guardando...' : '✅ Registrar gasto'}
        </button>
      </form>

      {mensaje && <Toast mensaje={mensaje} tipo="exito" onClose={() => setMensaje('')} />}
      {error && <Toast mensaje={error} tipo="error" onClose={() => setError('')} />}
    </div>
  );
}
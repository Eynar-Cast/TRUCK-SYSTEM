'use client';
import { useState, useEffect, useCallback } from 'react';
import Toast from '@/components/ui/Toast';

export default function GastoChoferPage() {
  const [choferes, setChoferes] = useState([]);
  const [choferId, setChoferId] = useState('');
  const [nombre, setNombre] = useState('');
  const [monto, setMonto] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tieneFactura, setTieneFactura] = useState(false);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [enlace, setEnlace] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [tipoPago, setTipoPago] = useState('fisico');
  const [placa, setPlaca] = useState('');
  const [flota, setFlota] = useState([]);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargandoChoferes, setCargandoChoferes] = useState(true);

  const cargarChoferes = useCallback(async () => {
    try {
      const res = await fetch('/api/choferes');
      const data = await res.json();
      if (res.ok) setChoferes(data.choferes);
      const rf = await fetch('/api/flota?limit=100'); const df=await rf.json(); setFlota(df.vehiculos||df.flota||[]);
    } catch { setError('No se pudieron cargar los choferes'); }
    setCargandoChoferes(false);
  }, []);
  useEffect(() => { cargarChoferes(); }, [cargarChoferes]);
  const choferesActivos = choferes.filter(c => c.activo);

  async function handleSubmit(e) {
    e.preventDefault(); setError(''); setMensaje('');
    if (!choferId) return setError('Selecciona un chofer');
    if (!nombre.trim()) return setError('El nombre del gasto es obligatorio');
    const montoNum = parseFloat(monto);
    if (isNaN(montoNum) || montoNum <= 0) return setError('Ingresa un monto válido');
    setGuardando(true);
    try {
      const res = await fetch('/api/gastos-choferes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choferId, nombre, monto: montoNum, descripcion, tieneFactura, pagado: true, tipoPago, enlace, numero_factura: numeroFactura, numero_comprobante: numeroComprobante, placa: placa || null }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error al registrar el gasto'); setGuardando(false); return; }
      setMensaje('Gasto registrado correctamente');
      setChoferId(''); setNombre(''); setMonto(''); setDescripcion('');
      setTieneFactura(false); setNumeroFactura(''); setEnlace(''); setNumeroComprobante(''); setTipoPago('fisico'); setPlaca('');
    } catch { setError('No se pudo conectar con el servidor'); }
    setGuardando(false);
  }
  const inputCls="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
  if (cargandoChoferes) return <div><h1 className="text-2xl font-bold mb-1">Gasto de Chofer</h1><div className="bg-white rounded-xl border p-6 text-sm">Cargando choferes...</div></div>;
  if (choferesActivos.length === 0) return <div><h1 className="text-2xl font-bold mb-1">Gasto de Chofer</h1><div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-sm">⚠️ No hay choferes activos.</div></div>;
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Gasto de Chofer</h1>
      <p className="text-slate-500 text-sm mb-6">Solo texto: enlace + Nº factura/comprobante (sin imágenes)</p>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1">Chofer *</label>
          <select value={choferId} onChange={e => setChoferId(e.target.value)} className={inputCls}>
            <option value="">— Selecciona un chofer —</option>
            {choferesActivos.map(c => <option key={c.id} value={c.id}>{c.nombre} — {c.placa}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Placa (opcional, asocia gasto a camión)</label>
          <input list="placas-gasto" value={placa} onChange={e=>setPlaca(e.target.value.toUpperCase())} className={`${inputCls} font-mono`} placeholder="Ej: 1234-ABC" />
          <datalist id="placas-gasto">{flota.map(f=><option key={f.id} value={f.placa} />)}</datalist>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="block text-sm font-medium mb-1">Nombre del gasto *</label><input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} placeholder="Ej: Combustible, Peaje..." /></div>
          <div><label className="block text-sm font-medium mb-1">Monto (Bs.) *</label><input type="number" step="0.01" min="0" value={monto} onChange={e => setMonto(e.target.value)} className={inputCls} placeholder="0.00" /></div>
        </div>
        <div><label className="block text-sm font-medium mb-1">Descripción (opcional)</label><textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className={inputCls} placeholder="Detalles..." /></div>
        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold dark:text-slate-200"><input type="checkbox" checked={tieneFactura} onChange={e=>setTieneFactura(e.target.checked)} /> ¿Tiene factura?</label>
          <input value={numeroFactura} onChange={e=>setNumeroFactura(e.target.value)} className={inputCls} placeholder="Nº Factura" />
          <input value={enlace} onChange={e=>setEnlace(e.target.value)} className={inputCls} placeholder="Enlace de acceso (URL texto)" />
        </div>
        <div className="border rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60 space-y-3">
          <label className="block text-sm font-semibold mb-2 dark:text-slate-200">Tipo de pago *</label>
          <div className="flex gap-4 flex-wrap mb-2">
            <label className="flex items-center gap-2 text-sm dark:text-slate-200"><input type="radio" checked={tipoPago==='fisico'} onChange={()=>setTipoPago('fisico')} /> Pago físico</label>
            <label className="flex items-center gap-2 text-sm dark:text-slate-200"><input type="radio" checked={tipoPago==='qr'} onChange={()=>setTipoPago('qr')} /> QR / Transferencia</label>
          </div>
          <input value={numeroComprobante} onChange={e=>setNumeroComprobante(e.target.value)} className={inputCls} placeholder="Nº Comprobante / Transferencia (texto)" />
        </div>
        <button type="submit" disabled={guardando} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg">
          {guardando ? 'Guardando...' : '✅ Registrar gasto'}
        </button>
      </form>
      {mensaje && <Toast mensaje={mensaje} tipo="exito" onClose={()=>setMensaje('')} />}
      {error && <Toast mensaje={error} tipo="error" onClose={()=>setError('')} />}
    </div>
  );
}

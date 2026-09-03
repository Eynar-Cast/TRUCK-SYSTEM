'use client';
import { useState, useEffect } from 'react';
import Toast from '@/components/ui/Toast';

export default function NuevaCompraPage() {
  const [producto, setProducto] = useState('');
  const [precio, setPrecio] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tieneFactura, setTieneFactura] = useState(false);
  const [numeroFactura, setNumeroFactura] = useState('');
  const [enlace, setEnlace] = useState('');
  const [numeroComprobante, setNumeroComprobante] = useState('');
  const [tipoPago, setTipoPago] = useState('fisico');
  const [placa, setPlaca] = useState('');
  const [flota, setFlota] = useState([]);
  const [toast, setToast] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(()=>{ fetch('/api/flota?limit=100').then(r=>r.json()).then(d=>setFlota(d.vehiculos||d.flota||[])).catch(()=>{}); },[]);

  async function handleSubmit(e) {
    e.preventDefault();
    setToast(null);
    if (!producto.trim()) return setToast({ mensaje: 'El nombre del producto es obligatorio', tipo: 'error' });
    const precioNum = parseFloat(precio);
    if (isNaN(precioNum) || precioNum <= 0) return setToast({ mensaje: 'Ingresa un precio válido', tipo: 'error' });

    setGuardando(true);
    try {
      const flotaId = flota.find(f=>f.placa===placa)?.id || null;
      const res = await fetch('/api/compras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ producto, precio: precioNum, descripcion, tieneFactura, tipoPago, enlace, numero_factura: numeroFactura, numero_comprobante: numeroComprobante, placa: placa || null, flota_id: flotaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setToast({ mensaje: data.error || 'Error al registrar la compra', tipo: 'error' });
        setGuardando(false);
        return;
      }
      setToast({ mensaje: 'Compra registrada correctamente', tipo: 'exito' });
      setProducto(''); setPrecio(''); setDescripcion('');
      setTieneFactura(false); setNumeroFactura(''); setEnlace(''); setNumeroComprobante('');
      setTipoPago('fisico'); setPlaca('');
    } catch {
      setToast({ mensaje: 'No se pudo conectar con el servidor', tipo: 'error' });
    }
    setGuardando(false);
  }

  const inputCls="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";
  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Nueva Compra</h1>
      <p className="text-slate-500 text-sm mb-6">Registra repuesto — solo texto: enlace + Nº factura/comprobante (sin imágenes)</p>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre del producto *</label>
            <input value={producto} onChange={e => setProducto(e.target.value)} className={inputCls} placeholder="Ej: Filtro de aceite Volvo" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Precio (Bs.) *</label>
            <input type="number" step="0.01" min="0" value={precio} onChange={e => setPrecio(e.target.value)} className={inputCls} placeholder="0.00" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Descripción (opcional)</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={2} className={inputCls} placeholder="Detalles adicionales..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Placa (opcional — asocia repuesto a camión)</label>
          <select value={placa} onChange={e=>setPlaca(e.target.value)} className={`${inputCls} font-mono`}>
            <option value="">— Sin placa / no asociar —</option>
            {flota.map(f=><option key={f.id} value={f.placa}>{f.placa} — {f.marca} {f.modelo}</option>)}
          </select>
          {flota.length===0 && <p className="text-[11px] text-amber-600 mt-1">No hay camiones. Registra en Flota primero.</p>}
        </div>
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60 space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
            <input type="checkbox" className="accent-blue-600" checked={tieneFactura} onChange={e => setTieneFactura(e.target.checked)} />
            ¿Tiene factura?
          </label>
          <input value={numeroFactura} onChange={e=>setNumeroFactura(e.target.value)} className={inputCls} placeholder="Nº de Factura" />
          <input value={enlace} onChange={e=>setEnlace(e.target.value)} className={inputCls} placeholder="Enlace de acceso (URL texto) — Drive, etc." />
        </div>
        <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-4 bg-slate-50 dark:bg-slate-800/60 space-y-3">
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo de pago *</label>
          <div className="flex gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-sm dark:text-slate-200"><input type="radio" className="accent-blue-600" checked={tipoPago==='fisico'} onChange={()=>setTipoPago('fisico')} /> Pago físico (efectivo)</label>
            <label className="flex items-center gap-2 text-sm dark:text-slate-200"><input type="radio" className="accent-blue-600" checked={tipoPago==='qr'} onChange={()=>setTipoPago('qr')} /> Transferencia QR</label>
          </div>
          <input value={numeroComprobante} onChange={e=>setNumeroComprobante(e.target.value)} className={inputCls} placeholder="Nº Comprobante / Nº Transferencia / QR (texto)" />
        </div>
        <button type="submit" disabled={guardando} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg transition">
          {guardando ? 'Guardando...' : '✅ Registrar compra'}
        </button>
      </form>
      {toast && <Toast mensaje={toast.mensaje} tipo={toast.tipo} onClose={()=>setToast(null)} />}
    </div>
  );
}

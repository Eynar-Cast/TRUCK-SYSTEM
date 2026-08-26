'use client';
import { useState, useEffect, useCallback } from 'react';

/**
 * Catálogos — administración simple de las listas desplegables del
 * módulo de Flota (equivalente a las validaciones del Excel):
 *   - Tipos de vehículo
 *   - Marcas
 *   - Modelos
 * Los valores también se alimentan solos al registrar vehículos.
 */

const PESTANAS = [
  { tipo: 'tipo_vehiculo', label: 'Tipos de vehículo', icono: '🚚' },
  { tipo: 'marca', label: 'Marcas', icono: '🏷️' },
  { tipo: 'modelo', label: 'Modelos', icono: '🔧' },
];

export default function CatalogosPage() {
  const [activa, setActiva] = useState('tipo_vehiculo');
  const [valores, setValores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [nuevo, setNuevo] = useState('');
  const [editValor, setEditValor] = useState(null); // {id, valor}
  const [editTexto, setEditTexto] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch(`/api/catalogos?tipo=${activa}`);
      const data = await res.json();
      if (res.ok) setValores(data.catalogos || []);
    } catch {
      setError('No se pudo cargar el catálogo');
    }
    setCargando(false);
  }, [activa]);

  useEffect(() => { cargar(); }, [cargar]);

  async function agregar() {
    if (!nuevo.trim()) return;
    const res = await fetch('/api/catalogos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: activa, valor: nuevo }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'No se pudo agregar'); return; }
    setNuevo('');
    setError('');
    await cargar();
  }

  async function renombrar(id) {
    const res = await fetch(`/api/catalogos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: editTexto }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error || 'No se pudo renombrar'); return; }
    setEditValor(null);
    await cargar();
  }

  async function toggle(item) {
    const res = await fetch(`/api/catalogos/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'toggle' }),
    });
    if (!res.ok) { setError('No se pudo cambiar el estado'); return; }
    await cargar();
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Catálogos</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm">Listas desplegables para los formularios de Flota</p>
      </div>

      <div className="flex gap-2 mb-4">
        {PESTANAS.map(p => (
          <button key={p.tipo} onClick={() => setActiva(p.tipo)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
              activa === p.tipo ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
            {p.icono} {p.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
          <input value={nuevo} onChange={e => setNuevo(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && agregar()}
            placeholder={`Agregar valor…`} className={inputCls} />
          <button onClick={agregar} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">➕ Agregar</button>
        </div>

        {error && <div className="m-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{error}</div>}

        {cargando ? (
          <div className="p-10 text-center text-slate-400">Cargando...</div>
        ) : valores.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            No hay valores en este catálogo. Se llenarán también automáticamente al registrar vehículos.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {valores.map(v => (
              <li key={v.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 ${!v.activo ? 'opacity-50' : ''}`}>
                {editValor?.id === v.id ? (
                  <>
                    <input value={editTexto} onChange={e => setEditTexto(e.target.value)} className={`${inputCls} max-w-xs`} autoFocus />
                    <div className="flex gap-2">
                      <button onClick={() => renombrar(v.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60">Guardar</button>
                      <button onClick={() => setEditValor(null)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <span className="text-sm text-slate-800 dark:text-slate-200">{v.valor}{!v.activo && <span className="ml-2 text-[10px] bg-red-100 text-red-500 px-1.5 py-0.5 rounded-full align-middle">Inactivo</span>}</span>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditValor({ id: v.id }); setEditTexto(v.valor); }}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300">✏️ Renombrar</button>
                      <button onClick={() => toggle(v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${v.activo ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-900/60' : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/60'}`}>
                        {v.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

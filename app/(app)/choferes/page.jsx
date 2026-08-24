'use client';
import { useState, useEffect, useCallback } from 'react';

export default function ChoferesPage() {
  const [choferes, setChoferes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [modalAbierto, setModalAbierto] = useState(false);
  const [editando, setEditando] = useState(null); // null = nuevo, objeto = editar

  const [nombre, setNombre] = useState('');
  const [placa, setPlaca] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [guardando, setGuardando] = useState(false);

  const cargarChoferes = useCallback(async () => {
    try {
      const res = await fetch('/api/choferes');
      const data = await res.json();
      if (res.ok) setChoferes(data.choferes);
    } catch {
      setError('No se pudo cargar la lista de choferes');
    }
    setCargando(false);
  }, []);

  useEffect(() => { cargarChoferes(); }, [cargarChoferes]);

  function abrirNuevo() {
    setEditando(null);
    setNombre(''); setPlaca(''); setTelefono(''); setDireccion('');
    setError('');
    setModalAbierto(true);
  }

  function abrirEditar(c) {
    setEditando(c);
    setNombre(c.nombre); setPlaca(c.placa);
    setTelefono(c.telefono || ''); setDireccion(c.direccion || '');
    setError('');
    setModalAbierto(true);
  }

  async function guardar() {
    if (!nombre.trim() || !placa.trim()) {
      setError('Nombre y placa son obligatorios');
      return;
    }
    setGuardando(true);
    const url = editando ? `/api/choferes/${editando.id}` : '/api/choferes';
    const method = editando ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, placa, telefono, direccion }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || 'Error al guardar');
      setGuardando(false);
      return;
    }
    setModalAbierto(false);
    setGuardando(false);
    await cargarChoferes();
  }

  async function toggleChofer(c) {
    if (c.activo) {
      const ok = window.confirm(`¿Seguro que deseas desactivar a "${c.nombre}" (placa ${c.placa})? No podrá registrarse gastos nuevos. Puedes reactivarlo después.`);
      if (!ok) return;
    }
    const res = await fetch(`/api/choferes/${c.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accion: 'toggle' }),
    });
    if (!res.ok) {
      setError('No se pudo cambiar el estado del chofer');
      return;
    }
    await cargarChoferes();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Choferes</h1>
          <p className="text-slate-500 dark:text-slate-400 dark:text-slate-500 text-sm">Registro de choferes y sus camiones</p>
        </div>
        <button onClick={abrirNuevo} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg text-sm">
          ➕ Nuevo chofer
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {cargando ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">Cargando...</div>
        ) : choferes.length === 0 ? (
          <div className="p-12 text-center text-slate-400 dark:text-slate-500">
            <div className="text-4xl mb-3">🚛</div>
            <p className="font-medium">No hay choferes registrados</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/60 border-b-2 border-slate-200 dark:border-slate-800 text-left">
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Nombre</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Placa</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Teléfono</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Dirección</th>
                  <th className="px-4 py-3 text-[11px] font-semibold text-slate-500 dark:text-slate-400 dark:text-slate-500 uppercase">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {choferes.map(c => (
                  <tr key={c.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:bg-slate-800/60 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full bg-yellow-100 dark:bg-yellow-950/40 flex items-center justify-center font-bold text-yellow-800 dark:text-yellow-300 text-sm">
                          {c.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{c.nombre}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 px-2.5 py-0.5 rounded-full">{c.placa}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{c.telefono || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500">{c.direccion || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 dark:bg-red-900/40 dark:text-red-300'}`}>
                        {c.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => toggleChofer(c)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${c.activo ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 hover:bg-red-200 dark:bg-red-900/40 dark:text-red-300 dark:hover:bg-red-900/60' : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60'}`}>
                          {c.activo ? 'Desactivar' : 'Activar'}
                        </button>
                        <button onClick={() => abrirEditar(c)} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-200 text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
                          ✏️ Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalAbierto && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setModalAbierto(false); }}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{editando ? 'Editar Chofer' : 'Nuevo Chofer'}</h3>
              <button onClick={() => setModalAbierto(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 dark:text-slate-500 text-xl">✕</button>
            </div>

            {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{error}</div>}

            <div className="grid gap-3.5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nombre completo *</label>
                <input value={nombre} onChange={e => setNombre(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Pedro Quispe" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Placa del camión *</label>
                <input value={placa} onChange={e => setPlaca(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: 1234-BCD" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Teléfono (opcional)</label>
                <input value={telefono} onChange={e => setTelefono(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: 70012345" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Dirección (opcional)</label>
                <input value={direccion} onChange={e => setDireccion(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  placeholder="Ej: Av. Montes 123, La Paz" />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setModalAbierto(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 dark:text-slate-300 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
                Cancelar
              </button>
              <button onClick={guardar} disabled={guardando} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
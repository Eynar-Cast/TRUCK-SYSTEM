'use client';
import { useState } from 'react';

export default function CambiarPassword() {
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva1, setNueva1] = useState('');
  const [nueva2, setNueva2] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [guardando, setGuardando] = useState(false);

  function abrir() {
    setActual(''); setNueva1(''); setNueva2('');
    setError(''); setMensaje('');
    setAbierto(true);
  }

  async function guardar() {
    setError(''); setMensaje('');
    if (!actual) return setError('Ingresa tu contraseña actual');
    if (nueva1.length < 6) return setError('La nueva contraseña debe tener al menos 6 caracteres');
    if (nueva1 !== nueva2) return setError('Las contraseñas nuevas no coinciden');

    setGuardando(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passwordActual: actual, passwordNuevo: nueva1 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cambiar la contraseña');
        setGuardando(false);
        return;
      }
      setMensaje('✅ Contraseña actualizada correctamente');
      setActual(''); setNueva1(''); setNueva2('');
    } catch {
      setError('No se pudo conectar con el servidor');
    }
    setGuardando(false);
  }

  return (
    <>
      <button
        onClick={abrir}
        className="w-full text-left px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/10 hover:text-white"
      >
        🔑 Mi contraseña
      </button>

      {abierto && (
        <div
          className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setAbierto(false); }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cambiar mi contraseña</h3>
              <button onClick={() => setAbierto(false)} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-xl">✕</button>
            </div>

            {mensaje && <div className="mb-4 p-3 rounded-lg bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 text-sm">{mensaje}</div>}
            {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300 text-sm">{error}</div>}

            <div className="grid gap-3.5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Contraseña actual *</label>
                <input
                  type="password"
                  value={actual}
                  onChange={e => setActual(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nueva contraseña *</label>
                <input
                  type="password"
                  value={nueva1}
                  onChange={e => setNueva1(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Confirmar nueva contraseña *</label>
                <input
                  type="password"
                  value={nueva2}
                  onChange={e => setNueva2(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-6">
              <button onClick={() => setAbierto(false)} className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600">
                Cerrar
              </button>
              <button onClick={guardar} disabled={guardando} className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60">
                {guardando ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
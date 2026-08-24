'use client';
import { useState, useEffect, useCallback } from 'react';

export default function LimpiarDatosPage() {
  const [stats, setStats] = useState(null);
  const [cargandoStats, setCargandoStats] = useState(true);

  const [descargado, setDescargado] = useState({ xlsx: false, json: false });
  const [descargando, setDescargando] = useState('');

  const [aceptaCheckbox, setAceptaCheckbox] = useState(false);
  const [textoConfirmacion, setTextoConfirmacion] = useState('');
  const [limpiando, setLimpiando] = useState(false);
  const [error, setError] = useState('');
  const [resultado, setResultado] = useState(null);

  const cargarStats = useCallback(async () => {
    setCargandoStats(true);
    try {
      const res = await fetch('/api/admin/limpiar-datos');
      const data = await res.json();
      if (res.ok) setStats(data);
    } catch {
      // silencioso, no es crítico si falla la carga de estadísticas
    }
    setCargandoStats(false);
  }, []);

  useEffect(() => { cargarStats(); }, [cargarStats]);

  async function descargarRespaldo(formato) {
    setDescargando(formato);
    try {
      const res = await fetch(`/api/admin/exportar?formato=${formato}&periodo=todo`);
      if (!res.ok) throw new Error('No se pudo generar el archivo');

      const blob = await res.blob();
      const disposicion = res.headers.get('Content-Disposition') || '';
      const match = disposicion.match(/filename="(.+)"/);
      const nombreArchivo = match ? match[1] : `gestorcompras_respaldo.${formato}`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      setDescargado(prev => ({ ...prev, [formato]: true }));
    } catch {
      setError('No se pudo descargar el respaldo. Intenta de nuevo antes de continuar.');
    }
    setDescargando('');
  }

  const ambosDescargados = descargado.xlsx && descargado.json;
  const puedeLimpiar = ambosDescargados && aceptaCheckbox && textoConfirmacion.trim() === 'BORRAR';

  async function limpiarBaseDeDatos() {
    if (!puedeLimpiar) return;
    setError('');
    setLimpiando(true);
    try {
      const res = await fetch('/api/admin/limpiar-datos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacion: 'BORRAR' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo completar la limpieza');

      setResultado(data);
      setDescargado({ xlsx: false, json: false });
      setAceptaCheckbox(false);
      setTextoConfirmacion('');
      await cargarStats();
    } catch (err) {
      setError(err.message);
    }
    setLimpiando(false);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Limpiar Base de Datos</h1>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
        Libera espacio eliminando el historial de compras, devoluciones y gastos de chofer.
        Los usuarios y choferes registrados nunca se eliminan.
      </p>

      {/* Estado actual */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Datos actuales</h2>
        {cargandoStats ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : stats ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Compras</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.compras}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Devoluciones</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.devoluciones}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Gastos chofer</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.gastosChofer}</div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">Fotos</div>
              <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{stats.fotos}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400">No se pudieron cargar las estadísticas.</p>
        )}
      </div>

      {stats?.respaldosAutomaticos?.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-5">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Respaldos automáticos anteriores
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Copias que el sistema guardó solo, cada vez que se hizo una limpieza — úsalas si alguna vez pierdes tu descarga manual.
          </p>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.respaldosAutomaticos.map((r) => (
              <li key={r.url} className="py-2 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">
                    {new Date(r.fecha).toLocaleDateString('es-BO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    {' '}
                    {new Date(r.fecha).toLocaleTimeString('es-BO', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs text-slate-400">{(r.tamano / 1024).toFixed(0)} KB</div>
                </div>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
                >
                  Descargar
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resultado && (
        <div className="mb-5 p-4 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900">
          <p className="font-semibold text-green-800 dark:text-green-300 mb-1">✅ Limpieza completada</p>
          <ul className="text-sm text-green-700 dark:text-green-400 space-y-0.5">
            <li>• {resultado.comprasEliminadas} compras eliminadas</li>
            <li>• {resultado.devolucionesEliminadas} devoluciones eliminadas</li>
            <li>• {resultado.gastosEliminados} gastos de chofer eliminados</li>
            <li>• {resultado.fotosEliminadas} fotos eliminadas de almacenamiento{resultado.fotosConError > 0 ? ` (${resultado.fotosConError} no se pudieron borrar, probablemente ya no existían)` : ''}</li>
          </ul>
          {resultado.respaldoUrl && (
            <a
              href={resultado.respaldoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-2 text-sm font-medium text-green-800 dark:text-green-300 underline"
            >
              🔒 Ver respaldo automático guardado antes de la limpieza
            </a>
          )}
        </div>
      )}

      {error && <div className="mb-4 p-3 rounded-lg bg-red-100 text-red-600 text-sm">{error}</div>}

      {/* Paso 1: respaldos obligatorios */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-5">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
          Paso 1 — Descarga ambos respaldos completos
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
          Guárdalos en un lugar seguro (una carpeta en tu computadora o en Google Drive) antes de continuar.
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => descargarRespaldo('xlsx')}
            disabled={!!descargando}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 ${
              descargado.xlsx ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {descargando === 'xlsx' ? 'Generando...' : descargado.xlsx ? '✅ Excel descargado' : '📊 Descargar Excel'}
          </button>
          <button
            onClick={() => descargarRespaldo('json')}
            disabled={!!descargando}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-60 ${
              descargado.json ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-slate-700 hover:bg-slate-800 text-white'
            }`}
          >
            {descargando === 'json' ? 'Generando...' : descargado.json ? '✅ JSON descargado' : '🗂️ Descargar JSON'}
          </button>
        </div>
      </div>

      {/* Paso 2: confirmación */}
      <div className={`rounded-xl border p-5 transition ${
        ambosDescargados
          ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 opacity-50 pointer-events-none'
      }`}>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
          Paso 2 — Confirma la limpieza
        </h2>

        <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300 mb-4">
          <input
            type="checkbox"
            checked={aceptaCheckbox}
            onChange={(e) => setAceptaCheckbox(e.target.checked)}
            className="mt-0.5"
          />
          <span>Ya descargué y guardé ambos respaldos. Entiendo que esta acción eliminará permanentemente
            todas las compras, devoluciones y gastos de chofer del sistema (los usuarios y choferes no se ven afectados).</span>
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Escribe <span className="font-mono font-bold text-red-600">BORRAR</span> para confirmar
        </label>
        <input
          type="text"
          value={textoConfirmacion}
          onChange={(e) => setTextoConfirmacion(e.target.value)}
          className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg text-sm mb-4"
          placeholder="BORRAR"
        />

        <button
          onClick={limpiarBaseDeDatos}
          disabled={!puedeLimpiar || limpiando}
          className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium px-5 py-2.5 rounded-lg transition"
        >
          {limpiando ? 'Limpiando...' : '🗑️ Limpiar base de datos ahora'}
        </button>
      </div>
    </div>
  );
}
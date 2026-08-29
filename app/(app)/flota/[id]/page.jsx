'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { fmtFechaISO, fmtDate } from '@/lib/utils';
import { evaluarProxima } from '@/lib/flota';

/**
 * Ficha del camión — información general + control de llantas +
 * control de aceites + seguro de carga + seguros del vehículo.
 * Todos los estados (Vigente/Vencido y Cambiar ya/Por cambiar/Al día)
 * se calculan automáticamente según la fecha actual.
 */

const ESTADO_ESTILO = {
  Vigente: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  Vencido: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
};

const ESTADO_MANT_ESTILO = {
  'Cambiar ya': 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300',
  'Por cambiar': 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  'Al día': 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};

const inputCls = 'w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 rounded-lg outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

export default function FlotaDetallePage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const res = await fetch(`/api/flota/${id}`);
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al cargar');
      setData(d);
    } catch (e) {
      setError(e.message);
    }
    setCargando(false);
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  if (cargando) return <div className="p-12 text-center text-slate-400">Cargando ficha...</div>;
  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-500 mb-4">{error}</p>
        <Link href="/flota" className="text-blue-600 hover:underline text-sm">← Volver al reporte de camiones</Link>
      </div>
    );
  }

  const { vehiculo: v, seguros, llantas, aceites, seguros_carga } = data;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 no-print">
        <Link href="/flota" className="text-blue-600 hover:underline text-sm">← Volver al reporte de camiones</Link>
      </div>

      {/* Encabezado */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Ficha del camión · <span className="font-mono">{v.placa}</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Volvo {v.modelo} · {v.tipo} · Año {v.anio ?? '—'}
          </p>
        </div>
        <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
          !v.activo ? 'bg-slate-200 text-slate-500' :
          v.estado_vehiculo === 'Seguro Vencido' ? ESTADO_ESTILO.Vencido : ESTADO_ESTILO.Vigente}`}>
          {v.activo ? v.estado_vehiculo : 'Inactivo'}
        </span>
      </div>

      {/* Alertas de mantenimiento: ¿ya toca cambiar llantas o aceites? */}
      <AlertaMantenimiento llantas={llantas} aceites={aceites} />

      {/* Información general */}
      <section className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 mb-4">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100 mb-1">Información general</h2>
        <p className="text-xs text-slate-400 mb-4">Datos registrados por el usuario</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Campo label="Placa" valor={v.placa} />
          <Campo label="Color" valor={v.color} />
          <Campo label="Tipo" valor={v.tipo} />
          <Campo label="Año" valor={v.anio} />
          <Campo label="Marca" valor={v.marca} />
          <Campo label="Modelo" valor={v.modelo} />
          <Campo label="Operador logístico" valor={v.operador_logistico} />
          <Campo label="Conductor designado" valor={v.conductor_designado} />
          <Campo label="Carga máxima" valor={v.carga_maxima_kg != null ? `${Number(v.carga_maxima_kg).toLocaleString('es-BO')} Kg` : null} full />
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        {/* Control de llantas */}
        <Seccion titulo="Control de llantas" icono="🛞"
          subtitulo="Historial · cambio cada 3 meses · alerta 15 días antes">
          <FormularioLlantas vehiculoId={v.id} onGuardado={cargar} registros={llantas} />
        </Seccion>

        {/* Control de aceites */}
        <Seccion titulo="Control de aceites" icono="🛢️"
          subtitulo="Motor · caja · corona — historial y estado del próximo cambio">
          <FormularioAceites vehiculoId={v.id} onGuardado={cargar} registros={aceites} />
        </Seccion>
      </div>

      {/* Seguro de carga */}
      <Seccion titulo="Seguro de carga del camión" icono="📦"
        subtitulo="Pólizas con fecha de trámite · estado automático · historial"
        className="mb-4">
        <FormularioSeguroCarga vehiculoId={v.id} onGuardado={cargar} registros={seguros_carga} />
      </Seccion>

      {/* Seguros del vehículo */}
      <Seccion titulo={`Seguros del vehículo (${v.placa})`} icono="🛡️"
        subtitulo="Historial de pólizas asociadas por placa · estado calculado automáticamente"
        className="mb-6">
        {seguros.length === 0 ? (
          <p className="p-4 text-center text-slate-400 text-sm">Sin seguros registrados para esta placa. Regístralos en el módulo de Seguros.</p>
        ) : (
          <Tabla
            headers={['Nro', 'Aseguradora', 'Póliza', 'Inicio', 'Vencimiento', 'Importe pagado', 'Fecha de pago', 'Estado']}
            filas={seguros.map((s, i) => [
              i + 1,
              <b key="a">{s.aseguradora}</b>,
              <span key="p" className="font-mono text-xs">{s.poliza}</span>,
              fmtFechaISO(s.fecha_inicio),
              fmtFechaISO(s.fecha_vencimiento),
              s.importe_pagado != null ? `Bs. ${Number(s.importe_pagado).toLocaleString('es-BO')}` : '—',
              fmtFechaISO(s.fecha_pago),
              <Badge key="e" texto={s.estado} />,
            ])}
          />
        )}
      </Seccion>

      <p className="text-xs text-slate-400 text-center">Registrado el {fmtDate(v.creado)}</p>
    </div>
  );
}

// ---------- Secciones interactivas ----------

function FormularioLlantas({ vehiculoId, onGuardado, registros }) {
  const [form, setForm] = useState({ llantas_tracto: '', llantas_chata: '', marca: '', fecha_cambio: '', proxima_fecha: '', observacion: '' });
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!form.llantas_tracto && !form.llantas_chata) { setAviso('Registre la cantidad de llantas del tracto o de la chata'); return; }
    setGuardando(true); setAviso('');
    const res = await fetch(`/api/flota/${vehiculoId}/llantas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) { setAviso(data.error || 'No se pudo registrar'); return; }
    setForm({ llantas_tracto: '', llantas_chata: '', marca: '', fecha_cambio: '', proxima_fecha: '', observacion: '' });
    await onGuardado();
  }

  async function quitar(itemId) {
    if (!window.confirm('¿Eliminar este registro de llantas?')) return;
    await fetch(`/api/flota/${vehiculoId}/llantas?itemId=${itemId}`, { method: 'DELETE' });
    await onGuardado();
  }

  return (
    <>
      {registros.length === 0 ? (
        <p className="text-xs text-slate-400 mb-2">Sin cambios de llantas registrados.</p>
      ) : (
        <Tabla compacta
          headers={['Cambio', 'Tracto', 'Chata', 'Marca', 'Próximo', 'Estado', '']}
          filas={registros.map(l => {
            const estado = evaluarProxima(l.proxima_fecha);
            return [
              fmtFechaISO(l.fecha_cambio), l.llantas_tracto ?? '—', l.llantas_chata ?? '—',
              l.marca || '—', fmtFechaISO(l.proxima_fecha),
              <BadgeMant key="e" texto={estado} />,
              <BotonQuitar key={l.id} onClick={() => quitar(l.id)} />,
            ];
          })}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
        <input type="number" min={0} placeholder="Llantas tracto" value={form.llantas_tracto} onChange={e => setForm({ ...form, llantas_tracto: e.target.value })} className={`${inputCls} text-sm`} />
        <input type="number" min={0} placeholder="Llantas chata" value={form.llantas_chata} onChange={e => setForm({ ...form, llantas_chata: e.target.value })} className={`${inputCls} text-sm`} />
        <input placeholder="Marca de las llantas" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} className={`${inputCls} text-sm`} />
        <input type="date" title="Fecha de cambio" value={form.fecha_cambio} onChange={e => setForm({ ...form, fecha_cambio: e.target.value })} className={`${inputCls} text-sm`} />
        <input type="date" title="Próxima fecha (vacío = +3 meses)" value={form.proxima_fecha} onChange={e => setForm({ ...form, proxima_fecha: e.target.value })} className={`${inputCls} text-sm`} />
        <button type="button" onClick={guardar} disabled={guardando} className="px-3 py-2 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 whitespace-nowrap sm:col-span-2 md:col-span-1">+ Registrar cambio</button>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Si no indicas la próxima fecha, se programa a 3 meses del último cambio.</p>
      {aviso && <p className="mt-2 text-xs text-red-500">{aviso}</p>}
    </>
  );
}

function FormularioAceites({ vehiculoId, onGuardado, registros }) {
  const [form, setForm] = useState({ tipo: 'motor', marca: '', fecha_ultimo_cambio: '', proxima_fecha: '', observacion: '' });
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    setGuardando(true); setAviso('');
    const res = await fetch(`/api/flota/${vehiculoId}/aceites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) { setAviso(data.error || 'No se pudo registrar'); return; }
    setForm({ tipo: form.tipo, marca: '', fecha_ultimo_cambio: '', proxima_fecha: '', observacion: '' });
    await onGuardado();
  }

  async function quitar(itemId) {
    if (!window.confirm('¿Eliminar este registro de aceite?')) return;
    await fetch(`/api/flota/${vehiculoId}/aceites?itemId=${itemId}`, { method: 'DELETE' });
    await onGuardado();
  }

  const TIPO_ESTILO = { motor: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300', caja: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300', corona: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' };

  return (
    <>
      {registros.length === 0 ? (
        <p className="text-xs text-slate-400 mb-2">Sin cambios de aceite registrados.</p>
      ) : (
        <Tabla compacta
          headers={['Aceite', 'Marca', 'Último cambio', 'Próximo', 'Estado', '']}
          filas={registros.map(a => [
            <span key="t" className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${TIPO_ESTILO[a.tipo]}`}>{a.tipo.charAt(0).toUpperCase() + a.tipo.slice(1)}</span>,
            a.marca || '—', fmtFechaISO(a.fecha_ultimo_cambio), fmtFechaISO(a.proxima_fecha),
            <BadgeMant key="e" texto={evaluarProxima(a.proxima_fecha)} />,
            <BotonQuitar key={a.id} onClick={() => quitar(a.id)} />,
          ])}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 mt-3">
        <select value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value })} className={`${inputCls} text-sm`}>
          <option value="motor">Aceite de motor</option>
          <option value="caja">Aceite de caja</option>
          <option value="corona">Aceite de corona</option>
        </select>
        <input placeholder="Marca" value={form.marca} onChange={e => setForm({ ...form, marca: e.target.value })} className={`${inputCls} text-sm`} />
        <input type="date" title="Último cambio" value={form.fecha_ultimo_cambio} onChange={e => setForm({ ...form, fecha_ultimo_cambio: e.target.value })} className={`${inputCls} text-sm`} />
        <input type="date" min={form.fecha_ultimo_cambio || undefined} title="Próximo cambio" value={form.proxima_fecha} onChange={e => setForm({ ...form, proxima_fecha: e.target.value })} className={`${inputCls} text-sm`} />
        <button type="button" onClick={guardar} disabled={guardando} className="px-3 py-2 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 whitespace-nowrap sm:col-span-2 md:col-span-1">+ Registrar aceite</button>
      </div>
      {aviso && <p className="mt-2 text-xs text-red-500">{aviso}</p>}
    </>
  );
}

function FormularioSeguroCarga({ vehiculoId, onGuardado, registros }) {
  const [form, setForm] = useState({ poliza: '', fecha_tramite: '', fecha_inicio: '', fecha_expiracion: '' });
  const [aviso, setAviso] = useState('');
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!form.poliza.trim()) { setAviso('Los datos de la póliza son obligatorios'); return; }
    setGuardando(true); setAviso('');
    const res = await fetch(`/api/flota/${vehiculoId}/seguros-carga`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setGuardando(false);
    if (!res.ok) { setAviso(data.error || 'No se pudo registrar'); return; }
    setForm({ poliza: '', fecha_tramite: '', fecha_inicio: '', fecha_expiracion: '' });
    await onGuardado();
  }

  async function quitar(itemId) {
    if (!window.confirm('¿Eliminar esta póliza de carga?')) return;
    await fetch(`/api/flota/${vehiculoId}/seguros-carga?itemId=${itemId}`, { method: 'DELETE' });
    await onGuardado();
  }

  return (
    <>
      {registros.length === 0 ? (
        <p className="text-xs text-slate-400 mb-2">Sin pólizas de carga registradas.</p>
      ) : (
        <Tabla compacta
          headers={['Póliza', 'Trámite', 'Inicio', 'Expiración', 'Estado', '']}
          filas={registros.map(s => [
            <span key="p" className="font-mono text-xs">{s.poliza}</span>,
            fmtFechaISO(s.fecha_tramite), fmtFechaISO(s.fecha_inicio), fmtFechaISO(s.fecha_expiracion),
            <Badge key="e" texto={s.estado} />,
            <BotonQuitar key={s.id} onClick={() => quitar(s.id)} />,
          ])}
        />
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 mt-3">
        <input placeholder="Póliza / datos *" value={form.poliza} onChange={e => setForm({ ...form, poliza: e.target.value })} className={`${inputCls} text-sm col-span-2 md:col-span-1`} />
        <input type="date" title="Fecha de trámite" value={form.fecha_tramite} onChange={e => setForm({ ...form, fecha_tramite: e.target.value })} className={`${inputCls} text-sm`} />
        <input type="date" title="Inicio" value={form.fecha_inicio} onChange={e => setForm({ ...form, fecha_inicio: e.target.value })} className={`${inputCls} text-sm`} />
        <input type="date" title="Expiración" value={form.fecha_expiracion} onChange={e => setForm({ ...form, fecha_expiracion: e.target.value })} className={`${inputCls} text-sm`} />
        <button type="button" onClick={guardar} disabled={guardando} className="px-3 py-2 rounded-lg text-xs font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60 whitespace-nowrap">+ Registrar póliza</button>
      </div>
      {aviso && <p className="mt-2 text-xs text-red-500">{aviso}</p>}
    </>
  );
}

// ---------- Auxiliares ----------

/**
 * Banner superior: ¿ya es necesario cambiar llantas o aceites?
 * Evalúa la programación más reciente de llantas y la vigente de cada
 * tipo de aceite contra la fecha actual.
 */
function AlertaMantenimiento({ llantas, aceites }) {
  const ultimaLlanta = llantas[0];
  const estadoLlantas = ultimaLlanta ? evaluarProxima(ultimaLlanta.proxima_fecha) : '';

  // Último registro por tipo de aceite
  const ultimoPorTipo = {};
  for (const a of aceites) {
    if (!ultimoPorTipo[a.tipo]) ultimoPorTipo[a.tipo] = a;
  }
  const aceitesCriticos = Object.entries(ultimoPorTipo)
    .map(([tipo, a]) => ({ tipo, fecha: a.proxima_fecha, estado: evaluarProxima(a.proxima_fecha) }))
    .filter(x => x.estado);

  const yaLl = estadoLlantas === 'Cambiar ya';
  const prontoLl = estadoLlantas === 'Por cambiar';
  const yaAc = aceitesCriticos.filter(x => x.estado === 'Cambiar ya');
  const prontoAc = aceitesCriticos.filter(x => x.estado === 'Por cambiar');

  if (!yaLl && !prontoLl && !yaAc.length && !prontoAc.length) return null;

  return (
    <div className="space-y-2 mb-4 no-print">
      {(yaLl || yaAc.length > 0) && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border-2 border-red-400 dark:border-red-800 text-red-700 dark:text-red-300">
          <p className="font-bold mb-1">🚨 ¡Sí, ya es necesario hacer el cambio!</p>
          <ul className="text-sm space-y-0.5 list-disc list-inside">
            {yaLl && (
              <li>
                🛞 <b>Llantas</b> — el cambio estaba programado para el{' '}
                <b>{fmtFechaISO(ultimaLlanta.proxima_fecha)}</b> (fecha vencida).
              </li>
            )}
            {yaAc.map(x => (
              <li key={x.tipo}>
                🛢️ <b>Aceite de {x.tipo}</b> — venció el <b>{fmtFechaISO(x.fecha)}</b>.
              </li>
            ))}
          </ul>
        </div>
      )}
      {(prontoLl || prontoAc.length > 0) && !(yaLl || yaAc.length > 0) && (
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900 text-amber-700 dark:text-amber-300">
          <p className="font-bold mb-1">⏳ Aún no, pero está cerca (menos de 15 días)</p>
          <ul className="text-sm space-y-0.5 list-disc list-inside">
            {prontoLl && (
              <li>🛞 Llantas — cambio programado para el <b>{fmtFechaISO(ultimaLlanta.proxima_fecha)}</b>.</li>
            )}
            {prontoAc.map(x => (
              <li key={x.tipo}>🛢️ Aceite de {x.tipo} — programado para el <b>{fmtFechaISO(x.fecha)}</b>.</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BadgeMant({ texto }) {
  if (!texto) return <span className="text-slate-400 dark:text-slate-500 text-xs">—</span>;
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${ESTADO_MANT_ESTILO[texto]}`}>
      {texto}
    </span>
  );
}

function Seccion({ titulo, subtitulo, icono, children, className = '' }) {
  return (
    <section className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 ${className}`}>
      <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
        <span>{icono}</span>{titulo}
      </h2>
      {subtitulo && <p className="text-xs text-slate-400 mb-3 mt-0.5">{subtitulo}</p>}
      {children}
    </section>
  );
}

function Tabla({ headers, filas, compacta = false }) {
  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <table className={`w-full border-collapse ${compacta ? 'text-xs sm:text-sm' : 'text-sm'}`}>
        <thead>
          <tr className="bg-slate-50 dark:bg-slate-800/60 border-y border-slate-200 dark:border-slate-800 text-left">
            {headers.map((h, i) => (
              <th key={i} className={`${compacta ? 'px-2 py-1.5 sm:px-2.5 sm:py-2' : 'px-4 py-2.5'} text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase whitespace-nowrap`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, i) => (
            <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
              {fila.map((celda, j) => (
                <td key={j} className={`${compacta ? 'px-2 py-1.5 sm:px-2.5 sm:py-2' : 'px-4 py-2.5'} text-slate-700 dark:text-slate-300 whitespace-nowrap`}>{celda}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ texto }) {
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ESTADO_ESTILO[texto] || 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'}`}>
      {texto || 'Sin fecha'}
    </span>
  );
}

function BotonQuitar({ onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-red-400 hover:text-red-600 text-xs font-medium">Quitar</button>
  );
}

function Campo({ label, valor, full = false }) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm text-slate-800 dark:text-slate-200 break-words">{valor ?? '—'}</p>
    </div>
  );
}

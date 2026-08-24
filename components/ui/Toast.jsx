'use client';

import { useEffect, useState } from 'react';

/**
 * Toast — notificación temporal auto-dismiss.
 *
 * Props:
 *   mensaje  – texto a mostrar
 *   tipo     – 'exito' | 'error' | 'info' (default: 'info')
 *   duracion – milisegundos antes de desaparecer (default: 3500)
 *   onClose  – callback al cerrarse
 */

const TIPOS = {
  exito: 'bg-emerald-600 text-white',
  error: 'bg-red-600 text-white',
  info:  'bg-slate-800 text-white',
};

const ICONOS = {
  exito: '✅',
  error: '❌',
  info:  'ℹ️',
};

export default function Toast({ mensaje, tipo = 'info', duracion = 3500, onClose }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      if (onClose) onClose();
    }, duracion);
    return () => clearTimeout(timer);
  }, [duracion, onClose]);

  if (!visible || !mensaje) return null;

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all animate-slide-up ${TIPOS[tipo] || TIPOS.info}`}>
      <span>{ICONOS[tipo] || ICONOS.info}</span>
      <span>{mensaje}</span>
      <button onClick={() => { setVisible(false); if (onClose) onClose(); }}
        className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none"
        aria-label="Cerrar notificación"
      >
        ×
      </button>
    </div>
  );
}

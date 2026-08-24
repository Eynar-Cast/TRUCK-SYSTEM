'use client';

import { useRef, useState } from 'react';

/**
 * UploadZone — zona de subida de imágenes con validación de 5 MB.
 *
 * Sube la imagen directamente al navegador hacia Vercel Blob y guarda
 * solo la URL resultante (mucho más liviano que base64 en Postgres).
 *
 * Props:
 *   label      – texto del label (ej. "Foto de factura")
 *   value      – URL actual de la imagen (string o null)
 *   onChange   – callback(url) al terminar de subir una imagen válida
 *   maxMB      – tamaño máximo en MB (default: 4, límite seguro para subir vía servidor)
 */

const MAX_DEFAULT = 4;

export default function UploadZone({ label, value, onChange, maxMB = MAX_DEFAULT }) {
  const inputRef = useRef(null);
  const [error, setError] = useState('');
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  async function procesarArchivo(file) {
    if (!file) return;
    setError('');

    if (!file.type.startsWith('image/')) {
      setError('Solo se permiten archivos de imagen');
      return;
    }

    const maxBytes = maxMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setError(`El archivo excede el límite de ${maxMB} MB`);
      return;
    }

    setSubiendo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo subir la imagen');
      onChange(data.url);
    } catch (err) {
      setError(err.message || 'No se pudo subir la imagen. Intenta de nuevo.');
    }
    setSubiendo(false);
  }

  function handleFileChange(e) {
    procesarArchivo(e.target.files[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setArrastrando(false);
    const file = e.dataTransfer.files[0];
    procesarArchivo(file);
  }

  function handleDragOver(e) {
    e.preventDefault();
    setArrastrando(true);
  }

  function handleDragLeave() {
    setArrastrando(false);
  }

  function handleRemove() {
    onChange(null);
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{label}</label>}

      {!value ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !subiendo && inputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
            ${subiendo ? 'opacity-60 cursor-wait' : ''}
            ${arrastrando
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
              : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
            }`}
        >
          {subiendo ? (
            <>
              <div className="text-3xl mb-2">⏳</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">Subiendo imagen...</p>
            </>
          ) : (
            <>
              <div className="text-3xl mb-2">📷</div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Arrastra una imagen aquí o <span className="text-blue-600 dark:text-blue-400 font-medium">haz clic para seleccionar</span>
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Máx. {maxMB} MB — JPG, PNG, WEBP</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            disabled={subiendo}
          />
        </div>
      ) : (
        <div className="relative inline-block">
          <img
            src={value}
            alt={label || 'Imagen subida'}
            className="max-h-44 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-md transition"
            aria-label="Eliminar imagen"
          >
            ×
          </button>
        </div>
      )}

      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
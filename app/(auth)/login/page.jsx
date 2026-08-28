'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const avisoSesion = searchParams.get('motivo') === 'sesion';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión');
        setCargando(false);
        return;
      }

      // Login correcto: redirige según el rol
      router.push(data.role === 'admin' ? '/historial' : '/nueva-compra');
      router.refresh();
    } catch (err) {
      setError('No se pudo conectar con el servidor');
      setCargando(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-slate-900">
      {/* Fondo imagen */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/imagenes/login.jpg')" }}
      />
      {/* Overlay con gradiente para contraste */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900/40 via-slate-900/30 to-indigo-900/30" />

      {/* Tarjeta de vidrio (glassmorphism) */}
      <div className="relative z-10 w-full max-w-sm rounded-[1.5rem] p-8 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.4)] border border-white/20 bg-white/[0.12] backdrop-blur-2xl ring-1 ring-white/10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-600/25 ring-1 ring-white/20">
            🏭
          </div>
          <h1 className="text-xl font-bold text-white drop-shadow tracking-tight">GestorCompras</h1>
          <p className="text-white/70 text-sm mt-1 font-medium">Sistema de Registro de Compras</p>
        </div>

        {avisoSesion && !error && (
          <div className="mb-4 p-3 rounded-lg bg-amber-500/20 border border-amber-300/30 text-amber-100 text-sm backdrop-blur">
            Tu sesión se cerró porque se inició sesión con esta cuenta desde otro dispositivo.
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/20 border border-red-300/30 text-red-100 text-sm backdrop-blur">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Usuario
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl outline-none bg-white/[0.12] border border-white/20 text-white placeholder-white/50 focus:bg-white/[0.18] focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all shadow-inner"
              placeholder="Ingresa tu usuario"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl outline-none bg-white/[0.12] border border-white/20 text-white placeholder-white/50 focus:bg-white/[0.18] focus:border-white/40 focus:ring-2 focus:ring-white/20 transition-all shadow-inner"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={cargando}
            className="w-full bg-white text-slate-900 hover:bg-white/90 disabled:opacity-60 font-semibold py-2.5 rounded-xl transition-all shadow-lg shadow-black/10 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
          >
            {cargando ? 'Ingresando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
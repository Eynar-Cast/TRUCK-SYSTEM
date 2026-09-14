'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function hashSimple(s){
  let h=0; for(let i=0;i<s.length;i++) h=((h<<5)-h+s.charCodeAt(i))|0; return String(h);
}

export default function DevMantenimientoPage(){
  const router = useRouter();
  const [step, setStep] = useState('checking'); // checking | login | token | blocked
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [ipInfo, setIpInfo] = useState(null);

  useEffect(()=>{
    async function checkIp(){
      try{
        const res = await fetch('/api/dev/ip');
        const d = await res.json();
        setIpInfo(d);
        if(d.allowed && d.ip !== d.allowed){
          // IP no coincide
          const sess = await fetch('/api/auth/session').then(r=>r.json()).catch(()=>({}));
          if(!sess || !sess.id){
            router.push('/login');
          } else {
            setStep('blocked');
          }
          return;
        }
        if(!d.allowed){
          // Primera vez: permite vincular
          setStep('login');
          return;
        }
        setStep('login');
      }catch{
        setStep('login');
      }
    }
    checkIp();
  },[router]);

  async function handleLogin(e){
    e.preventDefault(); setError('');
    const combinado = `${user.trim()}:${pass.trim()}`;
    const esperado = hashSimple('eynar_dev:69880053*Eynar');
    if(hashSimple(combinado) !== esperado){
      setError('Credenciales dev incorrectas');
      return;
    }
    // Si IP aún no vinculada, vincular esta IP
    if(ipInfo && !ipInfo.allowed){
      try{
        await fetch('/api/dev/ip',{method:'POST',headers:{'Content-Type':'application/json','x-dev-key':'1b2daf31e10b9271c13c10283e03be14'},body:JSON.stringify({ip: ipInfo.ip})});
      }catch{}
    }
    setStep('token');
  }

  async function handleToken(e){
    e.preventDefault(); setError(''); setMsg('');
    if(!token.trim()){ setError('Pega el token MTTO-...'); return; }
    setLoading(true);
    try{
      const res = await fetch('/api/dev/mantenimiento',{
        method:'POST',
        headers:{'Content-Type':'application/json','x-dev-key':'1b2daf31e10b9271c13c10283e03be14'},
        body: JSON.stringify({token: token.trim()})
      });
      const d = await res.json();
      if(!res.ok) throw new Error(d.error || 'Error');
      setMsg(d.mensaje || 'Mantenimiento validado — contador reiniciado');
      setToken('');
    }catch(err){ setError(err.message); }
    setLoading(false);
  }

  if(step==='checking'){
    return <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white text-sm">Verificando IP...</div>;
  }
  if(step==='blocked'){
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white rounded-xl p-6 max-w-md text-center">
          <h1 className="font-bold">Acceso denegado</h1>
          <p className="text-sm text-slate-500 mt-1">Tu IP ({ipInfo?.ip}) no está autorizada para este panel.</p>
          <p className="text-xs text-slate-400 mt-2">Contacta al desarrollador 69880053</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl">
        <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">🔧 Mantenimiento Dev</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400">Solo desarrollador EYNAR — 69880053 • IP: {ipInfo?.ip} {ipInfo?.allowed ? `(permitida: ${ipInfo.allowed})` : '(sin vincular)'}</p>
        {step==='login' ? (
          <form onSubmit={handleLogin} className="mt-4 space-y-3">
            <input value={user} onChange={e=>setUser(e.target.value)} placeholder="Usuario dev" className="w-full px-3 py-2 border rounded-lg text-sm" />
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="Contraseña dev" className="w-full px-3 py-2 border rounded-lg text-sm" />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button type="submit" className="w-full bg-slate-900 text-white py-2 rounded-lg text-sm font-bold">Entrar</button>
            <p className="text-[11px] text-slate-400 text-center">Credenciales no están en BD, solo en código hasheado. IP vinculada: {ipInfo?.allowed || 'ninguna (se vinculará esta)'}</p>
          </form>
        ) : (
          <form onSubmit={handleToken} className="mt-4 space-y-3">
            <input value={token} onChange={e=>setToken(e.target.value)} placeholder="Pega token MTTO-..." className="w-full px-3 py-2 border rounded-lg text-sm font-mono" />
            <div className="flex gap-2">
              <button type="button" onClick={()=>setStep('login')} className="flex-1 bg-slate-200 py-2 rounded-lg text-sm">← Volver</button>
              <button type="submit" disabled={loading} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-bold disabled:opacity-50">{loading?'Validando...':'Validar token'}</button>
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            {msg && <p className="text-xs text-green-600">{msg}</p>}
            <p className="text-[11px] text-slate-400">Token 1 uso, 72h. Genera con: <code>node scripts/gen-token-mantenimiento.js</code></p>
          </form>
        )}
      </div>
    </div>
  );
}

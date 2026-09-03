import { redirect } from 'next/navigation';
import { obtenerSesion } from '@/lib/session';

export default async function Home() {
  const sesion = await obtenerSesion();

  if (!sesion) {
    redirect('/login');
  }

  if (sesion.role === 'admin') redirect('/historial');
  if (sesion.role === 'secretaria') redirect('/flota');
  redirect('/nueva-compra');
}
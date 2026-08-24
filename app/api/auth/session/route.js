import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/session';

export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  return NextResponse.json({ user: sesion });
}
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/session';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (límite seguro por debajo del máximo de la función)

export async function POST(request) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('file');

  if (!file) {
    return NextResponse.json({ error: 'No se recibió ningún archivo' }, { status: 400 });
  }
  if (!file.type || !file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Solo se permiten archivos de imagen' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'El archivo excede el límite de 4 MB' }, { status: 400 });
  }

  try {
    const blob = await put(file.name, file, {
      access: 'public',
      addRandomSuffix: true,
    });
    return NextResponse.json(blob);
  } catch (error) {
    console.error('Error subiendo a Blob:', error);
    return NextResponse.json({ error: 'No se pudo subir la imagen' }, { status: 500 });
  }
}
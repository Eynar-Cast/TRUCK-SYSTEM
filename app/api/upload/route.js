import { NextResponse } from 'next/server';
import { obtenerSesion } from '@/lib/session';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

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
    // Guardar en Neon como base64 data URL (TEXT) — se almacena directo en foto_factura/foto_qr etc.
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');
    const dataUrl = `data:${file.type};base64,${base64}`;
    // Respuesta compatible con el cliente anterior que esperaba blob.url
    return NextResponse.json({
      url: dataUrl,
      downloadUrl: dataUrl,
      pathname: file.name,
      contentType: file.type,
      contentDisposition: `inline; filename="${file.name}"`,
    });
  } catch (error) {
    console.error('Error guardando imagen en Neon:', error);
    return NextResponse.json({ error: 'No se pudo guardar la imagen' }, { status: 500 });
  }
}
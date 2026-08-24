'use client';

import Badge from '@/components/ui/Badge';
import { fmt, fmtDate } from '@/lib/utils';

/**
 * TablaCompras — tabla reutilizable para listar compras.
 *
 * Se usa tanto en "Mis Compras" (usuario) como en "Historial global" (admin).
 *
 * Props:
 *   compras       – array de objetos compra
 *   onVerDetalle  – callback(compra) al hacer clic en una fila
 *   mostrarUsuario – boolean: si true, muestra columna de nombre de usuario (vista admin)
 */

export default function TablaCompras({ compras = [], onVerDetalle, mostrarUsuario = false }) {
  if (compras.length === 0) {
    return (
      <div className="text-center py-12 text-slate-400">
        <div className="text-4xl mb-2">📭</div>
        <p className="text-sm">No hay compras registradas en este período</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-3 px-3 font-medium">Producto</th>
            <th className="py-3 px-3 font-medium">Precio</th>
            {mostrarUsuario && <th className="py-3 px-3 font-medium">Usuario</th>}
            <th className="py-3 px-3 font-medium">Factura</th>
            <th className="py-3 px-3 font-medium">Pago</th>
            <th className="py-3 px-3 font-medium">Estado</th>
            <th className="py-3 px-3 font-medium">Fecha</th>
            <th className="py-3 px-3 font-medium">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {compras.map((c) => (
            <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="py-3 px-3 font-medium text-slate-800">{c.producto}</td>
              <td className="py-3 px-3 text-slate-700">{fmt(c.precio)}</td>
              {mostrarUsuario && <td className="py-3 px-3 text-slate-600">{c.usuario_nombre || '—'}</td>}
              <td className="py-3 px-3">
                <Badge tipo={c.tiene_factura ? 'factura' : 'sin_factura'} />
              </td>
              <td className="py-3 px-3">
                <Badge tipo={c.tipo_pago} />
              </td>
              <td className="py-3 px-3">
                {c.devuelto ? <Badge tipo="devuelto" /> : <span className="text-slate-400 text-xs">—</span>}
              </td>
              <td className="py-3 px-3 text-slate-500 text-xs">{fmtDate(c.fecha)}</td>
              <td className="py-3 px-3">
                <button
                  onClick={() => onVerDetalle && onVerDetalle(c)}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium hover:underline transition"
                >
                  Ver →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

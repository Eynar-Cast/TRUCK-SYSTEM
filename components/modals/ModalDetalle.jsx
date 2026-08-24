'use client';

import Badge from '@/components/ui/Badge';
import { fmt, fmtDate } from '@/lib/utils';

/**
 * ModalDetalle — modal superpuesto con la información completa de una compra.
 *
 * Muestra:
 *   - Datos de la compra (producto, precio, descripción, factura, pago)
 *   - Imágenes de factura y/o comprobante QR en alta resolución
 *   - Si la compra fue devuelta: información de la devolución (motivo, tipo, comprobante)
 *
 * Props:
 *   compra   – objeto compra (incluye datos de devolución si existe)
 *   onClose  – callback para cerrar el modal
 */

export default function ModalDetalle({ compra, onClose }) {
  if (!compra) return null;

  // Prevenir que el clic dentro del modal cierre el overlay
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="text-lg font-bold text-slate-900">Detalle de compra</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none transition"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Cuerpo */}
        <div className="p-5 space-y-4">
          {/* Info principal */}
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Producto" valor={compra.producto} />
            <Campo label="Precio" valor={fmt(compra.precio)} />
            <Campo label="Fecha" valor={fmtDate(compra.fecha)} />
            <Campo label="Tipo de pago">
              <Badge tipo={compra.tipo_pago} />
            </Campo>
          </div>

          {compra.descripcion && (
            <Campo label="Descripción" valor={compra.descripcion} />
          )}

          {/* Factura */}
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-slate-700">Factura:</span>
              <Badge tipo={compra.tiene_factura ? 'factura' : 'sin_factura'} />
            </div>
            {compra.tiene_factura && compra.foto_factura && (
              <img
                src={compra.foto_factura}
                alt="Foto de factura"
                className="rounded-lg border border-slate-200 max-h-60 w-auto shadow-sm"
              />
            )}
          </div>

          {/* Comprobante QR */}
          {compra.tipo_pago === 'qr' && compra.foto_qr && (
            <div className="border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Comprobante QR:</p>
              <img
                src={compra.foto_qr}
                alt="Comprobante de pago QR"
                className="rounded-lg border border-slate-200 max-h-60 w-auto shadow-sm"
              />
            </div>
          )}

          {/* Estado de devolución */}
          {compra.devuelto && (
            <div className="border-t border-slate-100 pt-4 bg-amber-50 -mx-5 px-5 py-4 rounded-b-xl">
              <div className="flex items-center gap-2 mb-3">
                <Badge tipo="devuelto" />
                <span className="text-sm font-medium text-amber-800">Compra devuelta</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Campo label="Motivo" valor={compra.devolucion_motivo || compra.motivo} small />
                <Campo label="Tipo de reembolso" small>
                  <Badge tipo={compra.devolucion_tipo_pago === 'transferencia' ? 'qr' : 'fisico'}
                    label={compra.devolucion_tipo_pago === 'transferencia' ? 'Transferencia' : 'Efectivo'} />
                </Campo>
                <Campo label="Fecha devolución"
                  valor={fmtDate(compra.devolucion_fecha || compra.fecha_devolucion)} small />
              </div>
              {(compra.devolucion_comprobante || compra.comprobante_devolucion) && (
                <div className="mt-3">
                  <p className="text-xs font-medium text-amber-700 mb-1">Comprobante de devolución:</p>
                  <img
                    src={compra.devolucion_comprobante || compra.comprobante_devolucion}
                    alt="Comprobante de devolución"
                    className="rounded-lg border border-amber-200 max-h-48 w-auto shadow-sm"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Campo auxiliar para mostrar un par label/valor en el modal.
 */
function Campo({ label, valor, children, small = false }) {
  return (
    <div>
      <p className={`font-medium text-slate-500 mb-0.5 ${small ? 'text-xs' : 'text-xs'}`}>{label}</p>
      {children || <p className={`text-slate-800 ${small ? 'text-sm' : 'text-sm'}`}>{valor || '—'}</p>}
    </div>
  );
}

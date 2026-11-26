import React from 'react';
import { FileText, Download } from 'lucide-react';
import Modal from './Modal';
import { exportContratoPDF } from '../utils/exportContrato';
import { formatCOP, formatDate } from '../utils/helpers';

export default function ModalVerContrato({ contrato, onClose }) {
  if (!contrato) return null;

  const rows = [
    ['Código de Lote', contrato.id_lote],
    ['Ubicación', `Etapa ${contrato.etapa || '-'} · Manzana ${contrato.manzana || '-'} · Lote ${contrato.lote_num || '-'} (${contrato.area_m2 || 160} m²)`],
    ['Promitente Vendedor', 'JOHN ALBERTO BOHORQUEZ ROJAS (CC 1.122.128.330)'],
    ['Promitente Comprador', `${contrato.cliente_nombre || '—'} (${contrato.cliente_doc || '—'})`],
    ...(contrato.cotitular_nombre ? [['Cotitular', `${contrato.cotitular_nombre} (${contrato.cotitular_doc || '—'})`]] : []),
    ['Fecha de Contrato', formatDate(contrato.fecha_venta)],
    ['Precio Total del Lote', formatCOP(contrato.precio_venta)],
    ...(Number(contrato.arras_previas) > 0 ? [['Arras Previas Descontadas', `${formatCOP(contrato.arras_previas)}${contrato.recibo_arras ? ` (Recibo #${contrato.recibo_arras})` : ''}`]] : []),
    ['Cuota Inicial Total', formatCOP(contrato.valor_cuota_inicial)],
    ['Saldo Financiado', formatCOP(contrato.saldo_financiado)],
    ['Plan de Cuotas', contrato.plazo_cuotas > 0 ? `${contrato.plazo_cuotas} cuotas mensuales de ${formatCOP(contrato.valor_cuota)} (días ${contrato.dias_pago} de cada mes)` : 'Pago de contado'],
    ['Cédula Catastral', contrato.cedula_catastral || '00-00-00-00-0017-0183-0-00-00-0000'],
    ['Matrícula Inmobiliaria', contrato.matricula_inmobiliaria || '232-62531'],
    ['Asesor / Vendedor', contrato.vendedor_nombre || 'DIRECTO'],
    ...(contrato.observaciones ? [['Observaciones', contrato.observaciones]] : []),
  ];

  return (
    <Modal title={`Contrato de Compraventa — ${contrato.id_lote}`} onClose={onClose} width="680px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{
          border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--bg-card)'
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
            <tbody>
              {rows.map(([label, val], idx) => (
                <tr key={label} style={{ background: idx % 2 === 0 ? 'transparent' : 'var(--bg-base)' }}>
                  <td style={{ padding: '9px 12px', fontWeight: 700, color: 'var(--text-muted)', width: '36%', borderBottom: '1px solid var(--border)' }}>
                    {label}
                  </td>
                  <td style={{ padding: '9px 12px', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>
                    {val}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button
            type="button"
            className="btn btn-primary"
            style={{ background: '#2563eb', borderColor: '#2563eb', gap: 6 }}
            onClick={() => exportContratoPDF(contrato)}
          >
            <Download size={14} /> Descargar Contrato (PDF)
          </button>
        </div>
      </div>
    </Modal>
  );
}

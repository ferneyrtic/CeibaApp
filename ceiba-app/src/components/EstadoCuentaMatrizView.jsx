import React, { useState } from 'react';
import { formatCOP } from '../utils/helpers';
import {
  exportEstadoCuentaMatrizPDF,
  exportEstadoCuentaMatrizExcel,
  exportEstadoCuentaInformePDF,
  resolveCuotaDisplay
} from '../utils/exportEstadoCuenta';
import { guardarObservacionCuota } from '../lib/api/abonosApi';
import { Download, FileSpreadsheet, FileText, Edit2, Save, X, MessageSquare } from 'lucide-react';


export default function EstadoCuentaMatrizView({ venta, cuotas = [] }) {
  if (!venta) return null;

  const loteId = venta.lotes?.id_lote || venta.id_lote || '—';
  const docCliente = venta.clientes?.doc_cliente || '—';
  const nombreCliente = venta.clientes?.nombre || '—';
  const cuotaInicial = venta.valor_cuota_inicial ?? 0;
  const saldoFinanciado = venta.saldo_financiado ?? 0;
  const plazoTotal = venta.plazo_cuotas || cuotas.length || 0;
  const plazo = plazoTotal ? `${plazoTotal}` : '—';
  const valorCuota = venta.valor_cuota ?? 0;

  // Suma exacta de cuotas pagadas (idéntico a la celda G27 del formato de la secretaria)
  const totalCuotasPagadas = cuotas
    .filter(c => c.estado_cuota === 'PAGA' || (c.valor_pagado && c.valor_pagado > 0))
    .reduce((acc, c) => acc + (Number(c.valor_pagado) || 0), 0);

  // Saldo pendiente exacto (Saldo Financiado - Cuotas Pagadas, idéntico a celda K27)
  const saldoActual = saldoFinanciado > 0
    ? Math.max(0, saldoFinanciado - totalCuotasPagadas)
    : Math.max(0, (venta.precio_venta ?? 0) - cuotaInicial - totalCuotasPagadas);

  const totalPrecio = venta.precio_venta ?? 0;
  const totalPagado = totalCuotasPagadas;
  const totalRecaudadoGlobal = cuotaInicial + totalCuotasPagadas;

  // Matriz de 12 filas con 3 bloques
  const rows = [];
  for (let r = 0; r < 12; r++) {
    const c1 = cuotas.find(c => c.numero_cuota === r + 1);
    const d1 = resolveCuotaDisplay(c1, r + 1, plazoTotal);

    const c2 = cuotas.find(c => c.numero_cuota === r + 13);
    const d2 = resolveCuotaDisplay(c2, r + 13, plazoTotal);

    const c3 = cuotas.find(c => c.numero_cuota === r + 25);
    const d3 = resolveCuotaDisplay(c3, r + 25, plazoTotal);

    rows.push({ r: r + 1, c1, c2, c3, d1, d2, d3 });
  }

  // ── Inline observation editor ───────────────────────────────────────────────
  function ObsCell({ cuota }) {
    const [editing, setEditing] = useState(false);
    const [texto, setTexto] = useState(cuota?.observacion || '');
    const [saving, setSaving] = useState(false);

    if (!cuota) return <td style={{ padding: '3px', border: '1px solid #e2e8f0', background: '#fafafa' }} />;

    if (!editing) {
      return (
        <td style={{ padding: '3px 5px', border: '1px solid #e2e8f0', maxWidth: 120 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 22 }}>
            {texto ? (
              <span style={{ fontSize: 9, color: '#475569', flexGrow: 1, lineHeight: 1.3, wordBreak: 'break-word' }}
                title={texto}>
                <MessageSquare size={9} style={{ display: 'inline', marginRight: 2, color: '#3b82f6' }} />
                {texto.length > 40 ? texto.slice(0, 40) + '…' : texto}
              </span>
            ) : (
              <span style={{ fontSize: 9, color: '#cbd5e1', flexGrow: 1 }}>—</span>
            )}
            <button
              onClick={() => setEditing(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 1, color: '#94a3b8', flexShrink: 0 }}
              title="Editar observación"
            >
              <Edit2 size={9} />
            </button>
          </div>
        </td>
      );
    }

    const handleSave = async () => {
      setSaving(true);
      try {
        await guardarObservacionCuota(cuota.id, texto.trim() || null);
        // Update local cuota object so it reflects immediately
        cuota.observacion = texto.trim() || null;
        setEditing(false);
      } catch {
        // Keep editing open on error
      } finally {
        setSaving(false);
      }
    };

    return (
      <td style={{ padding: '3px 5px', border: '1px solid #3b82f6', background: '#eff6ff', maxWidth: 150 }}>
        <textarea
          value={texto}
          onChange={e => setTexto(e.target.value)}
          rows={2}
          style={{ width: '100%', fontSize: 9, border: 'none', background: 'transparent', resize: 'vertical', fontFamily: 'inherit', outline: 'none' }}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
          <button onClick={() => { setEditing(false); setTexto(cuota?.observacion || ''); }}
            style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontSize: 9 }}
            disabled={saving}>
            <X size={8} />
          </button>
          <button onClick={handleSave}
            style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '1px 5px', cursor: 'pointer', fontSize: 9, display: 'flex', alignItems: 'center', gap: 2 }}
            disabled={saving}>
            <Save size={8} /> {saving ? '…' : 'OK'}
          </button>
        </div>
      </td>
    );
  }



  const renderBadge = (d) => {
    if (d.isExceeded || d.estado === '—') {
      return <span style={{ color: '#cbd5e1' }}>—</span>;
    }
    if (d.estado === 'PAGA') {
      return (
        <span style={{
          background: '#dcfce7', color: '#16a34a', fontWeight: 700,
          padding: '2px 6px', borderRadius: 4, fontSize: 9
        }}>
          PAGA
        </span>
      );
    }
    if (d.estado === 'VENCIDA') {
      return (
        <span style={{
          background: '#fee2e2', color: '#dc2626', fontWeight: 700,
          padding: '2px 6px', borderRadius: 4, fontSize: 9
        }}>
          VENCIDA
        </span>
      );
    }
    if (d.estado === 'POR VENCER') {
      return (
        <span style={{
          background: '#fef3c7', color: '#d97706', fontWeight: 700,
          padding: '2px 6px', borderRadius: 4, fontSize: 9
        }}>
          POR VENCER
        </span>
      );
    }
    if (d.estado === 'AL DÍA') {
      return (
        <span style={{
          background: '#dbeafe', color: '#2563eb', fontWeight: 600,
          padding: '2px 6px', borderRadius: 4, fontSize: 9
        }}>
          AL DÍA
        </span>
      );
    }
    // PROGRAMADA / FUTURA
    return (
      <span style={{ color: '#94a3b8', fontSize: 9, fontWeight: 500 }}>
        PROGRAMADA
      </span>
    );
  };

  const renderFecha = (d) => {
    if (d.isExceeded || d.estado === '—') return <span style={{ color: '#cbd5e1' }}>—</span>;
    if (d.estado === 'PAGA') {
      return (
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 700, color: '#15803d', fontSize: 10 }}>
            {d.fechaPago ? d.fechaPago : d.fecha}
          </div>
          {d.fechaVenc && d.fechaPago && d.fechaVenc !== d.fechaPago && (
            <div style={{ fontSize: 8, color: '#64748b' }}>
              Venc: {d.fechaVenc}
            </div>
          )}
        </div>
      );
    }
    return <span>{d.fechaVenc || d.fecha}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Botones de acción / exportación */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Plazo total: <strong>{plazo} cuotas</strong> · Pagadas: <strong style={{ color: '#16a34a' }}>{cuotas.filter(c => c.estado_cuota === 'PAGA').length}</strong>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: 12, gap: 6, background: '#4d8e3b', borderColor: '#4d8e3b' }}
            onClick={() => exportEstadoCuentaMatrizPDF(venta, cuotas)}
          >
            <Download size={13} />
            Descargar Formato Matriz (PDF)
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, gap: 6, border: '1px solid #4d8e3b', color: '#4d8e3b' }}
            onClick={() => exportEstadoCuentaMatrizExcel(venta, cuotas)}
          >
            <FileSpreadsheet size={13} />
            Exportar a Excel (.xlsx)
          </button>
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, gap: 6 }}
            onClick={() => exportEstadoCuentaInformePDF(venta, cuotas)}
          >
            <FileText size={13} />
            Descargar Informe Ejecutivo (PDF)
          </button>
        </div>
      </div>

      {/* CONTENEDOR ESTILO EXCEL (Limpio y profesional) */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 8,
        padding: 16,
        overflowX: 'auto',
        fontFamily: 'Inter, -apple-system, sans-serif'
      }}>
        {/* Encabezado con Logo Oficial */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: 16, minHeight: 48 }}>
          <img
            src="/logo.png"
            alt="Logo La Ceiba"
            style={{ height: 46, position: 'absolute', left: 4, top: 0, objectFit: 'contain' }}
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', letterSpacing: '0.5px' }}>
              LA CEIBA GROUP — PROYECTO CAMPESTRE
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', marginTop: 2 }}>
              ESTADO DE CUENTA CLIENTES
            </div>
          </div>
        </div>

        {/* Tabla 1: Información General */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 14, fontSize: 11 }}>
          <thead>
            <tr style={{ background: '#4d8e3b', color: '#ffffff', textAlign: 'center', fontSize: 10, fontWeight: 700 }}>
              <th style={{ padding: '6px 8px', border: '1px solid #3d732f' }}>ID LOTE</th>
              <th style={{ padding: '6px 8px', border: '1px solid #3d732f' }}># DOC CLIENTE</th>
              <th style={{ padding: '6px 8px', border: '1px solid #3d732f' }}>NOMBRE Y APELLIDOS</th>
              <th style={{ padding: '6px 8px', border: '1px solid #3d732f' }}>VALOR CUOTA INICIAL</th>
              <th style={{ padding: '6px 8px', border: '1px solid #3d732f' }}>SALDO FINANCIADO</th>
              <th style={{ padding: '6px 8px', border: '1px solid #3d732f' }}>PLAZO/CUOTAS</th>
              <th style={{ padding: '6px 8px', border: '1px solid #3d732f' }}>VALOR CUOTA</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ textAlign: 'center', background: '#f8fafc', color: '#1e293b', fontWeight: 600 }}>
              <td style={{ padding: '7px 8px', border: '1px solid #cbd5e1', fontFamily: 'monospace' }}>{loteId}</td>
              <td style={{ padding: '7px 8px', border: '1px solid #cbd5e1' }}>{docCliente}</td>
              <td style={{ padding: '7px 8px', border: '1px solid #cbd5e1', textAlign: 'left' }}>{nombreCliente}</td>
              <td style={{ padding: '7px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatCOP(cuotaInicial)}</td>
              <td style={{ padding: '7px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatCOP(saldoFinanciado)}</td>
              <td style={{ padding: '7px 8px', border: '1px solid #cbd5e1' }}>{plazo}</td>
              <td style={{ padding: '7px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>{formatCOP(valorCuota)}</td>
            </tr>
          </tbody>
        </table>

        {/* Banner ESTADO DE CUOTAS */}
        <div style={{
          background: '#4d8e3b',
          color: '#ffffff',
          fontWeight: 800,
          fontSize: 10.5,
          textAlign: 'center',
          padding: '5px',
          border: '1px solid #3d732f',
          borderBottom: 'none'
        }}>
          ESTADO DE CUOTAS
        </div>

        {/* Tabla 2: Matriz 3 Columnas (Cuotas 1-12, 13-24, 25-36) */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ background: '#f1f5f9', color: '#334155', fontSize: 9, textAlign: 'center', fontWeight: 700 }}>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}># DE CUOTA</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>FECHA PAGO / VENC.</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>ESTADO CUOTA</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>VALOR</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1', background: '#eff6ff', color: '#1d4ed8' }}>OBSERVACIÓN ✏️</th>

              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}># DE CUOTA</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>FECHA PAGO / VENC.</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>ESTADO CUOTA</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>VALOR</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1', background: '#eff6ff', color: '#1d4ed8' }}>OBSERVACIÓN ✏️</th>

              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1', borderLeft: '2px solid #94a3b8' }}># DE CUOTA</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>FECHA PAGO / VENC.</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>ESTADO CUOTA</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1' }}>VALOR</th>
              <th style={{ padding: '4px 6px', border: '1px solid #cbd5e1', background: '#eff6ff', color: '#1d4ed8' }}>OBSERVACIÓN ✏️</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, c1, c2, c3, d1, d2, d3 }) => (
              <tr key={r} style={{ textAlign: 'center' }}>
                {/* Bloque 1 */}
                <td style={{ padding: '4px', border: '1px solid #e2e8f0', fontWeight: 600, background: d1.isExceeded ? '#fafafa' : '#f8fafc' }}>
                  {d1.num}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                  {renderFecha(d1)}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                  {renderBadge(d1)}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0', textAlign: 'right', color: d1.isExceeded ? '#cbd5e1' : undefined }}>
                  {d1.valor}
                </td>
                <ObsCell cuota={c1} />

                {/* Bloque 2 */}
                <td style={{ padding: '4px', border: '1px solid #e2e8f0', fontWeight: 600, background: d2.isExceeded ? '#fafafa' : '#f8fafc', borderLeft: '2px solid #cbd5e1' }}>
                  {d2.num}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                  {renderFecha(d2)}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                  {renderBadge(d2)}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0', textAlign: 'right', color: d2.isExceeded ? '#cbd5e1' : undefined }}>
                  {d2.valor}
                </td>
                <ObsCell cuota={c2} />

                {/* Bloque 3 */}
                <td style={{ padding: '4px', border: '1px solid #e2e8f0', fontWeight: 600, background: d3.isExceeded ? '#fafafa' : '#f8fafc', borderLeft: '2px solid #cbd5e1' }}>
                  {d3.num}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                  {renderFecha(d3)}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0' }}>
                  {renderBadge(d3)}
                </td>
                <td style={{ padding: '4px', border: '1px solid #e2e8f0', textAlign: 'right', color: d3.isExceeded ? '#cbd5e1' : undefined }}>
                  {d3.valor}
                </td>
                <ObsCell cuota={c3} />
              </tr>
            ))}
          </tbody>
        </table>


        {/* Tabla 3: Cuadro Inferior Total Pagado y Saldo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 14 }}>
          <table style={{ width: '360px', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#4d8e3b', color: '#ffffff', textAlign: 'center', fontSize: 10, fontWeight: 700 }}>
                <th style={{ padding: '6px', border: '1px solid #3d732f' }}>TOTAL PAGADO</th>
                <th style={{ padding: '6px', border: '1px solid #3d732f' }}>SALDO PENDIENTE</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ textAlign: 'center', fontWeight: 800, background: '#f8fafc', fontSize: 12 }}>
                <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: '#16a34a' }}>{formatCOP(totalPagado)}</td>
                <td style={{ padding: '8px', border: '1px solid #cbd5e1', color: saldoActual > 0 ? '#dc2626' : '#16a34a' }}>{formatCOP(saldoActual)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

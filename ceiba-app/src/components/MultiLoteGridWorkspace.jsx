import React, { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw, DollarSign, CheckCircle2, AlertTriangle, X,
  Maximize2, FileText, Table, Phone, PhoneCall, MessageSquare,
  Copy, Check, ExternalLink, Columns, Grid, ShieldAlert,
  ChevronRight, Calendar, Receipt
} from 'lucide-react';
import { formatCOP, formatDate } from '../utils/helpers';
import { getCuotasByVenta } from '../lib/api/cartera';
import { getVentaById } from '../lib/api/ventas';
import { obtenerRecibosPorVenta } from '../lib/api/recibosApi';
import { obtenerObservacionEfectiva, getEstiloObservacionCobranza, normLote } from '../lib/api/cobranzaApi';
import { obtenerBadgeCasoEspecial } from '../lib/api/casosEspecialesApi';

/**
 * Panel Individual de un Lote dentro de la vista multi-cliente (Split o Grid)
 */
function SingleLoteTile({
  ventaId,
  initialVenta,
  allCartera = [],
  casosEspeciales = [],
  observacionesCobranza = [],
  onMaximize,
  onClose,
  onAbonar,
  onEditarCuota,
  onObservacionModal,
  onVerRecibo,
  onVerMatriz,
  onDataChanged
}) {
  const [venta, setVenta] = useState(initialVenta);
  const [cuotas, setCuotas] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  useEffect(() => {
    setVenta(initialVenta);
  }, [initialVenta]);

  const loadData = useCallback(async () => {
    if (!ventaId) return;
    setLoading(true);
    try {
      const [cRes, rRes, vRes] = await Promise.allSettled([
        getCuotasByVenta(ventaId),
        obtenerRecibosPorVenta(ventaId),
        getVentaById(ventaId)
      ]);
      if (cRes.status === 'fulfilled' && cRes.value) setCuotas(cRes.value);
      if (rRes.status === 'fulfilled' && rRes.value) setRecibos(rRes.value);
      if (vRes.status === 'fulfilled' && vRes.value) setVenta(vRes.value);

      const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastRefreshedAt(timeStr);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 2500);

      if (typeof onDataChanged === 'function') {
        onDataChanged();
      }
    } catch (err) {
      console.error('Error cargando lote tile:', err);
    } finally {
      setLoading(false);
    }
  }, [ventaId, onDataChanged]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const v = venta || initialVenta || {};
  const loteStr = v.id_lote || v.lotes?.id_lote || 'Lote';
  const clienteNombre = v.cliente_nombre || v.clientes?.nombre || 'Titular no asignado';
  const clienteDoc = v.clientes?.doc_cliente || v.doc_cliente || '—';
  const celular = v.clientes?.celular || v.celular || '';
  const saldo = Number(v.saldo || 0);
  const cuotasVencidas = Number(v.cuotas_vencidas || 0);
  const isMora = cuotasVencidas > 0 || v.es_critico;
  const isSaldado = saldo <= 0 || v.estado === 'PAGADO EN SU TOTALIDAD';

  // Observación de cobranza
  const obs = obtenerObservacionEfectiva(normLote(loteStr), observacionesCobranza);
  const estiloObs = getEstiloObservacionCobranza(obs?.compromiso_pago);
  const badgeCE = obtenerBadgeCasoEspecial(loteStr, casosEspeciales);

  // Copiar celular
  const handleCopyPhone = () => {
    if (!celular) return;
    navigator.clipboard.writeText(celular);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  };

  // WhatsApp
  const phoneClean = celular.replace(/\D/g, '');
  const waUrl = phoneClean
    ? `https://wa.me/57${phoneClean.startsWith('57') ? phoneClean.slice(2) : phoneClean}?text=${encodeURIComponent(`Hola ${clienteNombre}, le saludamos de Soporte y Cartera de Proyecto Campestre La Ceiba sobre su lote ${loteStr}.`)}`
    : null;

  // Precalcular excedentes y abonos acumulados
  let acumuladoCredito = 0;
  const cuotasCalculadas = (cuotas || []).map(c => {
    const vCuo = Number(c.valor_cuota) || 0;
    const vPag = Number(c.valor_pagado) || 0;
    const est = String(c.estado_cuota || '').toUpperCase();

    if (est === 'PAGA') {
      const extra = Math.max(0, vPag - vCuo);
      acumuladoCredito += extra;
      return { ...c, abonoPrevio: 0, saldoNeto: 0 };
    } else {
      let abonoPrevio = 0;
      if (acumuladoCredito > 0) {
        abonoPrevio = Math.min(acumuladoCredito, Math.max(0, vCuo - vPag));
        acumuladoCredito -= abonoPrevio;
      }
      const saldoNeto = Math.max(0, vCuo - vPag - abonoPrevio);
      return { ...c, abonoPrevio, saldoNeto };
    }
  });

  return (
    <div style={{
      background: 'var(--bg-card, #ffffff)',
      border: '1.5px solid var(--border, #cbd5e1)',
      borderRadius: 10,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: 520,
      boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
      overflow: 'hidden'
    }}>
      {/* ── ENCABEZADO DEL TILE ── */}
      <div style={{
        padding: '12px 14px',
        background: isMora ? '#fff1f2' : isSaldado ? '#f0fdf4' : '#f8fafc',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 8
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{
              fontWeight: 900,
              fontSize: 15,
              color: isMora ? '#b91c1c' : '#0f766e',
              fontFamily: 'monospace'
            }}>
              {loteStr}
            </span>

            {/* Badge de estado principal */}
            {isSaldado ? (
              <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                ✓ Paz y Salvo
              </span>
            ) : isMora ? (
              <span style={{ background: '#fee2e2', color: '#dc2626', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                ⚠️ {cuotasVencidas} Mora
              </span>
            ) : (
              <span style={{ background: '#dbeafe', color: '#1e40af', padding: '1px 7px', borderRadius: 10, fontSize: 10, fontWeight: 800 }}>
                ✓ Al Día
              </span>
            )}

            {badgeCE && (
              <span style={{
                background: badgeCE.bgColor,
                color: badgeCE.textColor,
                padding: '1px 6px',
                borderRadius: 4,
                fontSize: 9.5,
                fontWeight: 700
              }}>
                {badgeCE.texto}
              </span>
            )}
          </div>

          <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-primary, #0f172a)', marginTop: 2 }}>
            {clienteNombre}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
            <span>CC: {clienteDoc}</span>
            {celular && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                • <Phone size={10} /> {celular}
                <button
                  type="button"
                  onClick={handleCopyPhone}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, color: copiedPhone ? '#16a34a' : '#64748b' }}
                  title="Copiar número"
                >
                  {copiedPhone ? <Check size={11} /> : <Copy size={11} />}
                </button>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', marginLeft: 2 }}
                    title="Enviar mensaje de WhatsApp a este cliente"
                  >
                    <MessageSquare size={11} />
                  </a>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Acciones de Cabecera del Tile */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Botón Refrescar */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 700,
              background: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #86efac'
            }}
            onClick={loadData}
            disabled={loading}
            title="Refrescar cuotas y pagos de este cliente en tiempo real sin recargar la página"
          >
            <RefreshCw size={11} className={loading ? 'spin' : ''} />
            <span style={{ display: 'none', smInline: 'inline' }}>{loading ? '…' : 'Refrescar'}</span>
          </button>

          {/* Maximizar a vista individual */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px 6px', fontSize: 11 }}
            onClick={() => onMaximize(ventaId)}
            title="Ver este cliente a pantalla completa (Ficha individual)"
          >
            <Maximize2 size={12} />
          </button>

          {/* Cerrar esta pestaña */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px 6px', fontSize: 12, color: '#ef4444' }}
            onClick={() => onClose(ventaId)}
            title="Cerrar este cliente"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── BARRA RESUMEN DE SALDO & ACCIONES RÁPIDAS ── */}
      <div style={{
        padding: '8px 14px',
        background: 'var(--bg-card2, #f8fafc)',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 6,
        fontSize: 12
      }}>
        <div>
          <span style={{ color: 'var(--text-muted, #64748b)' }}>Saldo: </span>
          <strong style={{ color: saldo > 0 ? '#b91c1c' : '#15803d', fontSize: 13 }}>
            {formatCOP(saldo)}
          </strong>
          {v.valor_cuota > 0 && (
            <span style={{ color: 'var(--text-muted, #64748b)', fontSize: 11, marginLeft: 6 }}>
              (Cuota: {formatCOP(v.valor_cuota)})
            </span>
          )}
        </div>

        {/* Botones de acción rápida */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 700,
              background: '#f0fdf4',
              color: '#15803d',
              border: '1px solid #bbf7d0'
            }}
            onClick={() => onAbonar(v)}
            title="Abonar a este contrato y emitir recibo oficial"
          >
            <DollarSign size={11} /> Abonar
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe'
            }}
            onClick={() => onVerMatriz(v)}
            title="Abrir Estado de Cuenta (Matriz)"
          >
            <Table size={11} /> Matriz
          </button>

          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '3px 8px',
              fontSize: 11,
              fontWeight: 600,
              background: estiloObs.badgeBg || '#fffbeb',
              color: estiloObs.badgeColor || '#b45309',
              border: `1px solid ${estiloObs.borderColor || '#fde68a'}`
            }}
            onClick={() => onObservacionModal(v, obs)}
            title="Gestionar observación de cobranza o compromiso"
          >
            <MessageSquare size={11} /> Obs
          </button>
        </div>
      </div>

      {/* ── NOTA DE COBRANZA (SI EXISTE) ── */}
      {obs?.observacion && (
        <div style={{
          padding: '6px 14px',
          background: estiloObs.badgeBg || '#fffbeb',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          fontSize: 11,
          color: estiloObs.badgeColor || '#92400e',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span>💬</span>
          <span style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {obs.observacion}
          </span>
          {obs.fecha_compromiso && (
            <span style={{ fontSize: 10, opacity: 0.85, flexShrink: 0, marginLeft: 'auto' }}>
              Compromiso: {obs.fecha_compromiso}
            </span>
          )}
        </div>
      )}

      {/* ── TABLA DE CUOTAS SCROLLEABLE ── */}
      <div style={{ flex: 1, overflowY: 'auto', maxHeight: 380, padding: 0 }}>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={18} className="spin" style={{ margin: '0 auto 6px' }} />
            <div>Cargando cuotas del cliente...</div>
          </div>
        ) : cuotasCalculadas.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            No hay cuotas programadas para este lote.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card2, #f1f5f9)', zIndex: 2 }}>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>#</th>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700 }}>Vence</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Cuota</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700 }}>Pagado</th>
                <th style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 700 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {cuotasCalculadas.map((c) => {
                const vPag = Number(c.valor_pagado) || 0;
                const vCuo = Number(c.valor_cuota) || 0;
                const abonoPrev = Number(c.abonoPrevio) || 0;
                const totalCubierto = vPag + abonoPrev;
                const estRaw = String(c.estado_cuota || '').toUpperCase();
                const todayStr = new Date().toISOString().slice(0, 10);
                const fvStr = c.fecha_vencimiento ? String(c.fecha_vencimiento).slice(0, 10) : '';
                const isMora = (fvStr && fvStr < todayStr) || estRaw === 'VENCIDA' || estRaw.includes('MORA');
                const isAbono = estRaw.startsWith('ABONO') || (estRaw !== 'PAGA' && totalCubierto > 0 && totalCubierto < vCuo - 50);

                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                    {/* Número de cuota */}
                    <td style={{ padding: '5px 10px', fontWeight: 700 }}>
                      Cuota {c.numero_cuota}
                    </td>

                    {/* Vencimiento */}
                    <td style={{ padding: '5px 10px', color: isMora && estRaw !== 'PAGA' ? '#dc2626' : 'inherit' }}>
                      {formatDate(c.fecha_vencimiento)}
                    </td>

                    {/* Valor cuota y desglose de abono previo */}
                    <td style={{ padding: '5px 10px', textAlign: 'right' }}>
                      <div style={{ fontWeight: 600 }}>{formatCOP(c.valor_cuota)}</div>
                      {c.abonoPrevio > 0 && c.estado_cuota !== 'PAGA' && (
                        <div style={{ fontSize: 9.5, color: '#dc2626', fontWeight: 800 }}>
                          Neto: {formatCOP(c.saldoNeto)}
                        </div>
                      )}
                    </td>

                    {/* Pagado / Abono a favor */}
                    <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700 }}>
                      {c.estado_cuota === 'PAGA' && (!c.valor_pagado || Number(c.valor_pagado) === 0) ? (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ) : (c.abonoPrevio > 0 && (!c.valor_pagado || Number(c.valor_pagado) === 0)) ? (
                        <span style={{ color: '#d97706' }} title="Abono a favor acumulado de cuotas previas">
                          {formatCOP(c.abonoPrevio)}
                        </span>
                      ) : (
                        <span style={{ color: '#16a34a' }}>{formatCOP(c.valor_pagado)}</span>
                      )}
                    </td>

                    {/* Badge de estado */}
                    <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                      {isAbono ? (
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 9.5,
                          fontWeight: 800,
                          background: isMora ? '#fee2e2' : '#fef3c7',
                          color: isMora ? '#dc2626' : '#d97706',
                          border: isMora ? '1px solid #fca5a5' : '1px solid #fde68a',
                          whiteSpace: 'nowrap'
                        }}>
                          {isMora ? 'ABONO EN MORA' : 'ABONO AL DÍA'}
                        </span>
                      ) : (
                        <span style={{
                          padding: '1px 6px',
                          borderRadius: 4,
                          fontSize: 9.5,
                          fontWeight: 700,
                          background: c.estado_cuota === 'PAGA' ? '#f0fdf4' : c.estado_cuota === 'VENCIDA' ? '#fef2f2' : '#eff6ff',
                          color: c.estado_cuota === 'PAGA' ? '#16a34a' : c.estado_cuota === 'VENCIDA' ? '#dc2626' : '#2563eb',
                          whiteSpace: 'nowrap'
                        }}>
                          {c.estado_cuota}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── PIE DEL TILE CON TIMESTAMP DE SINCRONIZACIÓN ── */}
      <div style={{
        padding: '6px 12px',
        background: 'var(--bg-card2, #f8fafc)',
        borderTop: '1px solid var(--border, #e2e8f0)',
        fontSize: 10.5,
        color: 'var(--text-muted, #64748b)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <span>Pagadas: <strong style={{ color: '#16a34a' }}>{cuotas.filter(c => c.estado_cuota === 'PAGA').length}</strong> / {cuotas.length}</span>
        {lastRefreshedAt && (
          <span style={{ color: refreshSuccess ? '#16a34a' : 'var(--text-muted)', fontWeight: 600 }}>
            {refreshSuccess ? '✓ Sincronizado' : 'Sincr:'} {lastRefreshedAt}
          </span>
        )}
      </div>
    </div>
  );
}

/**
 * Componente Principal: Contenedor Multi-Cliente (Split View 2x2 / Mosaico 3-4 Clientes a la vez)
 */
export default function MultiLoteGridWorkspace({
  openLoteIds = [],
  allCartera = [],
  casosEspeciales = [],
  observacionesCobranza = [],
  activeTabId,
  viewMode = 'split2', // 'split2' | 'grid'
  onSelectTab,
  onCloseTab,
  onAbonar,
  onEditarCuota,
  onObservacionModal,
  onVerRecibo,
  onVerMatriz,
  onDataChanged
}) {
  // Lotes a mostrar: en split2 mostramos los 2 primeros o el activo + otro; en grid hasta 4
  const displayIds = viewMode === 'split2'
    ? openLoteIds.slice(0, 2)
    : openLoteIds.slice(0, 4);

  return (
    <div style={{ marginBottom: 24 }}>
      {/* Grid de 2, 3 o 4 columnas / mosaico */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: viewMode === 'split2'
          ? 'repeat(auto-fit, minmax(450px, 1fr))'
          : displayIds.length === 3
            ? 'repeat(auto-fit, minmax(360px, 1fr))'
            : 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: 16,
        alignItems: 'stretch'
      }}>
        {displayIds.map((loteId) => {
          const venta = allCartera.find(v => (v.id || v.venta_id) === loteId);
          return (
            <SingleLoteTile
              key={loteId}
              ventaId={loteId}
              initialVenta={venta}
              allCartera={allCartera}
              casosEspeciales={casosEspeciales}
              observacionesCobranza={observacionesCobranza}
              onMaximize={(id) => onSelectTab(id, 'tabs')}
              onClose={(id) => onCloseTab(id)}
              onAbonar={onAbonar}
              onEditarCuota={onEditarCuota}
              onObservacionModal={onObservacionModal}
              onVerRecibo={onVerRecibo}
              onVerMatriz={onVerMatriz}
              onDataChanged={onDataChanged}
            />
          );
        })}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Table, Calendar, Receipt, Download, Edit2, Eye,
  DollarSign, ClipboardList, Plus, Phone, PhoneCall, Copy, Check,
  AlertTriangle, Clock, Search, ChevronRight, X, ArrowLeft, Home,
  CheckCircle2, ShieldAlert, Sparkles, RefreshCw
} from 'lucide-react';
import { formatCOP, formatDate, formatTime } from '../utils/helpers';
import { exportEstadoCuentaMatrizPDF, exportEstadoCuentaInformePDF } from '../utils/exportEstadoCuenta';
import EstadoCuentaMatrizView from './EstadoCuentaMatrizView';
import { getCuotasByVenta } from '../lib/api/cartera';
import { getVentaById } from '../lib/api/ventas';
import { obtenerRecibosPorVenta } from '../lib/api/recibosApi';
import { obtenerBadgeCasoEspecial } from '../lib/api/casosEspecialesApi';
import { obtenerObservacionEfectiva, getEstiloObservacionCobranza, normLote } from '../lib/api/cobranzaApi';

/**
 * Ficha de Trabajo Dedicada para el Lote Activo en Pestaña.
 * Permite gestionar cobranza, estados de cuenta, cuotas y recibos sin bloqueo por modales,
 * con acceso directo para alternar y buscar otros lotes.
 */
export default function LoteDetalleWorkspace({
  venta,
  allCartera = [],
  casosEspeciales = [],
  observacionesCobranza = [],
  permissions = {},
  user,
  onCloseTab,
  onOpenLote,
  onAbonar,
  onEditarContrato,
  onEditarCuota,
  onObservacionModal,
  onVerRecibo,
  onAnularRecibo,
  onDataChanged,
}) {
  const [localVenta, setLocalVenta] = useState(venta);
  const [cuotas, setCuotas] = useState([]);
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('resumen'); // 'resumen' | 'matriz' | 'cuotas' | 'recibos'
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [refreshSuccess, setRefreshSuccess] = useState(false);

  useEffect(() => {
    setLocalVenta(venta);
  }, [venta]);

  // Selector rápido "Buscar otro lote" en cabecera
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchDropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const ventaId = venta?.id || venta?.venta_id;

  const loadLoteDetails = useCallback(async (notifyParent = false) => {
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
      if (vRes.status === 'fulfilled' && vRes.value) setLocalVenta(vRes.value);
      const timeStr = new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastRefreshedAt(timeStr);
      setRefreshSuccess(true);
      setTimeout(() => setRefreshSuccess(false), 3000);
      if (notifyParent && typeof onDataChanged === 'function') {
        onDataChanged();
      }
    } catch (err) {
      console.error('Error cargando detalles del lote en workspace:', err);
    } finally {
      setLoading(false);
    }
  }, [ventaId, onDataChanged]);

  useEffect(() => {
    loadLoteDetails();
  }, [loadLoteDetails]);

  const currentVenta = localVenta || venta;

  // Manejo de clic fuera del dropdown de búsqueda rápida
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
    }
    if (searchOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [searchOpen]);

  if (!venta) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card, #fff)', borderRadius: 10, border: '1px solid var(--border)' }}>
        <Home size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Lote no seleccionado</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
          Selecciona un lote desde la barra de pestañas o utiliza el buscador para abrir uno.
        </div>
      </div>
    );
  }

  const loteStr = venta.id_lote || venta.lotes?.id_lote || 'Lote sin identificar';
  const clienteStr = venta.cliente_nombre || venta.clientes?.nombre || 'Cliente sin nombre';
  const docStr = venta.clientes?.doc_cliente || '';
  const celStr = venta.clientes?.celular || venta.celular || '';
  const cuotasVencidas = Number(venta.cuotas_vencidas || 0);
  const saldo = Number(venta.saldo || 0);
  const isMora = cuotasVencidas > 0 || venta.es_critico;
  const isSaldado = saldo <= 0 || venta.estado === 'PAGADO EN SU TOTALIDAD' || venta.estado === 'PAGADO';

  const casoEsp = obtenerBadgeCasoEspecial(loteStr, casosEspeciales);
  const obs = obtenerObservacionEfectiva(loteStr, observacionesCobranza, venta.observacion_cobranza || venta.lotes?.observacion);
  const estiloObs = obs ? getEstiloObservacionCobranza(obs) : null;

  // Filtrar lotes para el buscador rápido de la cabecera
  const filteredQuickLotes = allCartera.filter(v => {
    const rawQ = searchQuery.trim();
    if (!rawQ) return true;
    const qLower = rawQ.toLowerCase();
    const qNorm = qLower.replace(/[\s\-_]+/g, '');

    const lRaw = (v.id_lote || v.lotes?.id_lote || '').toLowerCase();
    const lNorm = lRaw.replace(/[\s\-_]+/g, '');
    const c = (v.cliente_nombre || v.clientes?.nombre || '').toLowerCase();
    const d = String(v.clientes?.doc_cliente || v.doc_cliente || '').toLowerCase();
    const cel = String(v.clientes?.celular || v.celular || '');

    return lNorm.includes(qNorm) || lRaw.includes(qLower) || c.includes(qLower) || d.includes(qLower) || cel.includes(qLower);
  }).slice(0, 20);

  return (
    <div style={{
      background: 'var(--bg-card, #ffffff)',
      borderRadius: 10,
      border: '1px solid var(--border, #e2e8f0)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      overflow: 'hidden',
      marginBottom: 30,
    }}>
      {/* ── BARRA SUPERIOR: DATOS DEL LOTE Y ACCIONES RÁPIDAS ── */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border, #e2e8f0)',
        background: 'linear-gradient(to right, #f8fafc, #ffffff)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 14,
      }}>
        {/* Identificación del Lote y Cliente */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#0f766e', letterSpacing: '-0.3px' }}>
              {loteStr}
            </span>
            <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              — {clienteStr}
            </span>

            {/* Badge de Mora o Al Día */}
            {isMora ? (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#fee2e2',
                color: '#dc2626',
                border: '1px solid #fca5a5',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <AlertTriangle size={12} />
                {cuotasVencidas > 0 ? `${cuotasVencidas} Cuotas Vencidas` : 'En Mora'}
                {venta.dias_mora ? ` · ${venta.dias_mora} días` : ''}
              </span>
            ) : isSaldado ? (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#dcfce7',
                color: '#15803d',
                border: '1px solid #86efac',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <CheckCircle2 size={12} /> Lote Saldado
              </span>
            ) : (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 6,
                background: '#eff6ff',
                color: '#1d4ed8',
                border: '1px solid #bfdbfe',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}>
                <Check size={12} /> Al Día
              </span>
            )}

            {/* Badge de Caso Especial si existe */}
            {casoEsp && (
              <span style={{
                fontSize: 11,
                fontWeight: 800,
                padding: '3px 9px',
                borderRadius: 6,
                background: casoEsp.bg,
                color: casoEsp.color,
                border: `1px solid ${casoEsp.color}40`,
              }}>
                {casoEsp.text}
              </span>
            )}
          </div>

          {/* Subtítulo con metadata del contrato */}
          <div style={{
            fontSize: 12,
            color: 'var(--text-muted, #64748b)',
            marginTop: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}>
            <span>📅 Venta: <strong>{venta.fecha_venta ? formatDate(venta.fecha_venta) : 'Sin fecha'}</strong></span>
            {cuotas.length > 0 && <span>· <strong>{cuotas.length} cuotas</strong></span>}
            {docStr && <span>· CC: <strong>{docStr}</strong></span>}

            {/* Teléfono con botón Copiar y Llamar */}
            {celStr && (
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#eff6ff',
                color: '#1e40af',
                border: '1px solid #bfdbfe',
                borderRadius: 4,
                padding: '2px 8px',
                fontWeight: 600,
              }}>
                <Phone size={12} color="#2563eb" />
                <span>{celStr}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(String(celStr).replace(/\s+/g, ''));
                    setCopiedPhone(true);
                    setTimeout(() => setCopiedPhone(false), 1500);
                  }}
                  style={{
                    border: 'none',
                    background: copiedPhone ? '#dcfce7' : '#dbeafe',
                    color: copiedPhone ? '#15803d' : '#1d4ed8',
                    padding: '1px 6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 3,
                    borderRadius: 3,
                    fontSize: 10.5,
                    fontWeight: 700,
                  }}
                  title={copiedPhone ? '¡Copiado!' : 'Copiar teléfono'}
                >
                  {copiedPhone ? <Check size={11} color="#15803d" /> : <Copy size={11} />}
                  <span>{copiedPhone ? '¡Copiado!' : 'Copiar'}</span>
                </button>
              </span>
            )}

            {/* Saldo Pendiente */}
            <span>
              · Saldo Actual: <strong style={{ color: isMora ? '#dc2626' : '#0f766e', fontSize: 13 }}>{formatCOP(saldo)}</strong>
            </span>
          </div>
        </div>

        {/* Acciones Rápidas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Botón rápido para buscar y abrir otro lote directamente */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setSearchOpen(!searchOpen)}
              style={{
                fontSize: 12,
                padding: '6px 12px',
                gap: 6,
                color: '#0f766e',
                borderColor: '#99f6e4',
                background: '#f0fdfa',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Buscar y cambiar a otro lote"
            >
              <Search size={13} color="#0f766e" /> Buscar otro Lote
            </button>

            {searchOpen && (
              <div
                ref={searchDropdownRef}
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 6,
                  width: 340,
                  maxHeight: 380,
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  boxShadow: '0 10px 25px -5px rgba(0,0,0,0.15)',
                  padding: '10px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 100,
                }}
              >
                <div style={{ padding: '0 12px 8px 12px', borderBottom: '1px solid #f1f5f9' }}>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Lote, cliente o cédula..."
                    style={{
                      width: '100%',
                      padding: '6px 10px',
                      borderRadius: 6,
                      border: '1px solid #cbd5e1',
                      fontSize: 12,
                      outline: 'none',
                    }}
                  />
                </div>
                <div style={{ overflowY: 'auto', maxHeight: 280 }}>
                  {filteredQuickLotes.map(v => (
                    <div
                      key={v.id || v.venta_id}
                      onClick={() => {
                        onOpenLote(v);
                        setSearchOpen(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        cursor: 'pointer',
                        borderBottom: '1px solid #f8fafc',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = '#f0fdfa'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: '#0f766e' }}>
                          {v.id_lote || v.lotes?.id_lote}
                        </div>
                        <div style={{ fontSize: 11, color: '#475569' }}>
                          {v.cliente_nombre || v.clientes?.nombre}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: (v.cuotas_vencidas || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                          {(v.cuotas_vencidas || 0) > 0 ? `${v.cuotas_vencidas} vencidas` : 'Al Día'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Botón Gestión Cobranza */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              fontSize: 12,
              padding: '6px 12px',
              gap: 6,
              color: '#92400e',
              borderColor: '#fde68a',
              background: '#fffbeb',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
            }}
            onClick={() => onObservacionModal(venta, obs)}
            title="Ver o registrar gestión de cobranza y llamadas"
          >
            <ClipboardList size={13} color="#d97706" /> Observación Cobranza
          </button>

          {/* Botón Abonar */}
          {permissions?.canManageRecibos && (
            <button
              className="btn btn-primary"
              style={{
                fontSize: 12,
                padding: '6px 14px',
                background: '#16a34a',
                borderColor: '#16a34a',
                gap: 6,
                fontWeight: 700,
                boxShadow: '0 1px 3px rgba(22, 163, 74, 0.25)',
              }}
              onClick={() => onAbonar(venta)}
              title="Abonar a este contrato y emitir recibo oficial"
            >
              <DollarSign size={14} /> 💳 Abonar
            </button>
          )}

          {/* Botón Editar o Ver Contrato */}
          {permissions?.canEditContrato ? (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '6px 10px', gap: 6 }}
              onClick={() => onEditarContrato(venta)}
              title="Editar titular y condiciones financieras del contrato"
            >
              <Edit2 size={13} /> Editar Contrato
            </button>
          ) : (
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, padding: '6px 10px', gap: 6, color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff', fontWeight: 600 }}
              onClick={() => onEditarContrato(venta)}
              title="Visualizar condiciones del contrato, fecha de venta y titular (Solo lectura)"
            >
              <Eye size={13} /> Ver Contrato
            </button>
          )}

          {/* Refrescar Datos en Tiempo Real */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              fontWeight: 700,
              background: '#f0fdf4',
              color: '#15803d',
              border: '1.5px solid #86efac',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => loadLoteDetails(true)}
            disabled={loading}
            title="Refrescar cuotas, saldo y pagos de este cliente en vivo desde la base de datos sin recargar la página"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
            <span>{loading ? 'Refrescando...' : 'Refrescar Cuotas'}</span>
          </button>

          {lastRefreshedAt && (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 11,
              color: refreshSuccess ? '#15803d' : 'var(--text-muted)',
              fontWeight: 600,
              padding: '2px 6px',
              borderRadius: 4,
              background: refreshSuccess ? '#dcfce7' : 'transparent',
              transition: 'all 0.2s'
            }}>
              {refreshSuccess && <CheckCircle2 size={12} color="#16a34a" />}
              <span>{refreshSuccess ? 'Sincronizado' : 'Sincr:'} {lastRefreshedAt}</span>
            </span>
          )}

          {/* Cerrar Pestaña */}
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '6px 10px', fontSize: 13, color: '#ef4444' }}
            onClick={() => onCloseTab(ventaId)}
            title="Cerrar esta pestaña y volver a la cartera general"
          >
            ✕
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* ── TARJETA DESTACADA: OBSERVACIÓN DE COBRANZA ACTUAL ── */}
        {!obs ? (
          <div style={{
            margin: '0 0 16px',
            padding: '10px 16px',
            background: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ClipboardList size={15} color="#94a3b8" />
              <span>Sin observación de cobranza registrada para este lote</span>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                fontSize: 11,
                padding: '4px 10px',
                gap: 5,
                color: '#b45309',
                borderColor: '#fde68a',
                background: '#fffbeb',
                fontWeight: 700,
              }}
              onClick={() => onObservacionModal(venta, null)}
            >
              <Plus size={12} /> + Registrar Observación
            </button>
          </div>
        ) : (
          <div style={{
            margin: '0 0 16px',
            padding: '12px 16px',
            background: estiloObs.gradientBg,
            border: `1px solid ${estiloObs.border}`,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 6,
                background: estiloObs.badgeBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: estiloObs.badgeColor,
                flexShrink: 0,
                marginTop: 1,
              }}>
                <ClipboardList size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: estiloObs.colorDark }}>
                    Observación de Cobranza Actual
                  </span>
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: estiloObs.badgeBg,
                    color: estiloObs.badgeColor,
                  }}>
                    {estiloObs.label}
                  </span>
                  {obs.fecha && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: estiloObs.colorDark, background: '#fff', padding: '1px 6px', borderRadius: 4, border: `1px solid ${estiloObs.border}` }}>
                      📅 {obs.fecha}
                    </span>
                  )}
                  {obs.contacto && (
                    <span style={{ fontSize: 10.5, color: estiloObs.colorDark, background: '#fff', padding: '1px 6px', borderRadius: 4, border: `1px solid ${estiloObs.border}` }}>
                      👤 {obs.contacto}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: estiloObs.colorDark, marginTop: 2 }}>
                  {obs.respuesta || obs.texto_resumen}
                </div>
                {(obs.nota || obs.observacion_adicional) && (
                  <div style={{
                    fontSize: 12.5,
                    color: estiloObs.colorText,
                    fontWeight: 600,
                    marginTop: 4,
                    background: '#fff',
                    padding: '6px 10px',
                    borderRadius: 6,
                    border: `1px solid ${estiloObs.border}`,
                  }}>
                    "{obs.nota || obs.observacion_adicional}"
                  </div>
                )}
                {obs.gestion && (
                  <div style={{ fontSize: 11, color: estiloObs.colorDark, marginTop: 3 }}>
                    Canal: <strong>{obs.gestion}</strong>
                  </div>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost"
              style={{
                fontSize: 11,
                padding: '5px 12px',
                gap: 5,
                background: '#fff',
                borderColor: estiloObs.border,
                color: estiloObs.colorDark,
                fontWeight: 700,
                whiteSpace: 'nowrap',
              }}
              onClick={() => onObservacionModal(venta, obs)}
            >
              ✏️ Editar Obs
            </button>
          </div>
        )}

        {/* ── NAVEGADOR DE SUB-PESTAÑAS INTERNAS ── */}
        <div style={{
          display: 'flex',
          borderBottom: '2px solid var(--border, #e2e8f0)',
          marginBottom: 16,
          gap: 4,
        }}>
          {[
            { id: 'resumen', label: 'Resumen Financiero', icon: <FileText size={14} /> },
            { id: 'matriz', label: 'Estado de Cuenta (Matriz)', icon: <Table size={14} /> },
            { id: 'cuotas', label: `Tabla de Cuotas (${cuotas.length})`, icon: <Calendar size={14} /> },
            { id: 'recibos', label: `Recibos de Caja (${recibos.length})`, icon: <Receipt size={14} /> },
          ].map(tab => {
            const isTabActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '9px 16px',
                  border: 'none',
                  background: 'none',
                  borderBottom: isTabActive ? '2px solid #0f766e' : '2px solid transparent',
                  color: isTabActive ? '#0f766e' : 'var(--text-muted, #64748b)',
                  fontWeight: isTabActive ? 800 : 500,
                  fontSize: 13,
                  cursor: 'pointer',
                  marginBottom: -2,
                  transition: 'all 0.15s ease',
                }}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── CONTENIDO DE SUB-PESTAÑAS ── */}

        {/* SUBTAB 1: RESUMEN FINANCIERO */}
        {activeTab === 'resumen' && (
          <div>
            {/* Grid de 6 métricas clave */}
            <div className="modal-summary-grid" style={{ marginBottom: 16 }}>
              {[
                { label: 'Precio Total Lote', val: formatCOP(venta.precio_venta), color: '#374151' },
                { label: 'Cuota Inicial', val: formatCOP(venta.valor_cuota_inicial), color: '#374151' },
                { label: 'Saldo Financiado', val: formatCOP(venta.saldo_financiado), color: '#374151' },
                { label: 'Cuotas Pagadas', val: formatCOP(venta.cuotas_pagadas_monto), color: '#0284c7' },
                { label: 'Total Recaudado', val: formatCOP(venta.total_pagado), color: '#16a34a' },
                { label: 'Saldo Pendiente', val: formatCOP(venta.saldo),
                  color: venta.saldo <= 0 ? '#16a34a' : (venta.cuotas_vencidas > 0 ? '#dc2626' : '#d97706') },
              ].map(item => (
                <div key={item.label} style={{ background: 'var(--bg-base, #f8fafc)', borderRadius: 8, padding: '12px 14px', border: '1px solid var(--border, #e2e8f0)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: item.color, marginTop: 4 }}>{item.val}</div>
                </div>
              ))}
            </div>

            {/* Barra de Progreso de Pago */}
            <div style={{ marginBottom: 20, background: 'var(--bg-base, #f8fafc)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-secondary, #475569)' }}>Progreso de Pago Total</span>
                <strong style={{ color: '#0f766e', fontSize: 13 }}>
                  {Math.min(100, Math.round(((venta.total_pagado || 0) / (venta.precio_venta || 1)) * 100))}%
                </strong>
              </div>
              <div style={{ height: 10, background: '#e2e8f0', borderRadius: 100, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round(((venta.total_pagado || 0) / (venta.precio_venta || 1)) * 100))}%`,
                  background: 'linear-gradient(to right, #0d9488, #16a34a)',
                  borderRadius: 100,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>

            {/* Ficha técnica del contrato */}
            <div className="grid-responsive-2" style={{ gap: 10, fontSize: 12.5, color: 'var(--text-secondary, #334155)', background: '#ffffff', padding: '14px 16px', borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', marginBottom: 20 }}>
              <div><strong>Vendedor:</strong> {venta.vendedor_nombre || '—'}</div>
              <div><strong>Día de Pago Pactado:</strong> {venta.dias_pago || '—'}</div>
              <div><strong>Medio de Pago habitual:</strong> {venta.medio_pago || '—'}</div>
              <div><strong>Plazo Financiación:</strong> {venta.plazo_cuotas ? `${venta.plazo_cuotas} meses` : '—'}</div>
              <div><strong>Valor Cuota Mensual:</strong> {formatCOP(venta.valor_cuota)}</div>
              <div><strong>Área del Lote:</strong> {venta.lotes?.area_m2 ? `${venta.lotes.area_m2} m²` : '—'}</div>
            </div>

            {/* Botones de Descarga Oficial PDF */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, fontSize: 12.5, gap: 8, padding: '10px 16px', fontWeight: 700, borderColor: '#cbd5e1' }}
                onClick={() => exportEstadoCuentaMatrizPDF(venta, cuotas)}
              >
                <Download size={15} /> Descargar Estado de Cuenta (PDF Matriz)
              </button>
              <button
                className="btn btn-ghost"
                style={{ flex: 1, fontSize: 12.5, gap: 8, padding: '10px 16px', fontWeight: 700, borderColor: '#cbd5e1' }}
                onClick={() => exportEstadoCuentaInformePDF(venta, cuotas)}
              >
                <FileText size={15} /> Descargar Informe Gerencial (PDF)
              </button>
            </div>
          </div>
        )}

        {/* SUBTAB 2: ESTADO DE CUENTA (MATRIZ) */}
        {activeTab === 'matriz' && (
          <EstadoCuentaMatrizView
            venta={currentVenta}
            cuotas={cuotas}
            loading={loading}
            onEditarCuota={onEditarCuota}
            onRefresh={() => loadLoteDetails(true)}
          />
        )}

        {/* SUBTAB 3: TABLA DE CUOTAS */}
        {activeTab === 'cuotas' && (
          <div>
            {loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Cargando cuotas...</div>
            ) : (
              <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-base, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>#</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Vencimiento</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>Valor Cuota</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>Valor Pagado</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Fecha Pago</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Estado</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Calcular excedentes de cuotas previas e imputación a cuotas pendientes
                      let acumuladoCredito = 0;
                      const cuotasConCalculos = (cuotas || []).map(c => {
                        const vCuo = Number(c.valor_cuota) || 0;
                        const vPag = Number(c.valor_pagado) || 0;
                        const est = String(c.estado_cuota || '').toUpperCase();

                        if (est === 'PAGA') {
                          const extra = Math.max(0, vPag - vCuo);
                          acumuladoCredito += extra;
                          return { ...c, abonoPrevio: 0, saldoNeto: 0, extraGenerado: extra };
                        } else {
                          let abonoPrevio = 0;
                          if (acumuladoCredito > 0) {
                            abonoPrevio = Math.min(acumuladoCredito, Math.max(0, vCuo - vPag));
                            acumuladoCredito -= abonoPrevio;
                          }
                          const saldoNeto = Math.max(0, vCuo - vPag - abonoPrevio);
                          return { ...c, abonoPrevio, saldoNeto, extraGenerado: 0 };
                        }
                      });

                      return cuotasConCalculos.map((c) => {
                        const cuotaRecs = (recibos || []).filter(r => r && r.cuota_id === c.id);
                        return (
                          <tr key={c.id} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 700 }}>
                              <div>Cuota {c.numero_cuota}</div>
                              {/* Badges de recibos emitidos en esta cuota */}
                              {cuotaRecs.length > 0 && (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                  {cuotaRecs.map(r => (
                                    <button
                                      key={r.numero_recibo}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); onVerRecibo({ ...r, autoDownload: true }); }}
                                      style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 4,
                                        background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                                        padding: '2px 8px', borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                      title="Clic para ver y descargar este Recibo Oficial en PDF"
                                    >
                                      <Receipt size={11} /> Recibo #{r.numero_recibo} ({formatCOP(r.valor)}) <Download size={11} color="#2563eb" style={{ marginLeft: 2 }} />
                                    </button>
                                  ))}
                                </div>
                              )}
                              {/* Observación / Excedente / Nota */}
                              {c.observacion && (
                                <div style={{
                                  fontSize: 10,
                                  color: '#0369a1',
                                  background: '#f0f9ff',
                                  border: '1px solid #bae6fd',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  marginTop: 4,
                                  fontWeight: 500,
                                  maxWidth: 240,
                                  lineHeight: 1.3
                                }}>
                                  💬 {c.observacion}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>{formatDate(c.fecha_vencimiento)}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <div style={{ fontWeight: 600 }}>{formatCOP(c.valor_cuota)}</div>
                              {c.abonoPrevio > 0 && c.estado_cuota !== 'PAGA' && (
                                <div style={{ marginTop: 3 }}>
                                  <span style={{
                                    display: 'inline-block',
                                    background: '#dcfce7',
                                    color: '#15803d',
                                    border: '1px solid #86efac',
                                    fontSize: 9.5,
                                    fontWeight: 700,
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                    whiteSpace: 'nowrap'
                                  }}>
                                    Abono previo: -{formatCOP(c.abonoPrevio)}
                                  </span>
                                  <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 800, marginTop: 1 }}>
                                    Neto a cobrar: {formatCOP(c.saldoNeto)}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>
                              {c.estado_cuota === 'PAGA' && (!c.valor_pagado || Number(c.valor_pagado) === 0) ? (
                                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>—</span>
                              ) : (c.abonoPrevio > 0 && (!c.valor_pagado || Number(c.valor_pagado) === 0)) ? (
                                <span style={{ color: '#d97706', fontWeight: 700 }} title="Abono a favor acumulado de pagos anteriores">
                                  {formatCOP(c.abonoPrevio)}
                                </span>
                              ) : formatCOP(c.valor_pagado)}
                            </td>
                          <td style={{ padding: '8px 12px' }}>
                            {c.fecha_pago ? formatDate(c.fecha_pago) : (c.abonoPrevio > 0 && c.estado_cuota !== 'PAGA') ? (
                              <span style={{ color: '#d97706', fontSize: 11, fontStyle: 'italic' }}>Abono previo</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            {(() => {
                              const vPag = Number(c.valor_pagado) || 0;
                              const vCuo = Number(c.valor_cuota) || 0;
                              const abonoPrev = Number(c.abonoPrevio) || 0;
                              const totalCubierto = vPag + abonoPrev;
                              const estRaw = String(c.estado_cuota || '').toUpperCase();
                              const todayStr = new Date().toISOString().slice(0, 10);
                              const fvStr = c.fecha_vencimiento ? String(c.fecha_vencimiento).slice(0, 10) : '';
                              const isMora = (fvStr && fvStr < todayStr) || estRaw === 'VENCIDA' || estRaw.includes('MORA');
                              const isAbono = estRaw.startsWith('ABONO') || (estRaw !== 'PAGA' && totalCubierto > 0 && totalCubierto < vCuo - 50);

                              if (isAbono) {
                                return (
                                  <span style={{
                                    padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                    background: isMora ? '#fee2e2' : '#fef3c7',
                                    color: isMora ? '#dc2626' : '#d97706',
                                    border: isMora ? '1px solid #fca5a5' : '1px solid #fde68a',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    {isMora ? 'ABONO EN MORA' : 'ABONO AL DÍA'}
                                  </span>
                                );
                              }

                              return (
                                <span style={{
                                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                                  background: c.estado_cuota === 'PAGA' ? '#f0f9ff' : c.estado_cuota === 'VENCIDA' ? '#fef2f2' : '#f0fdf4',
                                  color: c.estado_cuota === 'PAGA' ? '#0284c7' : c.estado_cuota === 'VENCIDA' ? '#dc2626' : '#16a34a'
                                }}>
                                  {c.estado_cuota}
                                </span>
                              );
                            })()}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                              <button
                                className="btn btn-ghost"
                                style={{
                                  padding: '4px 8px', fontSize: 11,
                                  color: '#15803d', borderColor: '#86efac', background: '#f0fdf4',
                                  fontWeight: 700, gap: 4
                                }}
                                onClick={() => onAbonar(venta, c)}
                                title="Abonar a esta cuota y emitir recibo oficial"
                              >
                                <Receipt size={11} /> Abonar
                              </button>

                              <button
                                className="btn btn-ghost"
                                style={{ padding: '4px 8px', fontSize: 11 }}
                                onClick={() => onEditarCuota(c)}
                                title="Ajuste manual de cuota"
                              >
                                <Edit2 size={11} /> Editar
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 4: HISTORIAL DE RECIBOS DE CAJA MENOR */}
        {activeTab === 'recibos' && (
          <div>
            {recibos.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', background: '#f8fafc', borderRadius: 8, border: '1px dashed #cbd5e1' }}>
                <Receipt size={36} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: 14, fontWeight: 700, color: '#334155' }}>
                  No hay recibos de caja emitidos para este contrato aún.
                </div>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, marginBottom: 16 }}>
                  Cada pago registrado generará su recibo numerado con valor en letras listo para imprimir.
                </div>
                {permissions?.canManageRecibos && (
                  <button
                    className="btn btn-primary"
                    style={{ background: '#16a34a', borderColor: '#16a34a', fontSize: 12.5, padding: '8px 16px', gap: 6, fontWeight: 700 }}
                    onClick={() => onAbonar(venta)}
                    title="Abonar a este contrato y emitir recibo oficial"
                  >
                    💳 Abonar a este contrato
                  </button>
                )}
              </div>
            ) : (
              <div style={{ maxHeight: 460, overflowY: 'auto', border: '1px solid var(--border, #e2e8f0)', borderRadius: 8 }}>
                <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-base, #f8fafc)', borderBottom: '1px solid var(--border, #e2e8f0)' }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Nº Recibo</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Fecha Pago</th>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700 }}>Cuota / Concepto</th>
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700 }}>Valor Pagado</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Medio de Pago</th>
                      <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recibos
                      .filter(r => r && (r.numero_recibo || r.valor))
                      .map((r, rIdx) => {
                        const numRec = r.numero_recibo ? String(r.numero_recibo).padStart(4, '0') : '—';
                        const concStr = typeof r.concepto === 'string' ? r.concepto : (r.numero_cuota ? `Cuota #${r.numero_cuota}` : 'Abono / Pago');
                        const medStr = typeof r.medio_pago === 'string' ? r.medio_pago : 'Transferencia';
                        return (
                          <tr key={r.numero_recibo || r.id || rIdx} style={{ borderBottom: '1px solid var(--border, #f1f5f9)' }}>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                fontFamily: 'monospace', fontWeight: 800, fontSize: 12,
                                color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                                padding: '2px 8px', borderRadius: 4
                              }}>
                                Nº {numRec}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              <div style={{ fontWeight: 600, color: '#0f172a' }}>{formatDate(r.fecha_pago)}</div>
                              {formatTime(r.hora || r.hora_pago || r.created_at || r.timestamp) && (
                                <div style={{ fontSize: 10.5, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <Clock size={11} style={{ opacity: 0.7 }} />
                                  <span>{formatTime(r.hora || r.hora_pago || r.created_at || r.timestamp)}</span>
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <div style={{ fontWeight: 600, color: '#1e293b' }}>
                                {r.numero_cuota ? `Cuota #${r.numero_cuota}` : 'Abono / Pago'}
                                {r.es_pago_completo ? (
                                  <span style={{ marginLeft: 6, fontSize: 10, color: '#15803d', fontWeight: 700 }}>✓ Total</span>
                                ) : (
                                  <span style={{ marginLeft: 6, fontSize: 10, color: '#d97706', fontWeight: 700 }}>⚠ Parcial</span>
                                )}
                              </div>
                              <div style={{ fontSize: 11, color: '#64748b' }}>{concStr}</div>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 800, color: '#15803d', fontSize: 13 }}>
                              {formatCOP(r.valor)}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <span style={{ fontSize: 10.5, background: '#f1f5f9', padding: '2px 8px', borderRadius: 12, fontWeight: 600 }}>
                                {medStr}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                                {r.anulado ? (
                                  <span
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 800,
                                      color: '#b91c1c',
                                      background: '#fee2e2',
                                      border: '1px solid #fca5a5',
                                      padding: '2px 8px',
                                      borderRadius: 6
                                    }}
                                    title={`Anulado por: ${r.anulado_por || 'Contadora'}. Motivo: ${r.motivo_anulacion || 'Sin motivo'}`}
                                  >
                                    ANULADO
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      className="btn btn-ghost"
                                      style={{
                                        padding: '4px 8px', fontSize: 11,
                                        color: '#15803d', borderColor: '#86efac', background: '#f0fdf4',
                                        fontWeight: 700, gap: 4
                                      }}
                                      onClick={() => onVerRecibo(r)}
                                      title="Ver / Imprimir este recibo oficial"
                                    >
                                      <Eye size={12} /> Ver
                                    </button>

                                    <button
                                      className="btn btn-primary"
                                      style={{
                                        padding: '4px 8px', fontSize: 11,
                                        background: '#16a34a', borderColor: '#16a34a',
                                        fontWeight: 700, gap: 4
                                      }}
                                      onClick={() => onVerRecibo({ ...r, autoDownload: true })}
                                      title="Descargar este recibo oficial en PDF"
                                    >
                                      <Download size={12} /> Descargar PDF
                                    </button>

                                    {permissions?.canDeleteRecibos && (
                                      <button
                                        className="btn btn-ghost"
                                        style={{
                                          padding: '4px 8px', fontSize: 11,
                                          color: '#dc2626', borderColor: '#fca5a5', background: '#fff1f2',
                                          fontWeight: 700, gap: 4
                                        }}
                                        onClick={() => onAnularRecibo(r)}
                                        title="Anular este recibo (solo Contadora o Administrador)"
                                      >
                                        Anular
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

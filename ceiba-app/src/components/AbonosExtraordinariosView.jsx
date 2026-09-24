import React, { useState, useEffect, useCallback } from 'react';
import {
  Zap, RefreshCw, AlertTriangle, CheckCircle2, Eye,
  ChevronDown, ChevronUp, Edit2, Save, X, ArrowRight, Info, ShieldCheck
} from 'lucide-react';
import { detectarAbonosExtraordinarios, aplicarAmortizacion, guardarObservacionCuota } from '../lib/api/abonosApi';
import { formatCOP, formatDate } from '../utils/helpers';
import ModalHistorialAcciones from './ModalHistorialAcciones';

// ─── Badge de nivel ───────────────────────────────────────────────────────────
function NivelBadge({ nivel, cuotas }) {
  const cfg = {
    critico: { bg: '#fee2e2', color: '#dc2626', label: `🔴 Cubre ~${cuotas}x cuotas (Crítico)` },
    alto:    { bg: '#fef3c7', color: '#d97706', label: `🟡 Cubre ~${cuotas}x cuotas (Alto)` },
    moderado:{ bg: '#f0fdf4', color: '#16a34a', label: `🟢 Cubre ~${cuotas}x cuotas` },
  };
  const c = cfg[nivel] || cfg.moderado;
  return (
    <span style={{
      background: c.bg, color: c.color, fontWeight: 700,
      padding: '3px 10px', borderRadius: 20, fontSize: 11, whiteSpace: 'nowrap'
    }}>
      {c.label}
    </span>
  );
}

// ─── Panel de Preview de Amortización ─────────────────────────────────────────
function PreviewAmortizacion({ caso, onConfirmar, onCerrar, aplicando }) {
  const maxCuotas = caso.cuotas_pendientes_amortizar.length;
  const [numCuotasAmortizar, setNumCuotasAmortizar] = useState(maxCuotas);
  const [obsPrincipal, setObsPrincipal] = useState(caso.observacion_sugerida || '');
  const [editandoObs, setEditandoObs] = useState(false);

  const cuotasSeleccionadas = caso.cuotas_pendientes_amortizar.slice(0, numCuotasAmortizar);

  // Determinar si cubre la totalidad de la deuda restante
  const cubreTodaLaDeuda =
    (caso.total_pendientes_contrato > 0 && cuotasSeleccionadas.length >= caso.total_pendientes_contrato) ||
    caso.cubre_totalidad_sugerido;

  const [marcarPagadoTotal, setMarcarPagadoTotal] = useState(cubreTodaLaDeuda);

  useEffect(() => {
    if (cubreTodaLaDeuda) {
      setMarcarPagadoTotal(true);
    }
  }, [cubreTodaLaDeuda]);

  const handleConfirmar = () => {
    onConfirmar({
      cuotasParaAmortizar: cuotasSeleccionadas,
      observacionPrincipal: obsPrincipal.trim() || null,
      marcarPagadoTotal
    });
  };


  return (
    <div style={{
      background: '#f8fafc', border: '2px solid #0ea5e9',
      borderRadius: 12, padding: 20, marginTop: 12
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#0369a1', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Eye size={16} /> Preview de Amortización — {caso.id_lote}
        </div>
        <button onClick={onCerrar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}>
          <X size={16} />
        </button>
      </div>

      {/* Cuota del abono */}
      <div style={{ background: '#dbeafe', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 6 }}>
          📌 Pago Grande Detectado (Cuota {caso.ultima_cuota_num})
        </div>
        <div style={{ display: 'flex', gap: 20, fontSize: 12, flexWrap: 'wrap', marginBottom: 8 }}>
          <span>📅 Fecha: <strong>{caso.fecha_pago}</strong></span>
          <span>💰 Valor: <strong style={{ color: '#1d4ed8' }}>{formatCOP(caso.valor_pagado)}</strong></span>
          <span>📐 Cuota estándar: <strong>{formatCOP(caso.valor_cuota_estandar)}</strong></span>
          <span>✖ Cubre: <strong>{caso.cuotas_que_cubre.toFixed(1)}x cuotas</strong></span>
        </div>

        {/* Observación editable para la cuota principal */}
        <div style={{ marginTop: 8, borderTop: '1px solid #bfdbfe', paddingTop: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1e40af' }}>
              💬 Observación en la Cuota #{caso.ultima_cuota_num}:
            </span>
            <button
              onClick={() => setEditandoObs(!editandoObs)}
              style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <Edit2 size={11} /> {editandoObs ? 'Listo' : 'Modificar texto'}
            </button>
          </div>
          {editandoObs ? (
            <textarea
              value={obsPrincipal}
              onChange={e => setObsPrincipal(e.target.value)}
              rows={2}
              style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid #3b82f6', background: '#fff' }}
            />
          ) : (
            <div style={{ fontSize: 11, color: '#1e3a8a', fontStyle: 'italic', background: '#eff6ff', padding: '6px 10px', borderRadius: 6 }}>
              {obsPrincipal || 'Sin observación'}
            </div>
          )}
        </div>
      </div>

      {/* Selector interactivo de cuotas a amortizar */}
      {maxCuotas > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                ⚙️ Cuotas siguientes a amortizar:
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                La secretaria puede definir exactamente cuántas cuotas cubrir de forma simétrica.
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <select
                value={numCuotasAmortizar}
                onChange={e => setNumCuotasAmortizar(Number(e.target.value))}
                style={{
                  padding: '5px 12px', borderRadius: 6, border: '1px solid #0284c7',
                  fontSize: 12, fontWeight: 700, color: '#0369a1', background: '#f0f9ff'
                }}
              >
                {Array.from({ length: maxCuotas + 1 }, (_, i) => (
                  <option key={i} value={i}>
                    {i === 0 ? '0 (Solo guardar observación)' : `${i} cuota${i > 1 ? 's' : ''} (recomendado: ${Math.min(caso.cuotas_enteras - 1, maxCuotas)})`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Cuotas que se amortizarán */}
      {cuotasSeleccionadas.length > 0 ? (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#059669', marginBottom: 8 }}>
            ✅ {cuotasSeleccionadas.length} cuota(s) que se marcarán como AMORTIZADAS (valor $0, estado PAGA):
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            {cuotasSeleccionadas.map((am) => (
              <div key={am.cuota_id} style={{
                background: '#f0fdf4', border: '1px solid #bbf7d0',
                borderRadius: 8, padding: '8px 12px', fontSize: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                  <span style={{ fontWeight: 700 }}>
                    Cuota #{am.numero_cuota}
                    &nbsp;→&nbsp;
                    <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{am.estado_actual}</span>
                    &nbsp;<ArrowRight size={11} />&nbsp;
                    <span style={{ color: '#16a34a' }}>PAGA ($0 amortizado)</span>
                  </span>
                  <span style={{ color: '#64748b' }}>Venc: {formatDate(am.fecha_vencimiento)}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 10, color: '#047857', fontStyle: 'italic' }}>
                  💬 {am.observacion_nueva}
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12, background: '#fef3c7', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#92400e' }}>
            ⚠️ Esta acción marcará <strong>{cuotasSeleccionadas.length} cuota(s)</strong> como pagadas con valor $0. La cuota original de <strong>{formatCOP(caso.valor_pagado)}</strong> ya fue registrada en la Cuota {caso.ultima_cuota_num}.
          </div>
        </>
      ) : (
        <div style={{ background: '#f1f5f9', borderRadius: 8, padding: 12, fontSize: 12, color: '#475569' }}>
          <Info size={14} style={{ display: 'inline', marginRight: 6 }} />
          No se amortizarán cuotas adicionales. Solo se actualizará la observación en la Cuota #{caso.ultima_cuota_num}.
        </div>
      )}

      {/* Opción de Liquidar Lote como PAGADO EN SU TOTALIDAD */}
      <div style={{
        marginTop: 14,
        padding: '12px 16px',
        borderRadius: 8,
        background: marcarPagadoTotal ? '#ecfdf5' : '#f8fafc',
        border: `1px solid ${marcarPagadoTotal ? '#6ee7b7' : '#cbd5e1'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        transition: 'all 0.2s ease'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22 }}>{marcarPagadoTotal ? '🏆' : '🏷️'}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: marcarPagadoTotal ? '#065f46' : '#1e293b' }}>
              {cubreTodaLaDeuda
                ? '¡Liquidación Total del Contrato!'
                : 'Estado del Lote: ¿Marcar como PAGADO EN SU TOTALIDAD?'}
            </div>
            <div style={{ fontSize: 11, color: marcarPagadoTotal ? '#047857' : '#64748b' }}>
              {marcarPagadoTotal
                ? `El lote ${caso.id_lote} y su contrato pasarán automáticamente a estado "PAGADO EN SU TOTALIDAD".`
                : `Marcará el lote ${caso.id_lote} y su contrato como completamente pagados al confirmar.`}
            </div>
          </div>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, color: marcarPagadoTotal ? '#065f46' : '#475569' }}>
          <input
            type="checkbox"
            checked={marcarPagadoTotal}
            onChange={e => setMarcarPagadoTotal(e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#059669', cursor: 'pointer' }}
          />
          Cambiar Lote a "PAGADO EN SU TOTALIDAD"
        </label>
      </div>

      {/* Botones de acción */}
      <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end' }}>
        <button
          className="btn btn-ghost"
          style={{ fontSize: 13 }}
          onClick={onCerrar}
          disabled={aplicando}
        >
          Cancelar
        </button>
        <button
          className="btn btn-primary"
          style={{ fontSize: 13, background: '#059669', borderColor: '#047857', gap: 8 }}
          onClick={handleConfirmar}
          disabled={aplicando}
        >
          {aplicando ? (
            <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> Aplicando...</>
          ) : (
            <><CheckCircle2 size={14} /> Confirmar y Aplicar Amortización</>
          )}
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

    </div>
  );
}


// ─── Editor de observación ────────────────────────────────────────────────────
function ObservacionEditor({ cuotaId, observacionActual, onSaved }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(observacionActual || '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const handleSave = async () => {
    setGuardando(true);
    setError(null);
    try {
      await guardarObservacionCuota(cuotaId, texto.trim() || null);
      onSaved?.(texto.trim() || null);
      setEditando(false);
    } catch (e) {
      setError('Error al guardar la observación. Intenta de nuevo.');
    } finally {
      setGuardando(false);
    }
  };

  if (!editando) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: texto ? '#374151' : '#94a3b8', fontStyle: texto ? 'normal' : 'italic' }}>
          {texto || 'Sin observación'}
        </span>
        <button
          onClick={() => setEditando(true)}
          style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}
        >
          <Edit2 size={10} /> Editar
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <textarea
        value={texto}
        onChange={e => setTexto(e.target.value)}
        rows={2}
        style={{
          width: '100%', borderRadius: 6, border: '1px solid #3b82f6',
          padding: '6px 10px', fontSize: 12, resize: 'vertical', fontFamily: 'inherit'
        }}
        placeholder="Escribe la observación para esta cuota..."
        autoFocus
      />
      {error && <div style={{ color: '#dc2626', fontSize: 11 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button
          onClick={() => { setEditando(false); setTexto(observacionActual || ''); }}
          style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11 }}
          disabled={guardando}
        >
          <X size={10} /> Cancelar
        </button>
        <button
          onClick={handleSave}
          style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 10px', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}
          disabled={guardando}
        >
          {guardando ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={10} />}
          Guardar
        </button>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Tarjeta de caso ──────────────────────────────────────────────────────────
function CasoCard({ caso: initialCaso, onVerExtracto, onAmortizacionAplicada }) {
  const [caso, setCaso] = useState(initialCaso);
  const [expandido, setExpandido] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const [resultMsg, setResultMsg] = useState(null);

  const handleAplicar = async (customOpts = {}) => {
    setAplicando(true);
    try {
      const result = await aplicarAmortizacion(caso, customOpts);
      setAplicado(true);
      setShowPreview(false);
      setResultMsg(`✅ Amortización aplicada: ${result.cuotas_amortizadas} cuota(s) actualizadas.${result.marcado_pagado_total ? ' 🏆 Lote ' + caso.id_lote + ' y contrato marcados como PAGADO EN SU TOTALIDAD.' : ''}`);
      onAmortizacionAplicada?.();

    } catch (e) {
      setResultMsg(`❌ Error al aplicar: ${e.message}`);
    } finally {
      setAplicando(false);
    }
  };


  const borderColor =
    caso.nivel === 'critico' ? '#dc2626' :
    caso.nivel === 'alto'    ? '#f59e0b' : '#16a34a';

  return (
    <div style={{
      border: `2px solid ${borderColor}22`,
      borderLeft: `4px solid ${borderColor}`,
      borderRadius: 10, background: '#fff',
      padding: '14px 18px', marginBottom: 12
    }}>
      {/* Cabecera del caso */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#1e293b', fontFamily: 'monospace' }}>
              {caso.id_lote}
            </span>
            <NivelBadge nivel={caso.nivel} cuotas={caso.cuotas_enteras} />
            {aplicado && (
              <span style={{ background: '#dcfce7', color: '#16a34a', fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 20 }}>
                ✅ Amortización aplicada
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
            {caso.cliente} — CC {caso.cedula}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: '#0369a1' }}>{formatCOP(caso.valor_pagado)}</div>
            <div style={{ color: '#64748b' }}>Cuota #{caso.ultima_cuota_num} · {caso.fecha_pago}</div>
          </div>
          <button
            onClick={() => setExpandido(v => !v)}
            className="btn btn-ghost"
            style={{ fontSize: 12, gap: 4, padding: '5px 10px' }}
          >
            {expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expandido ? 'Ocultar' : 'Detalle'}
          </button>
          <button
            onClick={() => onVerExtracto?.(caso.venta_id)}
            className="btn btn-ghost"
            style={{ fontSize: 12, gap: 4, padding: '5px 10px', color: '#0369a1', borderColor: '#bae6fd' }}
          >
            <Eye size={13} /> Ver Extracto
          </button>
        </div>
      </div>

      {/* Resumen rápido siempre visible */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap', fontSize: 12 }}>
        <span>📐 Cuota std: <strong>{formatCOP(caso.valor_cuota_estandar)}</strong></span>
        <span>✖ Cubre: <strong>{caso.cuotas_que_cubre.toFixed(1)} cuotas</strong></span>
        <span>📋 Plazo total: <strong>{caso.plazo_total} cuotas</strong></span>
        {caso.cuotas_pendientes_amortizar.length > 0 && (
          <span style={{ color: '#059669' }}>
            🔄 Amortizaría: <strong>{caso.cuotas_pendientes_amortizar.length} cuota(s) pendientes</strong>
          </span>
        )}
      </div>

      {/* Observación de la cuota del abono grande */}
      {expandido && (
        <div style={{ marginTop: 14, borderTop: '1px solid #e2e8f0', paddingTop: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              💬 Observación de la cuota del abono (Cuota #{caso.ultima_cuota_num}):
            </div>
            <ObservacionEditor
              cuotaId={caso.ultima_cuota_id}
              observacionActual={caso.observacion_actual}
              onSaved={(nuevo) => setCaso(c => ({ ...c, observacion_actual: nuevo }))}
            />
          </div>

          {/* Preview de cuotas que se amortizarían */}
          {caso.cuotas_pendientes_amortizar.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                📋 Cuotas pendientes que se amortizarían:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {caso.cuotas_pendientes_amortizar.map(am => (
                  <div key={am.cuota_id} style={{
                    background: '#f0fdf4', border: '1px solid #86efac',
                    borderRadius: 8, padding: '6px 10px', fontSize: 11
                  }}>
                    <div style={{ fontWeight: 700 }}>Cuota #{am.numero_cuota}</div>
                    <div style={{ color: '#64748b' }}>Venc: {formatDate(am.fecha_vencimiento)}</div>
                    <div style={{ color: '#dc2626', textDecoration: 'line-through', fontSize: 10 }}>{am.estado_actual}</div>
                    <div style={{ color: '#16a34a', fontSize: 10 }}>→ PAGA ($0 amortizado)</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botón para ver preview completo + confirmación */}
          {!aplicado && (
            <div style={{ marginTop: 12 }}>
              {!showPreview ? (
                <button
                  className="btn btn-primary"
                  style={{ fontSize: 12, gap: 6, background: '#0ea5e9', borderColor: '#0284c7' }}
                  onClick={() => setShowPreview(true)}
                >
                  <Zap size={13} /> Ver Preview y Aplicar Amortización
                </button>
              ) : (
                <PreviewAmortizacion
                  caso={caso}
                  onConfirmar={handleAplicar}
                  onCerrar={() => setShowPreview(false)}
                  aplicando={aplicando}
                />
              )}
            </div>
          )}

          {resultMsg && (
            <div style={{
              marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: aplicado ? '#dcfce7' : '#fee2e2',
              color: aplicado ? '#15803d' : '#dc2626'
            }}>
              {resultMsg}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Panel Principal ──────────────────────────────────────────────────────────
export default function AbonosExtraordinariosView({ onVerExtracto }) {
  const [casos, setCasos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filtroNivel, setFiltroNivel] = useState('Todos');
  const [refresh, setRefresh] = useState(0);
  const [showHistorialLogs, setShowHistorialLogs] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await detectarAbonosExtraordinarios();
      setCasos(data);
    } catch (e) {
      setError('Error cargando los abonos extraordinarios: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useEffect(() => { cargar(); }, [cargar]);

  const casosFiltrados = casos.filter(c => {
    if (filtroNivel === 'Todos') return true;
    if (filtroNivel === 'Críticos') return c.nivel === 'critico';
    if (filtroNivel === 'Altos') return c.nivel === 'alto';
    if (filtroNivel === 'Moderados') return c.nivel === 'moderado';
    return true;
  });

  const totalAbonos = casos.reduce((s, c) => s + c.valor_pagado, 0);
  const totalAmortizables = casos.reduce((s, c) => s + c.cuotas_pendientes_amortizar.length, 0);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap size={18} color="#f59e0b" /> Abonos Extraordinarios
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            Pagos que cubren 2 o más cuotas mensuales. Revisa y aplica la amortización con vista previa.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            className="btn btn-ghost"
            style={{
              fontSize: 12, gap: 6, padding: '7px 12px', fontWeight: 700,
              color: '#0369a1', borderColor: '#bae6fd', background: '#f0f9ff'
            }}
            onClick={() => setShowHistorialLogs(true)}
            title="Ver registro auditable de acciones y amortizaciones"
          >
            <ShieldCheck size={14} /> 📋 Historial de Acciones
          </button>

          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, gap: 6 }}
            onClick={() => setRefresh(r => r + 1)}
            disabled={loading}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
            Recargar
          </button>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>

      {/* KPIs de resumen */}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: 'Casos Detectados', val: casos.length, color: '#f59e0b', bg: '#fef3c722' },
            { label: 'Cuotas Amortizables', val: totalAmortizables, color: '#059669', bg: '#f0fdf422' },
            { label: 'Valor Total Abonos', val: formatCOP(totalAbonos), color: '#0369a1', bg: '#dbeafe22' },
            { label: 'Casos Críticos (≥6x)', val: casos.filter(c => c.nivel === 'critico').length, color: '#dc2626', bg: '#fee2e222' },
          ].map(kp => (
            <div key={kp.label} style={{
              background: kp.bg, border: `1px solid ${kp.color}33`,
              borderRadius: 10, padding: '10px 14px', textAlign: 'center'
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: kp.color }}>{kp.val}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{kp.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtros de nivel */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['Todos', 'Críticos', 'Altos', 'Moderados'].map(f => (
          <button
            key={f}
            onClick={() => setFiltroNivel(f)}
            style={{
              padding: '5px 14px', borderRadius: 20, border: '1px solid',
              cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: filtroNivel === f ? '#0f172a' : '#fff',
              color: filtroNivel === f ? '#fff' : '#374151',
              borderColor: filtroNivel === f ? '#0f172a' : '#e2e8f0'
            }}
          >
            {f}
            {f !== 'Todos' && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>
                ({casos.filter(c =>
                  f === 'Críticos' ? c.nivel === 'critico' :
                  f === 'Altos' ? c.nivel === 'alto' :
                  c.nivel === 'moderado'
                ).length})
              </span>
            )}
          </button>
        ))}
        <span style={{ fontSize: 12, color: '#94a3b8', alignSelf: 'center', marginLeft: 8 }}>
          Mostrando {casosFiltrados.length} de {casos.length} caso(s)
        </span>
      </div>

      {/* Estado de carga / error / lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Analizando pagos y detectando abonos extraordinarios...
        </div>
      ) : error ? (
        <div style={{ background: '#fee2e2', color: '#dc2626', borderRadius: 8, padding: 16 }}>
          <AlertTriangle size={16} style={{ display: 'inline', marginRight: 8 }} />
          {error}
        </div>
      ) : casosFiltrados.length === 0 ? (
        <div style={{
          background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
          padding: '32px', textAlign: 'center', color: '#64748b'
        }}>
          <CheckCircle2 size={32} color="#16a34a" style={{ display: 'block', margin: '0 auto 12px' }} />
          <div style={{ fontWeight: 700, fontSize: 14 }}>¡Todo en orden!</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            No se encontraron abonos extraordinarios {filtroNivel !== 'Todos' ? `en la categoría "${filtroNivel}"` : ''}.
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
            💡 Haz clic en <strong>"Detalle"</strong> para expandir cada caso, editar observaciones y aplicar la amortización con vista previa.
          </div>
          {casosFiltrados.map(caso => (
            <CasoCard
              key={caso.ultima_cuota_id}
              caso={caso}
              onVerExtracto={onVerExtracto}
              onAmortizacionAplicada={() => setRefresh(r => r + 1)}
            />
          ))}
        </div>
      )}

      {showHistorialLogs && (
        <ModalHistorialAcciones
          onClose={() => setShowHistorialLogs(false)}
        />
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Edit2, X, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import { formatCOP } from '../utils/helpers';
import { actualizarCuotaManual } from '../lib/api/cuotas';
import { registrarAccion } from '../lib/api/auditApi';

const ESTADOS_VALIDOS = ['AL DÍA', 'POR VENCER', 'VENCIDA', 'PAGA', 'ABONO AL DÍA', 'ABONO EN MORA'];
const MEDIOS_PAGO = ['TRANSFERENCIA', 'EFECTIVO', 'CONSIGNACIÓN', 'CHEQUE', 'DATÁFONO', 'OTRO'];
const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export default function ModalEditarCuota({ cuota, onClose, onSuccess }) {
  const isMultipleActual = cuota?.observacion?.toUpperCase().includes('PAGO MÚLTIPLE') || false;
  let mesDetectado = MESES[0];
  if (isMultipleActual) {
    for (const m of MESES) {
      if (cuota?.observacion?.toUpperCase().includes(m)) {
        mesDetectado = m;
        break;
      }
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const isVencidaInit = cuota?.fecha_vencimiento && String(cuota.fecha_vencimiento).slice(0, 10) < todayStr;
  const isAbonoInicial = (cuota?.estado_cuota !== 'PAGA' && (Number(cuota?.valor_pagado) || 0) > 0);
  const estadoInicial = isAbonoInicial
    ? (isVencidaInit || cuota?.estado_cuota === 'VENCIDA' ? 'ABONO EN MORA' : 'ABONO AL DÍA')
    : (cuota?.estado_cuota || 'AL DÍA');

  const [numeroCuota, setNumeroCuota] = useState(cuota?.numero_cuota || 1);
  const [fechaVencimiento, setFechaVencimiento] = useState(cuota?.fecha_vencimiento || '');
  const [valorCuota, setValorCuota] = useState(cuota?.valor_cuota || '');
  const [estadoCuota, setEstadoCuota] = useState(estadoInicial);
  const [fechaPago, setFechaPago] = useState(cuota?.fecha_pago || '');
  const [valorPagado, setValorPagado] = useState(cuota?.valor_pagado || '');
  const [medioPago, setMedioPago] = useState(cuota?.medio_pago || 'TRANSFERENCIA');
  const [esPagoMultiple, setEsPagoMultiple] = useState(isMultipleActual);
  const [mesMultiple, setMesMultiple] = useState(mesDetectado);
  const [observacion, setObservacion] = useState(cuota?.observacion || '');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let fechaFinal = esPagoMultiple ? null : (fechaPago || null);
      let obsFinal = observacion ? observacion.trim() : '';

      if (esPagoMultiple) {
        const tag = `PAGO MÚLTIPLE - ${mesMultiple}`;
        if (!obsFinal.includes(tag)) {
          obsFinal = obsFinal ? `${tag} | ${obsFinal}` : tag;
        }
      }

      let estadoDb = estadoCuota;
      if (estadoCuota === 'ABONO AL DÍA' || estadoCuota === 'ABONO') {
        const todayStr = new Date().toISOString().slice(0, 10);
        estadoDb = (fechaVencimiento && fechaVencimiento < todayStr) ? 'VENCIDA' : 'AL DÍA';
      } else if (estadoCuota === 'ABONO EN MORA') {
        estadoDb = 'VENCIDA';
      }

      await actualizarCuotaManual(cuota.id, {
        numero_cuota: Number(numeroCuota),
        fecha_vencimiento: fechaVencimiento || null,
        valor_cuota: Number(valorCuota) || 0,
        estado_cuota: estadoDb,
        fecha_pago: fechaFinal,
        valor_pagado: Number(valorPagado) || 0,
        medio_pago: medioPago || null,
        observacion: obsFinal || null
      });

      // Registrar en el Log de Auditoría
      try {
        await registrarAccion({
          modulo: 'CUOTAS',
          accion: 'CUOTA_EDITADA_MANUALMENTE',
          lote_id_str: cuota?.id_lote || cuota?.lote_id_str || `Venta #${cuota.venta_id}`,
          descripcion: `Edición de cuota #${numeroCuota}: Estado a "${estadoCuota}", pagado: $${Number(valorPagado || 0).toLocaleString('es-CO')}, fecha: ${fechaFinal || 'Sin fecha'}`
        });
      } catch (logErr) {
        console.warn('Aviso guardando log de cuota:', logErr);
      }

      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error actualizando la cuota');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={540}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Edit2 size={16} color="var(--accent)" />
          Ajuste Manual — Cuota #{cuota?.numero_cuota}
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="alert-banner red" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}># Cuota:</label>
            <input
              type="number"
              className="search-input"
              value={numeroCuota}
              onChange={e => setNumeroCuota(e.target.value)}
              required
              min="1"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Fecha Vencimiento:</label>
            <input
              type="date"
              className="search-input"
              value={fechaVencimiento}
              onChange={e => setFechaVencimiento(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Valor Cuota ($ COP):</label>
            <input
              type="number"
              className="search-input"
              value={valorCuota}
              onChange={e => setValorCuota(e.target.value)}
              required
            />
            {valorCuota > 0 && (
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(valorCuota)}</span>
            )}
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Estado de la Cuota:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 6 }}>
              <button
                type="button"
                onClick={() => setEstadoCuota('PAGA')}
                style={{
                  padding: '5px 4px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: estadoCuota === 'PAGA' ? '2px solid #22c55e' : '1px solid var(--border)',
                  background: estadoCuota === 'PAGA' ? 'rgba(34, 197, 94, 0.2)' : 'var(--bg-card)',
                  color: estadoCuota === 'PAGA' ? '#22c55e' : 'var(--text-muted)'
                }}
              >
                ✓ PAGA
              </button>
              <button
                type="button"
                onClick={() => setEstadoCuota('ABONO AL DÍA')}
                style={{
                  padding: '5px 4px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: estadoCuota === 'ABONO AL DÍA' ? '2px solid #f59e0b' : '1px solid var(--border)',
                  background: estadoCuota === 'ABONO AL DÍA' ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-card)',
                  color: estadoCuota === 'ABONO AL DÍA' ? '#d97706' : 'var(--text-muted)'
                }}
              >
                🟡 ABONO AL DÍA
              </button>
              <button
                type="button"
                onClick={() => setEstadoCuota('ABONO EN MORA')}
                style={{
                  padding: '5px 4px',
                  fontSize: 10.5,
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: estadoCuota === 'ABONO EN MORA' ? '2px solid #ef4444' : '1px solid var(--border)',
                  background: estadoCuota === 'ABONO EN MORA' ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-card)',
                  color: estadoCuota === 'ABONO EN MORA' ? '#dc2626' : 'var(--text-muted)'
                }}
              >
                🔴 ABONO EN MORA
              </button>
            </div>
            <select
              className="search-input"
              value={estadoCuota}
              onChange={e => setEstadoCuota(e.target.value)}
              style={{ width: '100%' }}
            >
              {ESTADOS_VALIDOS.map(est => <option key={est} value={est}>{est}</option>)}
            </select>
          </div>
        </div>

        {/* Datos del pago */}
        <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            💳 Información del Pago
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={esPagoMultiple}
                onChange={e => setEsPagoMultiple(e.target.checked)}
              />
              <span>Es Pago Múltiple (Registrado solo por mes)</span>
            </label>
          </div>

          {esPagoMultiple ? (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Mes de Pago:</label>
              <select
                className="search-input"
                value={mesMultiple}
                onChange={e => setMesMultiple(e.target.value)}
                style={{ width: '100%' }}
              >
                {MESES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Fecha de Pago:</label>
              <input
                type="date"
                className="search-input"
                value={fechaPago}
                onChange={e => setFechaPago(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Valor Pagado ($):</label>
              <input
                type="number"
                className="search-input"
                value={valorPagado}
                onChange={e => setValorPagado(e.target.value)}
                style={{ width: '100%' }}
              />
              {valorPagado > 0 && (
                <span style={{ fontSize: 10, color: '#16a34a' }}>{formatCOP(valorPagado)}</span>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Medio de Pago:</label>
              <select
                className="search-input"
                value={medioPago}
                onChange={e => setMedioPago(e.target.value)}
                style={{ width: '100%' }}
              >
                {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Observación / Ajuste:</label>
          <input
            type="text"
            className="search-input"
            value={observacion}
            onChange={e => setObservacion(e.target.value)}
            style={{ width: '100%' }}
            placeholder="Ej: Descuento asesor, permuta, corrección..."
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Ajuste'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

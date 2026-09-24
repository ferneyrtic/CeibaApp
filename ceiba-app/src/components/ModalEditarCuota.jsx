import React, { useState } from 'react';
import { Edit2, X, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import { formatCOP } from '../utils/helpers';
import { actualizarCuotaManual } from '../lib/api/cuotas';
import { registrarAccion } from '../lib/api/auditApi';

const ESTADOS_VALIDOS = ['AL DÍA', 'POR VENCER', 'VENCIDA', 'PAGA'];
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

  const [numeroCuota, setNumeroCuota] = useState(cuota?.numero_cuota || 1);
  const [fechaVencimiento, setFechaVencimiento] = useState(cuota?.fecha_vencimiento || '');
  const [valorCuota, setValorCuota] = useState(cuota?.valor_cuota || '');
  const [estadoCuota, setEstadoCuota] = useState(cuota?.estado_cuota || 'AL DÍA');
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

      await actualizarCuotaManual(cuota.id, {
        numero_cuota: Number(numeroCuota),
        fecha_vencimiento: fechaVencimiento || null,
        valor_cuota: Number(valorCuota) || 0,
        estado_cuota: estadoCuota,
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
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
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

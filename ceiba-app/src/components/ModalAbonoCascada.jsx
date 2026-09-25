import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, CheckCircle, AlertCircle, Calendar, ArrowRight, X } from 'lucide-react';
import Modal from './Modal';
import SelectorLoteBuscador from './SelectorLoteBuscador';
import { formatCOP, formatDate } from '../utils/helpers';
import { simularAbonoCascada, registrarAbonoCascada, getCuotasByVenta } from '../lib/api/cuotas';

const MESES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
];

const MEDIOS_PAGO = [
  'TRANSFERENCIA', 'EFECTIVO', 'CONSIGNACIÓN', 'CHEQUE', 'DATÁFONO', 'OTRO'
];

export default function ModalAbonoCascada({ venta, ventaPreseleccionada, allVentas = [], onClose, onSuccess }) {
  const initialVenta = venta || ventaPreseleccionada;
  const [selectedVentaId, setSelectedVentaId] = useState(initialVenta?.id || initialVenta?.venta_id || '');
  const [cuotas, setCuotas] = useState([]);
  const [loadingCuotas, setLoadingCuotas] = useState(false);

  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [esPagoMultiple, setEsPagoMultiple] = useState(false);
  const [mesMultiple, setMesMultiple] = useState(MESES[new Date().getMonth()]);
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA');
  const [observacion, setObservacion] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Sincronizar si cambia initialVenta
  useEffect(() => {
    const vid = initialVenta?.id || initialVenta?.venta_id;
    if (vid) {
      setSelectedVentaId(vid);
    }
  }, [initialVenta]);

  // Venta actual seleccionada
  const currentVenta = useMemo(() => {
    if (initialVenta && (initialVenta.id === selectedVentaId || initialVenta.venta_id === selectedVentaId)) {
      return initialVenta;
    }
    return allVentas.find(v => v.id === selectedVentaId || v.venta_id === selectedVentaId) || initialVenta;
  }, [initialVenta, allVentas, selectedVentaId]);

  // Cargar cuotas cuando cambia la venta seleccionada
  useEffect(() => {
    if (!selectedVentaId) return;
    let active = true;
    setLoadingCuotas(true);
    getCuotasByVenta(selectedVentaId)
      .then(data => {
        if (active) setCuotas(data);
      })
      .catch(err => {
        if (active) setError('Error cargando cuotas del contrato');
      })
      .finally(() => {
        if (active) setLoadingCuotas(false);
      });
    return () => { active = false; };
  }, [selectedVentaId]);

  // Simulación en tiempo real
  const simulacion = useMemo(() => {
    const num = Number(monto) || 0;
    if (num <= 0 || cuotas.length === 0) return null;
    return simularAbonoCascada(cuotas, num);
  }, [cuotas, monto]);

  // Resumen del impacto del abono
  const cuotasPagasCount = useMemo(() => {
    return simulacion?.afectaciones?.filter(a => a.completo).length || 0;
  }, [simulacion]);

  const cuotaParcial = useMemo(() => {
    return simulacion?.afectaciones?.find(a => !a.completo) || null;
  }, [simulacion]);

  const totalCuotasPendientes = useMemo(() => {
    return cuotas.filter(c => c.estado_cuota !== 'PAGA' || (Number(c.valor_pagado) || 0) < (Number(c.valor_cuota) || 0)).length;
  }, [cuotas]);

  const saldaraTodo = useMemo(() => {
    if (!simulacion || totalCuotasPendientes === 0) return false;
    return cuotasPagasCount >= totalCuotasPendientes || (simulacion.montoSobrante > 0 && cuotasPagasCount > 0);
  }, [simulacion, cuotasPagasCount, totalCuotasPendientes]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const montoNum = Number(monto);
    if (!montoNum || montoNum <= 0) {
      setError('Por favor ingresa un monto válido a abonar');
      return;
    }

    setSaving(true);
    try {
      await registrarAbonoCascada({
        ventaId: selectedVentaId,
        monto: montoNum,
        fechaPago,
        medioPago,
        observacion,
        esPagoMultiple,
        mesMultiple
      });
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error registrando el abono');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={20} color="#16a34a" />
            Registrar Abono / Pago con Imputación Automática
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            El sistema distribuye el dinero cronológicamente cubriendo cuotas vencidas y por vencer.
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6 }}>
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="alert-banner red" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Selector de Contrato con Buscador Interactivo */}
        {!venta && allVentas.length > 0 && (
          <SelectorLoteBuscador
            ventas={allVentas.filter(v => (v.saldo || 0) > 0 || v.estado === 'VENDIDO')}
            selectedVentaId={selectedVentaId}
            onSelect={(v) => setSelectedVentaId(v ? (v.id || v.venta_id) : '')}
            label="Contrato / Lote:"
            placeholder="Buscar por lote (ej. LC1 - 7 - 19) o cliente..."
          />
        )}

        {/* Info del contrato actual */}
        {currentVenta && (
          <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
              <div>
                <strong>{currentVenta.id_lote || currentVenta.lotes?.id_lote}</strong> — {currentVenta.cliente_nombre || currentVenta.clientes?.nombre}
              </div>
              <div style={{ color: (currentVenta.saldo || 0) > 0 ? '#d97706' : '#16a34a', fontWeight: 700 }}>
                Saldo Pendiente: {formatCOP(currentVenta.saldo)}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 16 }}>
              <span>Cuota pactada: {formatCOP(currentVenta.valor_cuota)}</span>
              <span>Días de pago: {currentVenta.dias_pago || '—'}</span>
              <span>Cuotas vencidas: <strong style={{ color: '#dc2626' }}>{currentVenta.cuotas_vencidas || 0}</strong></span>
            </div>
          </div>
        )}

        {/* Campo de Monto */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>
            Monto del Abono ($ COP):
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%', fontSize: 15, fontWeight: 700, paddingLeft: 12 }}
              placeholder="Ej: 1500000"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              required
              min="1000"
            />
          </div>
          {monto > 0 && (
            <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, marginTop: 4 }}>
              {formatCOP(monto)}
            </div>
          )}
        </div>

        {/* Toggle Pago Múltiple vs Fecha Exacta */}
        <div style={{ marginBottom: 14, background: '#fdf8f0', border: '1px solid #fed7aa', borderRadius: 8, padding: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={esPagoMultiple}
              onChange={e => setEsPagoMultiple(e.target.checked)}
            />
            <span>¿Es un Pago Múltiple / Sin día exacto? (Registrar mes en vez de fecha)</span>
          </label>

          {esPagoMultiple ? (
            <div style={{ marginTop: 10, display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Mes del Pago:</label>
                <select
                  value={mesMultiple}
                  onChange={e => setMesMultiple(e.target.value)}
                  className="search-input"
                  style={{ width: '100%' }}
                >
                  {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 2 }}>Fecha de Pago:</label>
              <input
                type="date"
                className="search-input"
                style={{ width: '100%' }}
                value={fechaPago}
                onChange={e => setFechaPago(e.target.value)}
                required={!esPagoMultiple}
              />
            </div>
          )}
        </div>

        {/* Medio de pago y Observación */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Medio de Pago:</label>
            <select
              value={medioPago}
              onChange={e => setMedioPago(e.target.value)}
              className="search-input"
              style={{ width: '100%' }}
            >
              {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 4 }}>Observación / Detalle:</label>
            <input
              type="text"
              className="search-input"
              style={{ width: '100%' }}
              placeholder="Ej: Consignación Bancolombia..."
              value={observacion}
              onChange={e => setObservacion(e.target.value)}
            />
          </div>
        </div>

        {/* Vista previa en vivo de la imputación */}
        {simulacion && simulacion.afectaciones.length > 0 && (
          <div style={{
            marginBottom: 16,
            background: '#f0fdf4',
            border: '2px solid #16a34a',
            borderRadius: 10,
            padding: 14,
            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.1)'
          }}>
            {/* Resumen principal llamativo de cuántas cuotas se pagarán */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 10,
              paddingBottom: 8,
              borderBottom: '1px solid #bbf7d0',
              flexWrap: 'wrap',
              gap: 8
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle size={16} color="#16a34a" />
                  IMPACTO DEL ABONO ({formatCOP(monto)}):
                </div>
                <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>
                  Cuota estándar: <strong>{formatCOP(currentVenta?.valor_cuota)}</strong>
                </div>
              </div>
              <div style={{
                background: '#15803d',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: 12,
                padding: '4px 12px',
                borderRadius: 20,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                ⚡ {cuotasPagasCount} CUOTA{cuotasPagasCount !== 1 ? 'S' : ''} PAGADA{cuotasPagasCount !== 1 ? 'S' : ''} AL 100%
                {cuotaParcial && ` + 1 PARCIAL`}
              </div>
            </div>

            {/* Aviso si el abono cubre 2 o más cuotas */}
            {cuotasPagasCount >= 2 && (
              <div style={{
                background: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 10,
                fontSize: 12,
                color: '#1e40af',
                fontWeight: 600
              }}>
                💡 Este abono supera la cuota mensual y liquidará cronológicamente <strong>{cuotasPagasCount} cuotas completas</strong> del contrato.
              </div>
            )}

            {/* Aviso si salda todo el contrato */}
            {saldaraTodo && (
              <div style={{
                background: '#fef3c7',
                border: '1px solid #f59e0b',
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 10,
                fontSize: 12,
                color: '#92400e',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}>
                🏆 ¡Con este abono se salda el 100% de las cuotas pendientes! El lote cambiará automáticamente a <strong>PAGADO EN SU TOTALIDAD</strong>.
              </div>
            )}

            {/* Lista detallada cuota por cuota */}
            <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {simulacion.afectaciones.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, background: 'white', padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0' }}>
                  <div>
                    <strong>Cuota #{a.numero_cuota}</strong> ({formatDate(a.fecha_vencimiento)})
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: '#475569' }}>Abona: <strong>{formatCOP(a.valor_abono)}</strong></span>
                    <ArrowRight size={12} color="#64748b" />
                    <span className="badge" style={{
                      background: a.completo ? '#dcfce7' : '#fef9c3',
                      color: a.completo ? '#15803d' : '#a16207',
                      fontWeight: 700
                    }}>
                      {a.completo ? 'PAGA AL 100%' : `ABONO PARCIAL (${Math.round((a.nuevo_pagado / a.valor_cuota) * 100)}%)`}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {simulacion.montoSobrante > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#0284c7', fontWeight: 600 }}>
                ℹ️ Saldo a favor sobrante: {formatCOP(simulacion.montoSobrante)} (Cubre todo el plan)
              </div>
            )}
          </div>
        )}


        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || !currentVenta}>
            {saving ? 'Procesando abono...' : 'Confirmar Abono'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

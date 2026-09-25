import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, CheckCircle2, AlertCircle, Calendar, Receipt, X, ArrowRight, Eye, ShieldCheck } from 'lucide-react';
import Modal from './Modal';
import SelectorLoteBuscador from './SelectorLoteBuscador';
import ReciboCajaView from './ReciboCajaView';
import { formatCOP, formatDate } from '../utils/helpers';
import { getCuotasByVenta } from '../lib/api/cuotas';
import {
  obtenerSiguienteNumeroRecibo,
  registrarPagoConRecibo,
  obtenerRecibosPorVenta
} from '../lib/api/recibosApi';
import { useAuth } from '../context/AuthContext';

const MEDIOS_PAGO = [
  'TRANSFERENCIA', 'CONSIGNACIÓN', 'EFECTIVO', 'DATÁFONO', 'CHEQUE', 'OTRO'
];

export default function ModalRegistrarPagoRecibo({
  venta = null,
  cuotaPreseleccionada = null,
  allVentas = [],
  onClose,
  onSuccess
}) {
  const { user } = useAuth();
  const [selectedVenta, setSelectedVenta] = useState(venta);
  const [cuotas, setCuotas] = useState([]);
  const [recibosPrevios, setRecibosPrevios] = useState([]);
  const [loadingCuotas, setLoadingCuotas] = useState(false);

  // Formulario de Pago
  const [selectedCuotaId, setSelectedCuotaId] = useState(cuotaPreseleccionada?.id || '');
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));
  const [ciudad, setCiudad] = useState('Bogotá D.C.');
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA');
  const [observaciones, setObservaciones] = useState('');
  const [conceptoManual, setConceptoManual] = useState('');

  const [proximoReciboNum, setProximoReciboNum] = useState(3175);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Recibo recién emitido para mostrar en pantalla
  const [reciboGenerado, setReciboGenerado] = useState(null);

  // Cargar consecutivo próximo
  useEffect(() => {
    obtenerSiguienteNumeroRecibo().then(setProximoReciboNum);
  }, []);

  // Cargar cuotas y recibos cuando cambia la venta seleccionada
  useEffect(() => {
    const vid = selectedVenta?.id || selectedVenta?.venta_id;
    if (!vid) {
      setCuotas([]);
      setRecibosPrevios([]);
      return;
    }

    let active = true;
    setLoadingCuotas(true);

    Promise.all([
      getCuotasByVenta(vid),
      obtenerRecibosPorVenta(vid)
    ])
      .then(([cData, rData]) => {
        if (!active) return;
        setCuotas(cData || []);
        setRecibosPrevios(rData || []);

        // Si vino cuota preseleccionada, mantenerla; sino preseleccionar la primera pendiente
        if (cuotaPreseleccionada?.id) {
          setSelectedCuotaId(cuotaPreseleccionada.id);
        } else {
          const primeraPendiente = (cData || []).find(
            c => c.estado_cuota !== 'PAGA' || (Number(c.valor_pagado) || 0) < (Number(c.valor_cuota) || 0)
          );
          if (primeraPendiente) {
            setSelectedCuotaId(primeraPendiente.id);
          }
        }
      })
      .catch(err => {
        console.error('Error cargando datos de cuotas:', err);
      })
      .finally(() => {
        if (active) setLoadingCuotas(false);
      });

    return () => { active = false; };
  }, [selectedVenta, cuotaPreseleccionada]);

  // Cuota seleccionada actualmente
  const currentCuota = useMemo(() => {
    if (!selectedCuotaId) return null;
    return cuotas.find(c => c.id === selectedCuotaId) || null;
  }, [cuotas, selectedCuotaId]);

  // Saldo pendiente de la cuota seleccionada
  const saldoPendienteCuota = useMemo(() => {
    if (!currentCuota) return 0;
    const vTotal = Number(currentCuota.valor_cuota) || 0;
    const yaPag = Number(currentCuota.valor_pagado) || 0;
    return Math.max(0, vTotal - yaPag);
  }, [currentCuota]);

  // Recibos existentes para la cuota seleccionada
  const recibosDeEstaCuota = useMemo(() => {
    if (!selectedCuotaId) return [];
    return recibosPrevios.filter(r => r.cuota_id === selectedCuotaId);
  }, [recibosPrevios, selectedCuotaId]);

  // Pre-llenar monto con el saldo pendiente cuando cambia la cuota
  useEffect(() => {
    if (saldoPendienteCuota > 0) {
      setMonto(String(saldoPendienteCuota));
    }
  }, [saldoPendienteCuota]);

  // Cálculo del impacto en tiempo real
  const montoNum = Math.round(Number(monto) || 0);
  const esPagoTotal = currentCuota ? montoNum >= saldoPendienteCuota : false;
  const nuevoSaldoCuota = currentCuota ? Math.max(0, saldoPendienteCuota - montoNum) : 0;

  // Manejar el submit del pago
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const vid = selectedVenta?.id || selectedVenta?.venta_id;
    if (!vid) {
      setError('Debes seleccionar un contrato o lote.');
      return;
    }

    if (!montoNum || montoNum <= 0) {
      setError('Por favor ingresa un monto válido mayor a cero.');
      return;
    }

    setSaving(true);
    try {
      const loteStr = selectedVenta.id_lote || selectedVenta.lotes?.id_lote || '';
      const cliNom = selectedVenta.cliente_nombre || selectedVenta.clientes?.nombre || '';
      const cliDoc = selectedVenta.clientes?.doc_cliente || selectedVenta.doc_cliente || '';

      const res = await registrarPagoConRecibo({
        ventaId: vid,
        cuotaId: selectedCuotaId || null,
        monto: montoNum,
        fechaPago,
        medioPago,
        concepto: conceptoManual.trim() || undefined,
        observaciones: observaciones.trim() || undefined,
        registradoPor: user?.email || 'Secretaría',
        ciudad: ciudad.trim() || 'Bogotá D.C.',
        loteIdStr: loteStr,
        clienteNombre: cliNom,
        clienteDoc: cliDoc
      });

      // Abrir recibo generado en pantalla
      setReciboGenerado(res.recibo);

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error registrando el pago y emitiendo el recibo');
    } finally {
      setSaving(false);
    }
  };

  // Si ya se generó el recibo, mostrar vista de recibo imprimible
  if (reciboGenerado) {
    return (
      <ReciboCajaView
        recibo={reciboGenerado}
        onClose={() => {
          setReciboGenerado(null);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal onClose={onClose} maxWidth={640}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={20} color="#16a34a" />
            Registrar Pago y Emitir Recibo de Caja
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Genera automáticamente el comprobante oficial consecutivo <strong>Nº {proximoReciboNum}</strong>.
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {error && (
        <div className="alert-banner red" style={{ marginBottom: 14 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. SELECTOR / BUSCADOR INTERACTIVO DE LOTE */}
        <SelectorLoteBuscador
          ventas={allVentas}
          selectedVentaId={selectedVenta?.id || selectedVenta?.venta_id}
          onSelect={setSelectedVenta}
          disabled={Boolean(venta)}
          label="1. Buscar Contrato / Lote:"
          placeholder="Escribe el lote (ej. LC1 - 7 - 19) o nombre del cliente..."
        />

        {/* 2. SI HAY LOTE, SELECCIONAR CUOTA */}
        {selectedVenta && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 5, color: '#334155' }}>
              2. Seleccionar Cuota a la que se Imputa el Pago:
            </label>

            {loadingCuotas ? (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 8 }}>
                Cargando cuotas del contrato...
              </div>
            ) : cuotas.length === 0 ? (
              <div style={{ padding: 12, fontSize: 12, color: '#d97706', background: '#fef3c7', borderRadius: 8 }}>
                Este contrato no tiene cuotas registradas aún.
              </div>
            ) : (
              <select
                className="search-input"
                style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
                value={selectedCuotaId}
                onChange={(e) => setSelectedCuotaId(e.target.value)}
                required
              >
                <option value="">Selecciona la cuota...</option>
                {cuotas.map((c) => {
                  const yaPag = Number(c.valor_pagado) || 0;
                  const vTotal = Number(c.valor_cuota) || 0;
                  const pendiente = Math.max(0, vTotal - yaPag);
                  const pagada = c.estado_cuota === 'PAGA' && pendiente <= 0;

                  return (
                    <option key={c.id} value={c.id} style={{ color: pagada ? '#94a3b8' : '#0f172a' }}>
                      Cuota #{c.numero_cuota} (Vence: {formatDate(c.fecha_vencimiento)}) — Valor: {formatCOP(vTotal)}
                      {yaPag > 0 ? ` (Abonado: ${formatCOP(yaPag)} · Falta: ${formatCOP(pendiente)})` : ''}
                      {pagada ? ' — [PAGADA]' : ''}
                    </option>
                  );
                })}
              </select>
            )}

            {/* Historial de recibos existentes en esta cuota */}
            {recibosDeEstaCuota.length > 0 && (
              <div style={{
                marginTop: 8,
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 11.5,
                color: '#1e40af'
              }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  🧾 {recibosDeEstaCuota.length} Recibo(s) previo(s) emitido(s) en esta cuota:
                </div>
                {recibosDeEstaCuota.map(r => (
                  <div key={r.numero_recibo} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                    <span>Recibo Nº <strong>{r.numero_recibo}</strong> el {formatDate(r.fecha_pago)} ({r.medio_pago || 'Transferencia'}):</span>
                    <strong style={{ color: '#16a34a' }}>{formatCOP(r.valor)}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 3. CAMPOS DEL PAGO */}
        {selectedVenta && currentCuota && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
              {/* Monto a pagar */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Valor del Pago / Abono ($) <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontWeight: 800, color: '#16a34a' }}>$</span>
                  <input
                    type="number"
                    className="search-input"
                    style={{ width: '100%', paddingLeft: 26, fontWeight: 700, fontSize: 15, color: '#15803d' }}
                    placeholder="Monto en COP"
                    value={monto}
                    onChange={(e) => setMonto(e.target.value)}
                    required
                    min="1"
                  />
                </div>
                {/* Diagnóstico del pago */}
                <div style={{ fontSize: 11, marginTop: 4, fontWeight: 600 }}>
                  {montoNum > 0 && (
                    esPagoTotal ? (
                      <span style={{ color: '#15803d' }}>
                        ✓ Pago completo de la cuota #{currentCuota.numero_cuota}.
                      </span>
                    ) : (
                      <span style={{ color: '#d97706' }}>
                        ⚠ Abono parcial: quedará debiendo {formatCOP(nuevoSaldoCuota)}.
                      </span>
                    )
                  )}
                </div>
              </div>

              {/* Fecha de Pago */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Fecha Real de Pago <span style={{ color: '#dc2626' }}>*</span>
                </label>
                <input
                  type="date"
                  className="search-input"
                  style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  required
                />
                <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 4 }}>
                  Fecha contable para el Cierre de Caja
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 12 }}>
              {/* Medio de pago */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Canal / Medio de Pago
                </label>
                <select
                  className="search-input"
                  style={{ width: '100%', fontSize: 13 }}
                  value={medioPago}
                  onChange={(e) => setMedioPago(e.target.value)}
                >
                  {MEDIOS_PAGO.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Ciudad */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#334155' }}>
                  Ciudad del Recibo
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', fontSize: 13 }}
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="Ej. Bogotá D.C."
                />
              </div>
            </div>

            {/* Observaciones / Referencia Bancaria */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#334155' }}>
                Observaciones / Referencia Bancaria
              </label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', fontSize: 12.5 }}
                placeholder="Ej. Consignación Banco de Bogotá comprobante #48192"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
              />
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onClose}
                disabled={saving}
              >
                Cancelar
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  background: '#16a34a',
                  borderColor: '#16a34a',
                  gap: 8,
                  padding: '8px 18px',
                  fontWeight: 800,
                  fontSize: 13
                }}
                disabled={saving || !selectedVenta || !currentCuota || montoNum <= 0}
              >
                <Receipt size={16} />
                {saving ? 'Emitiendo Recibo...' : `Emitir Recibo Nº ${proximoReciboNum} y Guardar`}
              </button>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

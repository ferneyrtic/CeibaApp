import React, { useState, useEffect, useMemo } from 'react';
import {
  DollarSign, CheckCircle2, AlertCircle, Calendar, Receipt, X, ArrowRight,
  Eye, Download, CreditCard, Building2, Wallet, ArrowDownCircle, Layers
} from 'lucide-react';
import Modal from './Modal';
import SelectorLoteBuscador from './SelectorLoteBuscador';
import ReciboCajaView from './ReciboCajaView';
import { formatCOP, formatDate } from '../utils/helpers';
import { formatearLoteDescripcion } from '../utils/formatoLote';
import { getCuotasByVenta, simularAbonoCascada } from '../lib/api/cuotas';
import {
  obtenerSiguienteNumeroRecibo,
  registrarPagoConRecibo,
  obtenerRecibosPorVenta
} from '../lib/api/recibosApi';
import { useAuth } from '../context/AuthContext';

const CUENTAS_BANCARIAS = ['Bancolombia', 'Davivienda', 'Nequi'];

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

  // Modo de imputación: 'cuota' (específica) o 'cascada' (automática)
  const [modoImputacion, setModoImputacion] = useState(cuotaPreseleccionada ? 'cuota' : 'cascada');
  const [selectedCuotaId, setSelectedCuotaId] = useState(cuotaPreseleccionada?.id || '');

  // Formulario
  const [monto, setMonto] = useState('');
  const [fechaPago, setFechaPago] = useState(new Date().toISOString().slice(0, 10));

  // Medios de pago: ÚNICAMENTE EFECTIVO o TRANSFERENCIA
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA');
  const [banco, setBanco] = useState('Bancolombia');
  const [subTipoEfectivo, setSubTipoEfectivo] = useState('OFICINA'); // 'OFICINA' | 'CONSIGNACION'
  const [referenciaPago, setReferenciaPago] = useState('');

  // Concepto y Observaciones editables
  const [conceptoManual, setConceptoManual] = useState('');
  const [observacionesManual, setObservacionesManual] = useState('');
  const [conceptoModificado, setConceptoModificado] = useState(false);
  const [obsModificada, setObsModificada] = useState(false);

  const [proximoReciboNum, setProximoReciboNum] = useState(3175);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Recibo recién emitido para auto-descarga y previsualización
  const [reciboGenerado, setReciboGenerado] = useState(null);

  // Cargar consecutivo próximo
  useEffect(() => {
    obtenerSiguienteNumeroRecibo().then(setProximoReciboNum);
  }, []);

  // Sincronizar si cambia prop venta
  useEffect(() => {
    if (venta) setSelectedVenta(venta);
  }, [venta]);

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

        // Si vino cuota preseleccionada, mantenerla y usar modo 'cuota'
        if (cuotaPreseleccionada?.id) {
          setSelectedCuotaId(cuotaPreseleccionada.id);
          setModoImputacion('cuota');
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

  // Cuotas pendientes de pago ordenadas cronológicamente
  const cuotasPendientes = useMemo(() => {
    return cuotas
      .filter(c => c.estado_cuota !== 'PAGA' || (Number(c.valor_pagado) || 0) < (Number(c.valor_cuota) || 0))
      .sort((a, b) => a.numero_cuota - b.numero_cuota);
  }, [cuotas]);

  // Cuota seleccionada actualmente (modo cuota individual)
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

  // Pre-llenar monto si está en modo cuota
  useEffect(() => {
    if (modoImputacion === 'cuota' && saldoPendienteCuota > 0 && !monto) {
      setMonto(String(saldoPendienteCuota));
    }
  }, [modoImputacion, saldoPendienteCuota]);

  const montoNum = Math.round(Number(monto) || 0);

  // Simulación en tiempo real (Modo Cascada o Modo Cuota)
  const simulacion = useMemo(() => {
    if (montoNum <= 0 || cuotas.length === 0) return null;

    if (modoImputacion === 'cascada') {
      return simularAbonoCascada(cuotas, montoNum);
    } else {
      // Simulación enfocada en la cuota seleccionada
      if (!currentCuota) return null;
      const valCuota = Number(currentCuota.valor_cuota) || 0;
      const yaPag = Number(currentCuota.valor_pagado) || 0;
      const porPagar = Math.max(0, valCuota - yaPag);
      const abonoAEsta = Math.min(montoNum, porPagar);
      const completo = abonoAEsta >= porPagar;

      const afectaciones = [{
        id: currentCuota.id,
        numero_cuota: currentCuota.numero_cuota,
        fecha_vencimiento: currentCuota.fecha_vencimiento,
        valor_cuota: valCuota,
        valor_anterior: yaPag,
        valor_abono: abonoAEsta,
        nuevo_pagado: yaPag + abonoAEsta,
        nuevo_estado: completo ? 'PAGA' : 'AL DÍA',
        completo
      }];

      return {
        afectaciones,
        montoAplicado: abonoAEsta,
        montoSobrante: Math.max(0, montoNum - abonoAEsta)
      };
    }
  }, [cuotas, montoNum, modoImputacion, currentCuota]);

  // Generación dinámica del texto oficial de Concepto
  const conceptoSugerido = useMemo(() => {
    const rawLote = selectedVenta?.id_lote || selectedVenta?.lotes?.id_lote || '';
    const loteDesc = formatearLoteDescripcion(rawLote);
    const cliNom = selectedVenta?.cliente_nombre || selectedVenta?.clientes?.nombre || '';

    if (!simulacion || simulacion.afectaciones.length === 0) {
      return `Abono a contrato - ${loteDesc} - Titular: ${cliNom}`.trim();
    }

    const afs = simulacion.afectaciones;
    let cuotasTexto = '';

    if (afs.length === 1) {
      const a = afs[0];
      cuotasTexto = a.completo
        ? `Pago Cuota ${a.numero_cuota} (Totalidad)`
        : `Abono Parcial Cuota ${a.numero_cuota}`;
    } else {
      const completas = afs.filter(a => a.completo).map(a => a.numero_cuota);
      const parciales = afs.filter(a => !a.completo).map(a => a.numero_cuota);

      if (completas.length > 0 && parciales.length === 0) {
        cuotasTexto = `Pago Cuotas ${completas.join(', ')}`;
      } else if (completas.length > 0 && parciales.length > 0) {
        cuotasTexto = `Pago Cuota${completas.length > 1 ? 's' : ''} ${completas.join(', ')} y Abono Cuota ${parciales.join(', ')}`;
      } else {
        cuotasTexto = `Abono Cuota ${parciales.join(', ')}`;
      }
    }

    return `${cuotasTexto} - ${loteDesc} - Titular: ${cliNom}`.trim();
  }, [selectedVenta, simulacion]);

  // Generación dinámica del texto oficial de Observaciones
  const observacionesSugeridas = useMemo(() => {
    let base = '';
    const refStr = referenciaPago.trim() ? ` · Ref: ${referenciaPago.trim()}` : '';

    if (medioPago === 'TRANSFERENCIA') {
      base = `Transferencia a cuenta ${banco}${refStr}`;
    } else {
      if (subTipoEfectivo === 'CONSIGNACION') {
        base = `Efectivo consignado a cuenta ${banco}${refStr}`;
      } else {
        base = `Efectivo recibido en oficina${refStr}`;
      }
    }

    // Agregar nota de saldo restante si hubo cuota parcial
    if (simulacion) {
      const parcial = simulacion.afectaciones.find(a => !a.completo);
      if (parcial) {
        const saldoResta = Math.max(0, (Number(parcial.valor_cuota) || 0) - (Number(parcial.nuevo_pagado) || 0));
        base += ` · Saldo restante Cuota ${parcial.numero_cuota}: ${formatCOP(saldoResta)}`;
      }
    }

    return base;
  }, [medioPago, banco, subTipoEfectivo, referenciaPago, simulacion]);

  // Actualizar automáticamente concepto y observaciones si el usuario no los ha editado manualmente
  useEffect(() => {
    if (!conceptoModificado) {
      setConceptoManual(conceptoSugerido);
    }
  }, [conceptoSugerido, conceptoModificado]);

  useEffect(() => {
    if (!obsModificada) {
      setObservacionesManual(observacionesSugeridas);
    }
  }, [observacionesSugeridas, obsModificada]);

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
      const rawLote = selectedVenta.id_lote || selectedVenta.lotes?.id_lote || '';
      const loteFormateado = formatearLoteDescripcion(rawLote);
      const cliNom = selectedVenta.cliente_nombre || selectedVenta.clientes?.nombre || '';
      const cliDoc = selectedVenta.clientes?.doc_cliente || selectedVenta.doc_cliente || '';

      const res = await registrarPagoConRecibo({
        ventaId: vid,
        cuotaId: modoImputacion === 'cuota' ? (selectedCuotaId || null) : null,
        afectaciones: modoImputacion === 'cascada' ? simulacion?.afectaciones : null,
        monto: montoNum,
        fechaPago,
        medioPago,
        banco: medioPago === 'TRANSFERENCIA' || subTipoEfectivo === 'CONSIGNACION' ? banco : undefined,
        referenciaPago: referenciaPago.trim() || undefined,
        concepto: conceptoManual.trim() || conceptoSugerido,
        observaciones: observacionesManual.trim() || observacionesSugeridas,
        registradoPor: user?.email || 'Secretaría',
        ciudad: 'Acacías',
        loteIdStr: rawLote,
        clienteNombre: cliNom,
        clienteDoc: cliDoc
      });

      // Abrir recibo generado en pantalla con auto-descarga inmediata del PDF
      setReciboGenerado({
        ...res.recibo,
        autoDownload: true
      });

      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error registrando pago:', err);
      setError(err.message || 'Error registrando el abono y emitiendo el recibo');
    } finally {
      setSaving(false);
    }
  };

  // Si ya se generó el recibo, mostrar vista de recibo oficial con auto-descarga
  if (reciboGenerado) {
    return (
      <ReciboCajaView
        recibo={reciboGenerado}
        autoDownload={true}
        onClose={() => {
          setReciboGenerado(null);
          onClose();
        }}
      />
    );
  }

  return (
    <Modal onClose={onClose} maxWidth={680}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={22} color="#16a34a" />
            Registrar Abono / Pago y Emitir Recibo de Caja
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            Aplica a cuotas con imputación contable y emite el comprobante oficial <strong>Nº {proximoReciboNum}</strong> (Acacías).
          </div>
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 6 }}>
          <X size={17} />
        </button>
      </div>

      {error && (
        <div className="alert-banner red" style={{ marginBottom: 16 }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* 1. Selector de Lote / Contrato */}
        {!venta && allVentas.length > 0 && (
          <SelectorLoteBuscador
            ventas={allVentas.filter(v => (v.saldo || 0) > 0 || v.estado === 'VENDIDO')}
            selectedVentaId={selectedVenta?.id || selectedVenta?.venta_id}
            onSelect={(v) => {
              setSelectedVenta(v);
              setSelectedCuotaId('');
            }}
            label="Buscar Contrato / Lote:"
            placeholder="Escribe número de lote (ej. LC1 - 7 - 19) o cliente..."
          />
        )}

        {/* Tarjeta del contrato seleccionado */}
        {selectedVenta && (
          <div style={{
            background: '#f8fafc',
            border: '1.5px solid #cbd5e1',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <span style={{
                  fontFamily: 'monospace',
                  fontSize: 14,
                  fontWeight: 900,
                  color: '#166534',
                  background: '#dcfce7',
                  padding: '2px 8px',
                  borderRadius: 6,
                  marginRight: 8
                }}>
                  {selectedVenta.id_lote || selectedVenta.lotes?.id_lote}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                  {selectedVenta.cliente_nombre || selectedVenta.clientes?.nombre}
                </span>
                <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                  C.C. {selectedVenta.clientes?.doc_cliente || selectedVenta.doc_cliente || '—'}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#64748b' }}>Saldo Pendiente</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: (selectedVenta.saldo || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                  {formatCOP(selectedVenta.saldo || 0)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11.5, color: '#475569', flexWrap: 'wrap' }}>
              <span>Cuota pactada: <strong>{formatCOP(selectedVenta.valor_cuota)}</strong></span>
              <span>Días de pago: <strong>{selectedVenta.dias_pago || '—'}</strong></span>
              <span>
                Cuotas vencidas: <strong style={{ color: (selectedVenta.cuotas_vencidas || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                  {selectedVenta.cuotas_vencidas || 0}
                </strong>
              </span>
            </div>
          </div>
        )}

        {/* 2. Selector de Modo: Cascada Automática vs Cuota Específica */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: '#334155' }}>
            Destino del Abono / Pago:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => setModoImputacion('cascada')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: modoImputacion === 'cascada' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: modoImputacion === 'cascada' ? '#f0fdf4' : '#fff',
                color: modoImputacion === 'cascada' ? '#166534' : '#475569',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Layers size={14} /> Imputar en Cascada (Recomendado)
            </button>

            <button
              type="button"
              onClick={() => setModoImputacion('cuota')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: modoImputacion === 'cuota' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: modoImputacion === 'cuota' ? '#f0fdf4' : '#fff',
                color: modoImputacion === 'cuota' ? '#166534' : '#475569',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <CreditCard size={14} /> Cuota Específica
            </button>
          </div>
        </div>

        {/* Dropdown de Cuota si está en modo cuota */}
        {modoImputacion === 'cuota' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4, color: '#475569' }}>
              Seleccionar Cuota a Pagar:
            </label>
            <select
              className="search-input"
              style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
              value={selectedCuotaId}
              onChange={e => {
                setSelectedCuotaId(e.target.value);
                const cFound = cuotas.find(c => c.id === e.target.value);
                if (cFound) {
                  const resta = Math.max(0, (Number(cFound.valor_cuota) || 0) - (Number(cFound.valor_pagado) || 0));
                  setMonto(String(resta));
                }
              }}
              required
            >
              <option value="">-- Selecciona una cuota --</option>
              {cuotasPendientes.map(c => {
                const pend = Math.max(0, (Number(c.valor_cuota) || 0) - (Number(c.valor_pagado) || 0));
                return (
                  <option key={c.id} value={c.id}>
                    Cuota #{c.numero_cuota} (Vence: {formatDate(c.fecha_vencimiento)}) — Saldo: {formatCOP(pend)} [{c.estado_cuota}]
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {/* 3. Monto a Pagar y Fecha */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#334155' }}>
              Monto a Pagar ($ COP):
            </label>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%', fontSize: 16, fontWeight: 800, paddingLeft: 12, color: '#166534' }}
              placeholder="Ej: 1000000"
              value={monto}
              onChange={e => setMonto(e.target.value)}
              required
              min="1000"
              autoFocus
            />
            {montoNum > 0 && (
              <div style={{ fontSize: 11.5, color: '#16a34a', fontWeight: 700, marginTop: 3 }}>
                {formatCOP(montoNum)}
              </div>
            )}
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: '#334155' }}>
              Fecha del Pago:
            </label>
            <input
              type="date"
              className="search-input"
              style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
              value={fechaPago}
              onChange={e => setFechaPago(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Simulación en vivo de las cuotas afectadas */}
        {simulacion && simulacion.afectaciones.length > 0 && (
          <div style={{
            background: '#f0fdf4',
            border: '1.5px solid #86efac',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#166534', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="#16a34a" />
              Imputación Contable del Recibo Nº {proximoReciboNum}:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {simulacion.afectaciones.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>
                    <strong>Cuota #{a.numero_cuota}</strong> (Vence: {formatDate(a.fecha_vencimiento)})
                  </span>
                  <span>
                    <strong style={{ color: '#15803d' }}>+{formatCOP(a.valor_abono)}</strong>
                    {a.completo ? (
                      <span style={{ marginLeft: 6, color: '#16a34a', fontWeight: 700 }}>✓ Total</span>
                    ) : (
                      <span style={{ marginLeft: 6, color: '#d97706', fontWeight: 700 }}>
                        ⚠ Parcial (Resta {formatCOP(Math.max(0, a.valor_cuota - a.nuevo_pagado))})
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Medios de Pago: ÚNICAMENTE EFECTIVO O TRANSFERENCIA */}
        <div style={{
          background: '#f8fafc',
          border: '1.5px solid #e2e8f0',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 14
        }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: '#334155', display: 'block', marginBottom: 8 }}>
            Medio de Pago:
          </label>

          {/* Selector Efectivo vs Transferencia */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
            <button
              type="button"
              onClick={() => setMedioPago('TRANSFERENCIA')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: medioPago === 'TRANSFERENCIA' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                background: medioPago === 'TRANSFERENCIA' ? '#eff6ff' : '#fff',
                color: medioPago === 'TRANSFERENCIA' ? '#1d4ed8' : '#475569',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Building2 size={15} /> Transferencia Bancaria
            </button>

            <button
              type="button"
              onClick={() => setMedioPago('EFECTIVO')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: medioPago === 'EFECTIVO' ? '2px solid #16a34a' : '1px solid #cbd5e1',
                background: medioPago === 'EFECTIVO' ? '#f0fdf4' : '#fff',
                color: medioPago === 'EFECTIVO' ? '#15803d' : '#475569',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Wallet size={15} /> Efectivo
            </button>
          </div>

          {/* Opciones de TRANSFERENCIA (Cuentas Bancolombia, Davivienda, Nequi) */}
          {medioPago === 'TRANSFERENCIA' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Cuenta Receptora:
                </label>
                <select
                  className="search-input"
                  style={{ width: '100%', fontSize: 12.5, fontWeight: 700 }}
                  value={banco}
                  onChange={e => setBanco(e.target.value)}
                >
                  {CUENTAS_BANCARIAS.map(c => (
                    <option key={c} value={c}>Cuenta {c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                  No. de Referencia / Comprobante:
                </label>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', fontSize: 12.5 }}
                  placeholder="Ej: 04829104"
                  value={referenciaPago}
                  onChange={e => setReferenciaPago(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Opciones de EFECTIVO */}
          {medioPago === 'EFECTIVO' && (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="subTipoEfectivo"
                    checked={subTipoEfectivo === 'OFICINA'}
                    onChange={() => setSubTipoEfectivo('OFICINA')}
                  />
                  Recibido en Oficina
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontWeight: 600 }}>
                  <input
                    type="radio"
                    name="subTipoEfectivo"
                    checked={subTipoEfectivo === 'CONSIGNACION'}
                    onChange={() => setSubTipoEfectivo('CONSIGNACION')}
                  />
                  Consignado en Banco / Corresponsal
                </label>
              </div>

              {subTipoEfectivo === 'CONSIGNACION' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr', gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Banco Consignado:
                    </label>
                    <select
                      className="search-input"
                      style={{ width: '100%', fontSize: 12.5, fontWeight: 700 }}
                      value={banco}
                      onChange={e => setBanco(e.target.value)}
                    >
                      {CUENTAS_BANCARIAS.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: '#475569', display: 'block', marginBottom: 4 }}>
                      No. Comprobante / Recibo:
                    </label>
                    <input
                      type="text"
                      className="search-input"
                      style={{ width: '100%', fontSize: 12.5 }}
                      placeholder="Ej: Ref 84920"
                      value={referenciaPago}
                      onChange={e => setReferenciaPago(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 5. Concepto que irá impreso en el Recibo */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
              Concepto del Recibo (Oficial):
            </label>
            <span style={{ fontSize: 10.5, color: '#64748b' }}>
              Incluye cuotas cubiertas, lote oficial y nombre del cliente
            </span>
          </div>
          <input
            type="text"
            className="search-input"
            style={{ width: '100%', fontSize: 12.5, fontWeight: 600, color: '#0f172a' }}
            value={conceptoManual}
            onChange={e => {
              setConceptoManual(e.target.value);
              setConceptoModificado(true);
            }}
            required
          />
        </div>

        {/* 6. Observaciones que irán impresas en el Recibo */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <label style={{ fontSize: 11.5, fontWeight: 700, color: '#334155' }}>
              Observaciones del Recibo:
            </label>
            <span style={{ fontSize: 10.5, color: '#64748b' }}>
              Referencia y canal bancario de recepción
            </span>
          </div>
          <textarea
            className="search-input"
            style={{ width: '100%', fontSize: 12, minHeight: 46 }}
            value={observacionesManual}
            onChange={e => {
              setObservacionesManual(e.target.value);
              setObsModificada(true);
            }}
          />
        </div>

        {/* Botones de Acción */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid #e2e8f0' }}>
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
              fontWeight: 800,
              fontSize: 13.5,
              padding: '9px 22px',
              gap: 8,
              boxShadow: '0 4px 6px -1px rgba(22, 163, 74, 0.3)'
            }}
            disabled={saving || !selectedVenta || montoNum <= 0}
          >
            {saving ? (
              'Procesando...'
            ) : (
              <>
                <Receipt size={17} /> Confirmar Abono y Descargar Recibo Nº {proximoReciboNum}
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

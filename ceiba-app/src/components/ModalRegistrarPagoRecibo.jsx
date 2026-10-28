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
  const { user, isSecretaria, isSoporte, role } = useAuth();
  const [selectedVenta, setSelectedVenta] = useState(venta);
  const [cuotas, setCuotas] = useState([]);
  const [recibosPrevios, setRecibosPrevios] = useState([]);
  const [loadingCuotas, setLoadingCuotas] = useState(false);

  // Modo de imputación: 'cuota' (específica) o 'cascada' (automática)
  // Por defecto 'cuota' para dar control manual total y evitar auto-incrementos no deseados
  const [modoImputacion, setModoImputacion] = useState('cuota');
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

  // Selector visual de estado de cuota: 'PAGA' (verde) | 'ABONO' (amarilla)
  const [forzarEstadoVisual, setForzarEstadoVisual] = useState(null);

  const [proximoReciboNum, setProximoReciboNum] = useState(3412);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Modo sin recibo oficial (para cargar pagos no imputados sin generar recibo de caja)
  const [sinRecibo, setSinRecibo] = useState(false);
  const [pagoSinReciboExitoso, setPagoSinReciboExitoso] = useState(null);

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

        // Modo por defecto siempre es cuota específica manual para evitar auto-incrementos no deseados
        setModoImputacion('cuota');
        if (cuotaPreseleccionada?.id) {
          setSelectedCuotaId(cuotaPreseleccionada.id);
          // Calcular si hay excedente acumulado de cuotas previas
          const num = cuotaPreseleccionada.numero_cuota;
          const excPrev = (cData || [])
            .filter(c => c.numero_cuota < num && String(c.estado_cuota || '').toUpperCase() === 'PAGA')
            .reduce((s, c) => s + Math.max(0, (Number(c.valor_pagado) || 0) - (Number(c.valor_cuota) || 0)), 0);
          
          const pendNominal = Math.max(0, (Number(cuotaPreseleccionada.valor_cuota) || 0) - (Number(cuotaPreseleccionada.valor_pagado) || 0));
          const pendNeto = Math.max(0, pendNominal - excPrev);
          const pendFinal = pendNeto > 0 ? pendNeto : pendNominal;
          if (pendFinal > 0) setMonto(String(Math.round(pendFinal)));
        } else {
          // Seleccionar automáticamente la primera cuota pendiente (no PAGA)
          const primeraPendiente = (cData || []).find(c => {
            const estado = (c.estado_cuota || '').toUpperCase().trim();
            const valCuota = Number(c.valor_cuota) || 0;
            const valPag = Number(c.valor_pagado) || 0;
            return estado !== 'PAGA' && (valCuota === 0 || (valCuota - valPag > 2000));
          });
          if (primeraPendiente) {
            setSelectedCuotaId(primeraPendiente.id);
            const num = primeraPendiente.numero_cuota;
            const excPrev = (cData || [])
              .filter(c => c.numero_cuota < num && String(c.estado_cuota || '').toUpperCase() === 'PAGA')
              .reduce((s, c) => s + Math.max(0, (Number(c.valor_pagado) || 0) - (Number(c.valor_cuota) || 0)), 0);

            const pendNominal = Math.max(0, (Number(primeraPendiente.valor_cuota) || 0) - (Number(primeraPendiente.valor_pagado) || 0));
            const pendNeto = Math.max(0, pendNominal - excPrev);
            const pendFinal = pendNeto > 0 ? pendNeto : pendNominal;
            if (pendFinal > 0) setMonto(String(Math.round(pendFinal)));
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

  // Cuotas pendientes de pago ordenadas cronológicamente (NUNCA mostrar cuotas ya PAGAS)
  const cuotasPendientes = useMemo(() => {
    return (cuotas || [])
      .filter(c => {
        // Si el usuario abrió el modal haciendo clic directo en abonar esta cuota, permitir verla
        if (cuotaPreseleccionada?.id && c.id === cuotaPreseleccionada.id) return true;
        const estado = (c.estado_cuota || '').toUpperCase().trim();
        const valCuota = Number(c.valor_cuota) || 0;
        const valPag = Number(c.valor_pagado) || 0;
        const pendiente = valCuota - valPag;
        // Si ya está marcada como PAGA o totalmente cubierta, no mostrarla en el selector
        if (estado === 'PAGA') return false;
        if (valCuota > 0 && pendiente <= 2000) return false;
        return true;
      })
      .sort((a, b) => (Number(a.numero_cuota) || 0) - (Number(b.numero_cuota) || 0));
  }, [cuotas, cuotaPreseleccionada]);

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

  const montoNum = Math.max(0, Math.round(Number(monto) || 0));

  // Simulación en tiempo real (Modo Cascada o Modo Cuota)
  const simulacion = useMemo(() => {
    if (montoNum <= 0 || !Array.isArray(cuotas) || cuotas.length === 0) return null;

    try {
      if (modoImputacion === 'cascada') {
        return simularAbonoCascada(cuotas, montoNum);
      } else {
        // Simulación enfocada en la cuota seleccionada
        if (!currentCuota) return null;
        const valCuota = Number(currentCuota.valor_cuota) || 0;
        const yaPag = Number(currentCuota.valor_pagado) || 0;
        const porPagar = Math.max(0, valCuota - yaPag);
        const diff = porPagar - montoNum;
        const esPocoSobrante = diff < 0 && Math.abs(diff) <= 2000;
        const abonoAEsta = esPocoSobrante ? montoNum : Math.min(montoNum, porPagar);
        let completo = montoNum >= porPagar || (porPagar > 0 && diff <= 2000) || (porPagar > 0 && diff / porPagar < 0.02);
        if (forzarEstadoVisual === 'PAGA') completo = true;
        if (forzarEstadoVisual === 'ABONO' || forzarEstadoVisual === 'ABONO AL DÍA' || forzarEstadoVisual === 'ABONO EN MORA') completo = false;

        const afectaciones = [{
          id: currentCuota.id || 'cuota-sel',
          numero_cuota: currentCuota.numero_cuota || 1,
          fecha_vencimiento: currentCuota.fecha_vencimiento,
          valor_cuota: valCuota,
          valor_anterior: yaPag,
          valor_abono: abonoAEsta,
          nuevo_pagado: yaPag + abonoAEsta,
          nuevo_estado: completo ? 'PAGA' : 'ABONO',
          completo
        }];

        return {
          afectaciones,
          montoAplicado: abonoAEsta,
          montoSobrante: Math.max(0, montoNum - abonoAEsta)
        };
      }
    } catch (err) {
      console.warn('Aviso en simulación de abono:', err);
      return null;
    }
  }, [cuotas, montoNum, modoImputacion, currentCuota]);

  // Generación dinámica del texto oficial de Concepto (conciso: solo cuota/abono)
  const conceptoSugerido = useMemo(() => {
    if (!simulacion || !Array.isArray(simulacion.afectaciones) || simulacion.afectaciones.length === 0) {
      return 'Abono a contrato';
    }

    try {
      const afs = simulacion.afectaciones;
      let cuotasTexto = '';

      if (afs.length === 1) {
        const a = afs[0];
        cuotasTexto = a?.completo
          ? `Pago Cuota ${a?.numero_cuota || ''} (Totalidad)`
          : `Abono Cuota ${a?.numero_cuota || ''}`;
      } else {
        const completas = afs.filter(a => a && a.completo).map(a => a.numero_cuota);
        const parciales = afs.filter(a => a && !a.completo).map(a => a.numero_cuota);

        if (completas.length > 0 && parciales.length === 0) {
          cuotasTexto = `Pago Cuotas ${completas.join(', ')}`;
        } else if (completas.length > 0 && parciales.length > 0) {
          cuotasTexto = `Pago Cuota${completas.length > 1 ? 's' : ''} ${completas.join(', ')} y Abono Cuota ${parciales.join(', ')}`;
        } else {
          cuotasTexto = `Abono Cuota ${parciales.join(', ')}`;
        }
      }

      return cuotasTexto || 'Abono a contrato';
    } catch (e) {
      return 'Abono a contrato';
    }
  }, [selectedVenta, simulacion]);

  // Generación dinámica del texto oficial de Observaciones
  const observacionesSugeridas = useMemo(() => {
    try {
      let base = '';
      const refStr = (referenciaPago || '').trim() ? ` · Ref: ${(referenciaPago || '').trim()}` : '';

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
      if (simulacion && Array.isArray(simulacion.afectaciones)) {
        const parcial = simulacion.afectaciones.find(a => a && !a.completo);
        if (parcial) {
          const saldoResta = Math.max(0, (Number(parcial.valor_cuota) || 0) - (Number(parcial.nuevo_pagado) || 0));
          base += ` · Saldo restante Cuota ${parcial.numero_cuota}: ${formatCOP(saldoResta)}`;
        }
      }

      return base;
    } catch (e) {
      return '';
    }
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
        registradoPor: user?.user_metadata?.nombre || (isSoporte ? 'Diana (Soporte)' : 'Secretaría'),
        ciudad: 'Acacías',
        loteIdStr: rawLote,
        clienteNombre: cliNom,
        clienteDoc: cliDoc,
        generarRecibo: !sinRecibo,
        numeroReciboManual: !sinRecibo && proximoReciboNum ? Number(proximoReciboNum) : null,
        forzarEstado: forzarEstadoVisual
      });

      if (sinRecibo) {
        setPagoSinReciboExitoso({
          monto: montoNum,
          lote: rawLote,
          cliente: cliNom,
          cuotasAfectadas: res.cuotasActualizadas || []
        });
        if (onSuccess) onSuccess();
      } else {
        // Abrir recibo generado en pantalla con auto-descarga inmediata del PDF
        setReciboGenerado({
          ...res.recibo,
          autoDownload: true
        });
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error('Error registrando pago:', err);
      setError(err.message || 'Error registrando el abono y actualizando la cuota');
    } finally {
      setSaving(false);
    }
  };

  // Si se aplicó el pago en modo sin recibo, mostrar confirmación de cuota actualizada
  if (pagoSinReciboExitoso) {
    return (
      <Modal onClose={onClose} maxWidth={500} zIndex={100010}>
        <div style={{ textAlign: 'center', padding: '16px 12px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#dcfce7', color: '#16a34a',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px'
          }}>
            <CheckCircle2 size={32} />
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#14532d', marginBottom: 6 }}>
            ¡Cuota Actualizada con Éxito!
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 18 }}>
            El abono fue cargado e imputado a la cartera sin emitir recibo de caja oficial.
          </p>

          <div style={{
            background: 'var(--bg-card2)',
            border: '1.5px solid #86efac',
            borderRadius: 8,
            padding: '12px 16px',
            textAlign: 'left',
            marginBottom: 20,
            fontSize: 12.5
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Monto Aplicado:</span>
              <strong style={{ color: '#16a34a', fontSize: 14 }}>{formatCOP(pagoSinReciboExitoso.monto)}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Lote / Contrato:</span>
              <strong style={{ fontFamily: 'monospace' }}>{pagoSinReciboExitoso.lote}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Titular:</span>
              <strong>{pagoSinReciboExitoso.cliente}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ color: 'var(--text-muted)' }}>Fecha de Pago:</span>
              <strong>{formatDate(fechaPago)}</strong>
            </div>
            <div style={{
              marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)',
              fontSize: 11.5, color: '#15803d', fontWeight: 600
            }}>
              ✓ El consecutivo oficial de recibos se mantiene intacto. El próximo recibo continuará siendo el <strong>Nº {proximoReciboNum}</strong>.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: '9px 0', fontSize: 13.5, fontWeight: 700, background: '#16a34a', borderColor: '#16a34a' }}
            onClick={() => {
              setPagoSinReciboExitoso(null);
              onClose();
            }}
          >
            Aceptar y Continuar
          </button>
        </div>
      </Modal>
    );
  }

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
    <Modal onClose={onClose} maxWidth={680} zIndex={100010}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: sinRecibo ? '#15803d' : '#166534', display: 'flex', alignItems: 'center', gap: 8 }}>
            {sinRecibo ? <CreditCard size={22} color="#15803d" /> : <Receipt size={22} color="#16a34a" />}
            {sinRecibo ? 'Registrar Abono / Pago (Cuota Actualizada)' : 'Registrar Abono / Pago y Emitir Recibo de Caja'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            {sinRecibo ? (
              <span>Aplica a cuotas y actualiza el saldo contable directamente <strong>(Sin emitir recibo oficial · Consecutivo reservado)</strong>.</span>
            ) : (
              <span>Aplica a cuotas con imputación contable y emite el comprobante oficial <strong>Nº {proximoReciboNum}</strong> (Acacías).</span>
            )}
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
            background: 'var(--bg-card2)',
            border: '1.5px solid var(--border)',
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
                  color: '#16a34a',
                  background: 'rgba(22, 163, 74, 0.15)',
                  padding: '2px 8px',
                  borderRadius: 6,
                  marginRight: 8
                }}>
                  {selectedVenta.id_lote || selectedVenta.lotes?.id_lote}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedVenta.cliente_nombre || selectedVenta.clientes?.nombre}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                  C.C. {selectedVenta.clientes?.doc_cliente || selectedVenta.doc_cliente || '—'}
                </span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Saldo Pendiente</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: (selectedVenta.saldo || 0) > 0 ? '#dc2626' : '#16a34a' }}>
                  {formatCOP(selectedVenta.saldo || 0)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11.5, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
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

        {/* Casilla: Cargar Pago Sin Generar Recibo */}
        <div
          onClick={() => setSinRecibo(!sinRecibo)}
          style={{
            background: sinRecibo ? '#f0fdf4' : 'var(--bg-card2)',
            border: sinRecibo ? '2px solid #16a34a' : '1.5px solid var(--border)',
            borderRadius: 10,
            padding: '12px 16px',
            marginBottom: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
            boxShadow: sinRecibo ? '0 2px 8px rgba(22, 163, 74, 0.12)' : 'none'
          }}
        >
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', margin: 0 }}>
            <input
              type="checkbox"
              checked={sinRecibo}
              onChange={e => setSinRecibo(e.target.checked)}
              onClick={e => e.stopPropagation()}
              style={{ width: 18, height: 18, accentColor: '#16a34a', cursor: 'pointer' }}
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: sinRecibo ? '#15803d' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {sinRecibo ? '✓ Modo Carga Directa: NO generar recibo oficial' : 'Cargar pago sin generar recibo oficial'}
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                {sinRecibo
                  ? `Se actualizará la cuota y saldo contable sin emitir recibo. El próximo recibo oficial seguirá siendo el Nº ${proximoReciboNum}.`
                  : 'Marca esta casilla para cargar pagos sin imputar o históricos sin alterar el consecutivo de recibos.'}
              </div>
            </div>
          </label>
          {sinRecibo ? (
            <span className="badge" style={{
              background: '#dcfce7',
              color: '#15803d',
              border: '1px solid #86efac',
              fontWeight: 800,
              fontSize: 11,
              padding: '4px 10px',
              borderRadius: 6
            }}>
              Cuota Actualizada
            </span>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              padding: '3px 8px'
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#475569' }}>
                Recibo Nº:
              </span>
              <input
                type="number"
                value={proximoReciboNum}
                onChange={(e) => setProximoReciboNum(Math.max(1, parseInt(e.target.value) || 0))}
                style={{
                  width: 72,
                  padding: '3px 6px',
                  fontSize: 13,
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  textAlign: 'center',
                  borderRadius: 6,
                  border: '1px solid #94a3b8',
                  background: '#ffffff',
                  color: '#0f172a'
                }}
                title="Número de recibo de caja oficial asignado (calculado automáticamente como 3441, ajustable si es necesario)"
              />
            </div>
          )}
        </div>

        {/* 2. Selector de Modo: Cascada Automática vs Cuota Específica */}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6, color: 'var(--text-primary)' }}>
            Destino del Abono / Pago:
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => setModoImputacion('cuota')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: modoImputacion === 'cuota' ? '2px solid #16a34a' : '1px solid var(--border)',
                background: modoImputacion === 'cuota' ? 'rgba(22, 163, 74, 0.15)' : 'var(--bg-card2)',
                color: modoImputacion === 'cuota' ? '#22c55e' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <CreditCard size={14} /> Cuota Específica (Directa)
            </button>

            <button
              type="button"
              onClick={() => setModoImputacion('cascada')}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: modoImputacion === 'cascada' ? '2px solid #16a34a' : '1px solid var(--border)',
                background: modoImputacion === 'cascada' ? 'rgba(22, 163, 74, 0.15)' : 'var(--bg-card2)',
                color: modoImputacion === 'cascada' ? '#22c55e' : 'var(--text-secondary)',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
            >
              <Layers size={14} /> Imputar en Cascada
            </button>
          </div>
        </div>

        {/* Dropdown de Cuota si está en modo cuota */}
        {modoImputacion === 'cuota' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11.5, fontWeight: 600, display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
              Seleccionar Cuota a Pagar:
            </label>
            <select
              className="search-input"
              style={{ width: '100%', fontSize: 13, fontWeight: 600 }}
              value={selectedCuotaId}
              onChange={e => {
                setSelectedCuotaId(e.target.value);
                setForzarEstadoVisual(null);
                const cFound = cuotas.find(c => c.id === e.target.value);
                if (cFound) {
                  const resta = Math.max(0, (Number(cFound.valor_cuota) || 0) - (Number(cFound.valor_pagado) || 0));
                  setMonto(String(Math.round(resta)));
                }
              }}
              required
            >
              {cuotasPendientes.length === 0 ? (
                <option value="">Todas las cuotas de este contrato están PAGAS</option>
              ) : (
                <option value="">-- Selecciona una cuota pendiente --</option>
              )}
              {cuotasPendientes.map(c => {
                const valCuota = Number(c.valor_cuota) || 0;
                const yaPag = Number(c.valor_pagado) || 0;
                const pend = Math.max(0, valCuota - yaPag);
                const tagPrevio = yaPag > 0 ? ` (Abonado: ${formatCOP(yaPag)})` : '';
                const isAbono = yaPag > 0 && pend > 0;
                const todayStr = new Date().toISOString().slice(0, 10);
                const isMora = c.estado_cuota === 'VENCIDA' || (c.fecha_vencimiento && c.fecha_vencimiento < todayStr);
                const tagEstado = isAbono ? (isMora ? 'ABONO EN MORA' : 'ABONO AL DÍA') : (c.estado_cuota === 'VENCIDA' ? 'MORA' : c.estado_cuota);
                return (
                  <option key={c.id} value={c.id}>
                    Cuota #{c.numero_cuota} (Vence: {formatDate(c.fecha_vencimiento)}) — Saldo: {formatCOP(pend)}{tagPrevio} [{tagEstado}]
                  </option>
                );
              })}
            </select>

            {/* Selector visual de estado de cuota */}
            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>Marcar cuota como:</span>
              <button
                type="button"
                onClick={() => setForzarEstadoVisual('PAGA')}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: (forzarEstadoVisual === 'PAGA' || (!forzarEstadoVisual && simulacion?.afectaciones?.[0]?.completo))
                    ? '2px solid #22c55e'
                    : '1px solid var(--border)',
                  background: (forzarEstadoVisual === 'PAGA' || (!forzarEstadoVisual && simulacion?.afectaciones?.[0]?.completo))
                    ? 'rgba(34, 197, 94, 0.2)'
                    : 'var(--bg-base)',
                  color: (forzarEstadoVisual === 'PAGA' || (!forzarEstadoVisual && simulacion?.afectaciones?.[0]?.completo))
                    ? '#22c55e'
                    : 'var(--text-muted)'
                }}
              >
                ✓ PAGA (Verde)
              </button>
              <button
                type="button"
                onClick={() => setForzarEstadoVisual('ABONO AL DÍA')}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: (forzarEstadoVisual === 'ABONO AL DÍA' || forzarEstadoVisual === 'ABONO' || (!forzarEstadoVisual && !simulacion?.afectaciones?.[0]?.completo))
                    ? '2px solid #f59e0b'
                    : '1px solid var(--border)',
                  background: (forzarEstadoVisual === 'ABONO AL DÍA' || forzarEstadoVisual === 'ABONO' || (!forzarEstadoVisual && !simulacion?.afectaciones?.[0]?.completo))
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'var(--bg-base)',
                  color: (forzarEstadoVisual === 'ABONO AL DÍA' || forzarEstadoVisual === 'ABONO' || (!forzarEstadoVisual && !simulacion?.afectaciones?.[0]?.completo))
                    ? '#d97706'
                    : 'var(--text-muted)'
                }}
              >
                🟡 ABONO AL DÍA (Amarillo)
              </button>
              <button
                type="button"
                onClick={() => setForzarEstadoVisual('ABONO EN MORA')}
                style={{
                  padding: '3px 10px',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: forzarEstadoVisual === 'ABONO EN MORA'
                    ? '2px solid #ef4444'
                    : '1px solid var(--border)',
                  background: forzarEstadoVisual === 'ABONO EN MORA'
                    ? 'rgba(239, 68, 68, 0.2)'
                    : 'var(--bg-base)',
                  color: forzarEstadoVisual === 'ABONO EN MORA'
                    ? '#dc2626'
                    : 'var(--text-muted)'
                }}
              >
                🔴 ABONO EN MORA (Rojo)
              </button>
            </div>
          </div>
        )}

        {/* Banner de Excedente / Saldo a favor de cuotas previas */}
        {(() => {
          const selCuo = (cuotas || []).find(c => c.id === selectedCuotaId);
          if (!selCuo) return null;
          const num = selCuo.numero_cuota;
          const excPrev = (cuotas || [])
            .filter(c => c.numero_cuota < num && String(c.estado_cuota || '').toUpperCase() === 'PAGA')
            .reduce((s, c) => s + Math.max(0, (Number(c.valor_pagado) || 0) - (Number(c.valor_cuota) || 0)), 0);

          if (excPrev <= 0) return null;
          const pendNom = Math.max(0, (Number(selCuo.valor_cuota) || 0) - (Number(selCuo.valor_pagado) || 0));
          const netoPagar = Math.max(0, pendNom - excPrev);

          return (
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: '#166534', marginBottom: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10
            }}>
              <div>
                <div style={{ fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>💡 Saldo a favor acumulado de cuotas previas:</span>
                  <span style={{ fontSize: 13, background: '#dcfce7', padding: '1px 6px', borderRadius: 4, border: '1px solid #bbf7d0' }}>
                    {formatCOP(excPrev)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#166534', marginTop: 3 }}>
                  Cuota #{num} pactada: <strong>{formatCOP(selCuo.valor_cuota)}</strong> · Neto a cobrar tras abono previo: <strong style={{ color: '#dc2626', fontSize: 12 }}>{formatCOP(netoPagar)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{
                  padding: '4px 10px', fontSize: 11.5, fontWeight: 700,
                  background: '#16a34a', color: '#ffffff', border: 'none', borderRadius: 6,
                  cursor: 'pointer'
                }}
                onClick={() => setMonto(String(Math.round(netoPagar)))}
              >
                Aplicar Neto ({formatCOP(netoPagar)})
              </button>
            </div>
          );
        })()}

        {/* 3. Monto a Pagar y Fecha */}
        <div className="grid-responsive-2" style={{ marginBottom: 14 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--text-primary)' }}>
              Monto a Pagar ($ COP):
            </label>
            <input
              type="number"
              className="search-input"
              style={{ width: '100%', fontSize: 16, fontWeight: 800, paddingLeft: 12, color: 'var(--accent)' }}
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
            <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4, color: 'var(--text-primary)' }}>
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
        {simulacion && Array.isArray(simulacion.afectaciones) && simulacion.afectaciones.length > 0 && (
          <div style={{
            background: 'rgba(34, 197, 94, 0.12)',
            border: '1.5px solid rgba(34, 197, 94, 0.35)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 14
          }}>
            <div style={{ fontSize: 11.5, fontWeight: 800, color: '#22c55e', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={14} color="#22c55e" />
              {sinRecibo ? '⚡ Imputación Contable (Cuota Actualizada):' : `Imputación Contable del Recibo Nº ${proximoReciboNum}:`}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {simulacion.afectaciones.filter(Boolean).map((a, aIdx) => (
                <div key={a.id || aIdx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-primary)' }}>
                  <span>
                    <strong>Cuota #{a.numero_cuota || (aIdx + 1)}</strong> (Vence: {formatDate(a.fecha_vencimiento)})
                  </span>
                  <span>
                    <strong style={{ color: '#22c55e' }}>+{formatCOP(a.valor_abono)}</strong>
                    {a.completo ? (
                      <span style={{ marginLeft: 6, color: '#22c55e', fontWeight: 700 }}>✓ Total</span>
                    ) : (
                      <span style={{ marginLeft: 6, color: '#d97706', fontWeight: 700 }}>
                        ⚠ Parcial (Resta {formatCOP(Math.max(0, (Number(a.valor_cuota) || 0) - (Number(a.nuevo_pagado) || 0)))})
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
          background: 'var(--bg-card2)',
          border: '1.5px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 14
        }}>
          <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
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
                border: medioPago === 'TRANSFERENCIA' ? '2px solid #3b82f6' : '1px solid var(--border)',
                background: medioPago === 'TRANSFERENCIA' ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-card)',
                color: medioPago === 'TRANSFERENCIA' ? '#3b82f6' : 'var(--text-secondary)',
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
                border: medioPago === 'EFECTIVO' ? '2px solid #16a34a' : '1px solid var(--border)',
                background: medioPago === 'EFECTIVO' ? 'rgba(22, 163, 74, 0.15)' : 'var(--bg-card)',
                color: medioPago === 'EFECTIVO' ? '#22c55e' : 'var(--text-secondary)',
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
            <div className="grid-responsive-2" style={{ gap: 10 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
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
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
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
              <div style={{ display: 'flex', gap: 16, marginBottom: 8, fontSize: 12, color: 'var(--text-primary)' }}>
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
                <div className="grid-responsive-2" style={{ gap: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
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
                    <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>
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
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>
              {sinRecibo ? 'Concepto del Pago / Actualización:' : 'Concepto del Recibo (Oficial):'}
            </label>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
              Incluye cuotas cubiertas, lote oficial y nombre del cliente
            </span>
          </div>
          <input
            type="text"
            className="search-input"
            style={{ width: '100%', fontSize: 12.5, fontWeight: 600, color: 'var(--text-primary)' }}
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
            <label style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-primary)' }}>
              {sinRecibo ? 'Observaciones / Justificación Contable:' : 'Observaciones del Recibo:'}
            </label>
            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid var(--border)' }}>
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
              background: sinRecibo ? '#059669' : '#16a34a',
              borderColor: sinRecibo ? '#059669' : '#16a34a',
              fontWeight: 800,
              fontSize: 13.5,
              padding: '9px 22px',
              gap: 8,
              boxShadow: sinRecibo ? '0 4px 6px -1px rgba(5, 150, 105, 0.3)' : '0 4px 6px -1px rgba(22, 163, 74, 0.3)'
            }}
            disabled={saving || !selectedVenta || montoNum <= 0}
          >
            {saving ? (
              'Procesando...'
            ) : sinRecibo ? (
              <>
                <CheckCircle2 size={17} /> Confirmar Pago y Actualizar Cuota (Sin Recibo)
              </>
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

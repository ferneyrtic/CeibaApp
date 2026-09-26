import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  DollarSign, Check, X, Search, User, MapPin, Calendar,
  CreditCard, ShieldCheck, ChevronDown, ChevronUp, AlertCircle,
  FileText, Sparkles, Building, Layers, RefreshCw
} from 'lucide-react';
import { getClientes } from '../lib/api/clientes';
import { getLotesDisponibles, getVendedores, generarPlanPagos, registrarVentaCompleta } from '../lib/api/ventas';
import { formatCOP, formatDate } from '../utils/helpers';
import Modal from './Modal';

const MEDIOS_PAGO = [
  'TRANSFERENCIA',
  'EFECTIVO',
  'CONSIGNACIÓN',
  'CHEQUE',
  'OTRO'
];

export default function ModalRegistrarVenta({
  preselectedLote = null,
  onClose,
  onSuccess
}) {
  // Datos maestros
  const [lotes, setLotes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Selección de lote
  const [selectedLoteId, setSelectedLoteId] = useState(preselectedLote?.id || '');
  const [searchLote, setSearchLote] = useState('');

  // Modo de cliente: 'existente' | 'nuevo'
  const [modoCliente, setModoCliente] = useState('existente');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [searchCliente, setSearchCliente] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    doc_cliente: '',
    celular: '',
    ciudad: 'Acacías',
    direccion: '',
  });

  // Vendedor y comisión
  const [vendedorNombre, setVendedorNombre] = useState('');
  const [comisionPct, setComisionPct] = useState(5);
  const [comisionManual, setComisionManual] = useState('');

  // Términos financieros
  const hoyStr = new Date().toISOString().slice(0, 10);
  const [fechaVenta, setFechaVenta] = useState(hoyStr);
  const [precioVenta, setPrecioVenta] = useState(preselectedLote?.precio_lote || preselectedLote?.precio_venta || 0);
  const [cuotaInicial, setCuotaInicial] = useState(0);
  const [fechaPagoInicial, setFechaPagoInicial] = useState(hoyStr);
  const [medioPagoInicial, setMedioPagoInicial] = useState('TRANSFERENCIA');

  // Financiación
  const [plazoCuotas, setPlazoCuotas] = useState(24);
  const [diasPago, setDiasPago] = useState(15);
  
  // Fecha primera cuota (default al mes siguiente)
  const defaultFechaPrimeraCuota = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(diasPago).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, [diasPago]);

  const [fechaPrimeraCuota, setFechaPrimeraCuota] = useState(defaultFechaPrimeraCuota);
  const [valorCuotaCustom, setValorCuotaCustom] = useState('');
  const [mostrarCronograma, setMostrarCronograma] = useState(false);
  const [observacion, setObservacion] = useState('');

  // Estados de proceso
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successData, setSuccessData] = useState(null);

  // Cargar datos iniciales
  useEffect(() => {
    let isMounted = true;
    async function loadAll() {
      setLoadingData(true);
      try {
        const [lotesRes, clientesRes, vendRes] = await Promise.all([
          getLotesDisponibles(),
          getClientes(),
          getVendedores(),
        ]);
        if (!isMounted) return;

        // Si hay lote preseleccionado que no vino en lotesRes, agregarlo
        let listLotes = lotesRes;
        if (preselectedLote && !listLotes.some(l => l.id === preselectedLote.id)) {
          listLotes = [preselectedLote, ...listLotes];
        }

        setLotes(listLotes);
        setClientes(clientesRes);
        setVendedores(vendRes);

        // Preseleccionar si venía
        if (preselectedLote) {
          setSelectedLoteId(preselectedLote.id);
          const p = Number(preselectedLote.precio_lote) || Number(preselectedLote.precio_venta) || 0;
          if (p > 0) setPrecioVenta(p);
        } else if (listLotes.length > 0) {
          setSelectedLoteId(listLotes[0].id);
          const p = Number(listLotes[0].precio_lote) || Number(listLotes[0].precio_venta) || 0;
          if (p > 0) setPrecioVenta(p);
        }

        if (vendRes.length > 0) {
          setVendedorNombre(vendRes[0].nombre);
          if (vendRes[0].porcentaje_comision) {
            setComisionPct(vendRes[0].porcentaje_comision);
          }
        }
      } catch (err) {
        console.error('Error cargando datos para venta:', err);
        if (isMounted) setErrorMsg('Error cargando catálogos de ventas: ' + err.message);
      } finally {
        if (isMounted) setLoadingData(false);
      }
    }
    loadAll();
    return () => { isMounted = false; };
  }, [preselectedLote]);

  // Lote seleccionado
  const currentLote = useMemo(() => {
    return lotes.find(l => l.id === selectedLoteId) || null;
  }, [lotes, selectedLoteId]);

  // Al cambiar lote seleccionado, actualizar precio de venta si no ha sido modificado manualmente
  const handleSelectLote = (loteObj) => {
    setSelectedLoteId(loteObj.id);
    const p = Number(loteObj.precio_lote) || Number(loteObj.precio_venta) || 0;
    if (p > 0) setPrecioVenta(p);
  };

  // Al cambiar vendedor, tomar su porcentaje de comisión
  const handleSelectVendedor = (vNombre) => {
    setVendedorNombre(vNombre);
    const found = vendedores.find(v => v.nombre === vNombre);
    if (found && found.porcentaje_comision) {
      setComisionPct(found.porcentaje_comision);
    }
  };

  // Cálculos financieros reactivos
  const pVentaNum = Number(precioVenta) || 0;
  const cInicialNum = Math.min(pVentaNum, Math.max(0, Number(cuotaInicial) || 0));
  const saldoFinanciado = Math.max(0, pVentaNum - cInicialNum);
  const esVentaContado = saldoFinanciado === 0 && pVentaNum > 0;

  // Cuota calculada
  const valorCuotaSugerido = useMemo(() => {
    if (saldoFinanciado <= 0 || !plazoCuotas || plazoCuotas <= 0) return 0;
    return Math.round(saldoFinanciado / plazoCuotas);
  }, [saldoFinanciado, plazoCuotas]);

  const valorCuotaFinal = valorCuotaCustom !== '' ? Number(valorCuotaCustom) : valorCuotaSugerido;

  // Comisión calculada
  const comisionFinal = useMemo(() => {
    if (comisionManual !== '') return Number(comisionManual) || 0;
    return Math.round((pVentaNum * (Number(comisionPct) || 0)) / 100);
  }, [pVentaNum, comisionPct, comisionManual]);

  // Generación del plan de pagos proyectado
  const planCuotas = useMemo(() => {
    if (esVentaContado || saldoFinanciado <= 0) return [];
    return generarPlanPagos({
      saldoFinanciado,
      plazoCuotas,
      valorCuota: valorCuotaFinal,
      diasPago,
      fechaPrimeraCuota,
    });
  }, [saldoFinanciado, plazoCuotas, valorCuotaFinal, diasPago, fechaPrimeraCuota, esVentaContado]);

  // Filtrado de lotes para selector
  const filteredLotes = useMemo(() => {
    if (!searchLote.trim()) return lotes;
    const s = searchLote.toLowerCase().trim();
    return lotes.filter(l =>
      (l.id_lote && l.id_lote.toLowerCase().includes(s)) ||
      (l.manzana && String(l.manzana).toLowerCase().includes(s)) ||
      (l.lote && String(l.lote).toLowerCase().includes(s))
    );
  }, [lotes, searchLote]);

  // Filtrado de clientes para selector
  const filteredClientes = useMemo(() => {
    if (!searchCliente.trim()) return clientes.slice(0, 30);
    const s = searchCliente.toLowerCase().trim();
    return clientes.filter(c =>
      (c.nombre && c.nombre.toLowerCase().includes(s)) ||
      (c.doc_cliente && String(c.doc_cliente).toLowerCase().includes(s)) ||
      (c.celular && String(c.celular).toLowerCase().includes(s))
    ).slice(0, 30);
  }, [clientes, searchCliente]);

  const currentCliente = useMemo(() => {
    if (modoCliente === 'nuevo') return nuevoCliente;
    return clientes.find(c => c.id === selectedClienteId) || null;
  }, [modoCliente, nuevoCliente, clientes, selectedClienteId]);

  // Validación y envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentLote) {
      setErrorMsg('Debe seleccionar un lote.');
      return;
    }

    if (modoCliente === 'existente' && !selectedClienteId) {
      setErrorMsg('Debe seleccionar un cliente de la lista o cambiar a "Nuevo Cliente".');
      return;
    }

    if (modoCliente === 'nuevo') {
      if (!nuevoCliente.nombre.trim()) {
        setErrorMsg('El nombre completo del nuevo cliente es obligatorio.');
        return;
      }
      if (!nuevoCliente.doc_cliente.trim()) {
        setErrorMsg('La cédula / documento del cliente es obligatoria.');
        return;
      }
    }

    if (pVentaNum <= 0) {
      setErrorMsg('El precio de venta debe ser mayor a $0.');
      return;
    }

    if (!esVentaContado && planCuotas.length === 0) {
      setErrorMsg('Debe especificar un plazo válido para generar las cuotas de financiación.');
      return;
    }

    setSubmitting(true);
    try {
      const clientePayload = modoCliente === 'existente'
        ? { id: selectedClienteId, nombre: currentCliente?.nombre }
        : {
            nombre: nuevoCliente.nombre.trim(),
            doc_cliente: nuevoCliente.doc_cliente.trim(),
            celular: nuevoCliente.celular.trim(),
            ciudad: nuevoCliente.ciudad.trim() || 'Acacías',
            direccion: nuevoCliente.direccion.trim(),
          };

      const result = await registrarVentaCompleta({
        lote: currentLote,
        cliente: clientePayload,
        vendedor_nombre: vendedorNombre || 'DIRECTO',
        comision_vendedor: comisionFinal,
        precio_venta: pVentaNum,
        valor_cuota_inicial: cInicialNum,
        fecha_pago_cuota_inicial: cInicialNum > 0 ? fechaPagoInicial : null,
        medio_pago: medioPagoInicial,
        fecha_venta: fechaVenta,
        plazo_cuotas: esVentaContado ? 0 : plazoCuotas,
        dias_pago: String(diasPago),
        valor_cuota: esVentaContado ? 0 : valorCuotaFinal,
        cuotas: planCuotas,
        observacion,
      });

      setSuccessData({
        venta: result,
        lote: currentLote,
        cliente: clientePayload,
        saldoFinanciado,
        cuotasGeneradas: planCuotas.length,
      });

      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err) {
      console.error('Error al registrar venta:', err);
      setErrorMsg(err.message || 'Error al procesar la venta en el servidor.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={880}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        borderBottom: '1px solid var(--border)',
        paddingBottom: 16,
        marginBottom: 20
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(22, 163, 74, 0.25)'
          }}>
            <DollarSign size={24} />
          </div>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', margin: 0 }}>
              Registrar Nueva Venta de Lote
            </h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              Crea la venta, actualiza el estado del lote y genera la cuenta por cobrar en Cartera
            </div>
          </div>
        </div>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', borderRadius: 8 }}
          onClick={onClose}
          disabled={submitting}
        >
          <X size={18} />
        </button>
      </div>

      {/* Pantalla de éxito */}
      {successData ? (
        <div style={{ padding: '24px 12px', textAlign: 'center' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: '#dcfce7',
            color: '#16a34a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <ShieldCheck size={36} />
          </div>
          <h3 style={{ fontSize: 22, fontWeight: 800, color: '#166534', margin: '0 0 8px' }}>
            ¡Venta Registrada Exitosamente!
          </h3>
          <p style={{ fontSize: 14, color: '#475569', maxWidth: 540, margin: '0 auto 20px', lineHeight: 1.5 }}>
            El lote <strong style={{ color: '#16a34a' }}>{successData.lote.id_lote}</strong> ha sido marcado como <strong>VENDIDO</strong> a nombre de <strong>{successData.cliente.nombre}</strong>.
            {successData.saldoFinanciado > 0 ? (
              <> Se generaron <strong>{successData.cuotasGeneradas} cuotas proyectadas</strong> por saldo financiado de <strong>{formatCOP(successData.saldoFinanciado)}</strong>, visible de inmediato en <strong>Cartera</strong>.</>
            ) : (
              <> La venta fue liquidada de <strong>contado</strong> por <strong>{formatCOP(precioVenta)}</strong>.</>
            )}
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <button
              className="btn btn-primary"
              style={{ padding: '10px 24px', fontWeight: 700 }}
              onClick={onClose}
            >
              Listo, Cerrar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {errorMsg && (
            <div style={{
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              padding: '12px 16px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 18,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <div>{errorMsg}</div>
            </div>
          )}

          {loadingData ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginBottom: 8 }} />
              <div>Cargando catálogos de lotes y clientes...</div>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* SECCIÓN 1: LOTE */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '16px 18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                    <MapPin size={16} color="#16a34a" /> 1. Lote a Vender
                  </div>
                  {currentLote && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 800,
                      padding: '3px 8px',
                      borderRadius: 6,
                      background: '#dcfce7',
                      color: '#166534'
                    }}>
                      {currentLote.estado || 'DISPONIBLE'}
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 5 }}>
                      Seleccionar Lote Disponible *
                    </label>
                    <select
                      className="form-control"
                      value={selectedLoteId}
                      onChange={e => {
                        const l = lotes.find(x => x.id === e.target.value);
                        if (l) handleSelectLote(l);
                      }}
                      style={{ width: '100%', fontWeight: 700, fontFamily: 'monospace' }}
                      required
                    >
                      <option value="">-- Seleccione un lote --</option>
                      {lotes.map(l => (
                        <option key={l.id} value={l.id}>
                          {l.id_lote} · {l.area_m2 ? `${l.area_m2}m² · ` : ''}{formatCOP(l.precio_lote || l.precio_venta)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {currentLote && (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      background: '#fff',
                      padding: '8px 14px',
                      borderRadius: 8,
                      border: '1px solid #e2e8f0',
                      fontSize: 12
                    }}>
                      <div>
                        <div style={{ color: '#64748b', fontSize: 11 }}>Etapa / Manzana</div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                          Etapa {currentLote.etapa || 1} · Mz {currentLote.manzana || '—'} Lote {currentLote.lote || '—'}
                        </div>
                      </div>
                      <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 14 }}>
                        <div style={{ color: '#64748b', fontSize: 11 }}>Área</div>
                        <div style={{ fontWeight: 700, color: '#1e293b' }}>
                          {currentLote.area_m2 ? `${currentLote.area_m2} m²` : '—'}
                        </div>
                      </div>
                      <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: 14 }}>
                        <div style={{ color: '#64748b', fontSize: 11 }}>Precio de Lista</div>
                        <div style={{ fontWeight: 700, color: '#16a34a' }}>
                          {formatCOP(currentLote.precio_lote || currentLote.precio_venta)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECCIÓN 2: CLIENTE */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '16px 18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#0f172a' }}>
                    <User size={16} color="#2563eb" /> 2. Comprador / Titular
                  </div>
                  
                  {/* Selector modo cliente */}
                  <div style={{ display: 'flex', gap: 4, background: '#e2e8f0', padding: 2, borderRadius: 6 }}>
                    <button
                      type="button"
                      onClick={() => setModoCliente('existente')}
                      style={{
                        border: 'none',
                        background: modoCliente === 'existente' ? '#fff' : 'transparent',
                        color: modoCliente === 'existente' ? '#0f172a' : '#64748b',
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      Cliente Existente
                    </button>
                    <button
                      type="button"
                      onClick={() => setModoCliente('nuevo')}
                      style={{
                        border: 'none',
                        background: modoCliente === 'nuevo' ? '#fff' : 'transparent',
                        color: modoCliente === 'nuevo' ? '#0f172a' : '#64748b',
                        padding: '3px 10px',
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 4,
                        cursor: 'pointer'
                      }}
                    >
                      + Nuevo Cliente
                    </button>
                  </div>
                </div>

                {modoCliente === 'existente' ? (
                  <div>
                    <div style={{ position: 'relative', marginBottom: 8 }}>
                      <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                      <input
                        type="text"
                        placeholder="Buscar cliente por nombre o cédula..."
                        value={searchCliente}
                        onChange={e => setSearchCliente(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '7px 10px 7px 32px',
                          fontSize: 12,
                          border: '1px solid #cbd5e1',
                          borderRadius: 6,
                          background: '#fff'
                        }}
                      />
                    </div>
                    <select
                      className="form-control"
                      value={selectedClienteId}
                      onChange={e => setSelectedClienteId(e.target.value)}
                      style={{ width: '100%', fontWeight: 600 }}
                      required={modoCliente === 'existente'}
                    >
                      <option value="">-- Seleccionar cliente ({filteredClientes.length} disponibles) --</option>
                      {filteredClientes.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.nombre} {c.doc_cliente ? `· CC ${c.doc_cliente}` : ''} {c.ciudad ? `(${c.ciudad})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Nombre Completo *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. Juan Pérez Gómez"
                        value={nuevoCliente.nombre}
                        onChange={e => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                        required={modoCliente === 'nuevo'}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Cédula / Documento *
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. 1121890123"
                        value={nuevoCliente.doc_cliente}
                        onChange={e => setNuevoCliente({ ...nuevoCliente, doc_cliente: e.target.value })}
                        required={modoCliente === 'nuevo'}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Celular / Teléfono
                      </label>
                      <input
                        type="tel"
                        className="form-control"
                        placeholder="Ej. 3101234567"
                        value={nuevoCliente.celular}
                        onChange={e => setNuevoCliente({ ...nuevoCliente, celular: e.target.value })}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Ciudad
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        value={nuevoCliente.ciudad}
                        onChange={e => setNuevoCliente({ ...nuevoCliente, ciudad: e.target.value })}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Dirección de Residencia
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Ej. Calle 15 # 20-30 Barrio Centro"
                        value={nuevoCliente.direccion}
                        onChange={e => setNuevoCliente({ ...nuevoCliente, direccion: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN 3: ASESOR Y CONDICIONES FINANCIERAS */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 10,
                padding: '16px 18px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 14, color: '#0f172a', marginBottom: 14 }}>
                  <CreditCard size={16} color="#d97706" /> 3. Condiciones de Venta y Financiación
                </div>

                {/* Vendedor y Fecha */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Asesor / Vendedor
                    </label>
                    <select
                      className="form-control"
                      value={vendedorNombre}
                      onChange={e => handleSelectVendedor(e.target.value)}
                      style={{ width: '100%', fontWeight: 600 }}
                    >
                      <option value="DIRECTO">VENTA DIRECTA (Sin Asesor)</option>
                      {vendedores.map(v => (
                        <option key={v.id} value={v.nombre}>
                          {v.nombre} ({v.porcentaje_comision || 5}%)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Fecha de la Venta *
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={fechaVenta}
                      onChange={e => setFechaVenta(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Comisión Asesor (COP)
                    </label>
                    <div style={{
                      background: '#fff',
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      color: '#2563eb'
                    }}>
                      {formatCOP(comisionFinal)}
                    </div>
                  </div>
                </div>

                {/* Precio, Cuota Inicial, Saldo */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 4 }}>
                      Precio Total de Venta (COP) *
                    </label>
                    <input
                      type="number"
                      step="1000"
                      className="form-control"
                      value={precioVenta}
                      onChange={e => setPrecioVenta(Number(e.target.value))}
                      style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}
                      required
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatCOP(pVentaNum)}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                      Valor Cuota Inicial (COP)
                    </label>
                    <input
                      type="number"
                      step="1000"
                      className="form-control"
                      value={cuotaInicial}
                      onChange={e => setCuotaInicial(Number(e.target.value))}
                      style={{ fontSize: 14, fontWeight: 600 }}
                    />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {formatCOP(cInicialNum)}
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: 12, fontWeight: 700, color: '#0f172a', display: 'block', marginBottom: 4 }}>
                      Saldo a Financiar (Cuenta por Cobrar)
                    </label>
                    <div style={{
                      background: saldoFinanciado > 0 ? '#fffbeb' : '#f0fdf4',
                      border: `1.5px solid ${saldoFinanciado > 0 ? '#fde68a' : '#86efac'}`,
                      borderRadius: 6,
                      padding: '8px 12px',
                      fontSize: 15,
                      fontWeight: 800,
                      color: saldoFinanciado > 0 ? '#b45309' : '#15803d'
                    }}>
                      {formatCOP(saldoFinanciado)}
                    </div>
                  </div>
                </div>

                {/* Si hubo cuota inicial, medio y fecha de pago */}
                {cInicialNum > 0 && (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 12,
                    background: '#fff',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px dashed #cbd5e1',
                    marginBottom: 14
                  }}>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Fecha Pago Cuota Inicial
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={fechaPagoInicial}
                        onChange={e => setFechaPagoInicial(e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                        Medio de Pago Cuota Inicial
                      </label>
                      <select
                        className="form-control"
                        value={medioPagoInicial}
                        onChange={e => setMedioPagoInicial(e.target.value)}
                      >
                        {MEDIOS_PAGO.map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {/* Plan de financiación si saldo > 0 */}
                {saldoFinanciado > 0 ? (
                  <div style={{
                    background: '#fff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    padding: 14
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10 }}>
                      🗓️ Estructura de Financiación (Cuotas Mensuales)
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 12 }}>
                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Plazo (Número de Cuotas) *
                        </label>
                        <select
                          className="form-control"
                          value={plazoCuotas}
                          onChange={e => setPlazoCuotas(Number(e.target.value))}
                          style={{ fontWeight: 700 }}
                        >
                          {[6, 12, 18, 24, 30, 36, 42, 48, 60].map(n => (
                            <option key={n} value={n}>{n} meses ({n} cuotas)</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Día de Pago Pactado *
                        </label>
                        <select
                          className="form-control"
                          value={diasPago}
                          onChange={e => setDiasPago(Number(e.target.value))}
                          style={{ fontWeight: 700 }}
                        >
                          {[5, 10, 15, 20, 25, 30].map(d => (
                            <option key={d} value={d}>Día {d} de cada mes</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Fecha de 1ª Cuota *
                        </label>
                        <input
                          type="date"
                          className="form-control"
                          value={fechaPrimeraCuota}
                          onChange={e => setFechaPrimeraCuota(e.target.value)}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                          Valor Cuota Mensual
                        </label>
                        <input
                          type="number"
                          className="form-control"
                          value={valorCuotaFinal}
                          onChange={e => setValorCuotaCustom(e.target.value)}
                          placeholder={formatCOP(valorCuotaSugerido)}
                          style={{ fontWeight: 700, color: '#16a34a' }}
                        />
                      </div>
                    </div>

                    {/* Acordeón para previsualizar cuotas */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 10 }}>
                      <button
                        type="button"
                        onClick={() => setMostrarCronograma(!mostrarCronograma)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#2563eb',
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: 0
                        }}
                      >
                        {mostrarCronograma ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {mostrarCronograma ? 'Ocultar calendario proyectado' : `Ver calendario proyectado de las ${planCuotas.length} cuotas`}
                      </button>

                      {mostrarCronograma && (
                        <div style={{
                          marginTop: 10,
                          maxHeight: 200,
                          overflowY: 'auto',
                          border: '1px solid #e2e8f0',
                          borderRadius: 6
                        }}>
                          <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                                <th style={{ padding: '6px 10px' }}># Cuota</th>
                                <th style={{ padding: '6px 10px' }}>Fecha Vencimiento</th>
                                <th style={{ padding: '6px 10px', textAlign: 'right' }}>Valor Cuota</th>
                                <th style={{ padding: '6px 10px', textAlign: 'center' }}>Estado Inicial</th>
                              </tr>
                            </thead>
                            <tbody>
                              {planCuotas.map(c => (
                                <tr key={c.numero_cuota} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                  <td style={{ padding: '5px 10px', fontWeight: 600 }}>Cuota {c.numero_cuota}</td>
                                  <td style={{ padding: '5px 10px', color: '#334155' }}>{formatDate(c.fecha_vencimiento)}</td>
                                  <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#16a34a' }}>
                                    {formatCOP(c.valor_cuota)}
                                  </td>
                                  <td style={{ padding: '5px 10px', textAlign: 'center' }}>
                                    <span style={{ background: '#f1f5f9', color: '#475569', padding: '1px 6px', borderRadius: 4, fontSize: 10 }}>
                                      {c.estado_cuota}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    color: '#15803d',
                    padding: '10px 14px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600
                  }}>
                    ✨ <strong>Venta de Contado:</strong> El valor de la cuota inicial cubre el 100% del precio del lote. El lote quedará en estado <strong>PAGADO EN SU TOTALIDAD</strong>.
                  </div>
                )}
              </div>

              {/* SECCIÓN 4: OBSERVACIONES */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
                  Observaciones Comerciales (Opcional)
                </label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Número de promesa de compraventa, acuerdos específicos de pago, etc."
                  value={observacion}
                  onChange={e => setObservacion(e.target.value)}
                  style={{ width: '100%', fontSize: 12 }}
                />
              </div>

              {/* Footer de botones */}
              <div style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 12,
                borderTop: '1px solid var(--border)',
                paddingTop: 16
              }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={onClose}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !selectedLoteId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 22px',
                    fontSize: 14,
                    fontWeight: 700
                  }}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Procesando Venta...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      Confirmar y Registrar Venta
                    </>
                  )}
                </button>
              </div>

            </div>
          )}
        </form>
      )}
    </Modal>
  );
}

import React, { useState, useEffect, useMemo } from 'react';
import { FileText, User, DollarSign, Calendar, CreditCard, AlertCircle, Download, Check, Sparkles } from 'lucide-react';
import Modal from './Modal';
import { getClientes } from '../lib/api/clientes';
import { getVendedores, generarPlanPagos } from '../lib/api/ventas';
import { obtenerArrasActiva, generarContratoLote } from '../lib/api/loteLifecycleApi';
import { exportContratoPDF } from '../utils/exportContrato';
import { formatCOP } from '../utils/helpers';

const MEDIOS_PAGO = ['TRANSFERENCIA', 'EFECTIVO', 'CONSIGNACIÓN', 'CHEQUE', 'OTRO'];

export default function ModalGenerarContrato({ lote, user, onClose, onSuccess }) {
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [arrasActiva, setArrasActiva] = useState(null);
  const [loadingInit, setLoadingInit] = useState(true);

  const [modoCliente, setModoCliente] = useState('nuevo');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    doc_cliente: '',
    celular: '',
    ciudad: 'Acacías',
  });
  const [tieneCotitular, setTieneCotitular] = useState(false);
  const [cotitular, setCotitular] = useState({ nombre: '', doc_cliente: '', ciudad: 'Bogotá' });

  const hoy = new Date().toISOString().slice(0, 10);
  const nextMonth15 = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-15`;
  })();

  const [precioVenta, setPrecioVenta] = useState(lote?.precio_lote || lote?.precio_venta || 28000000);
  const [arrasPrevias, setArrasPrevias] = useState(0);
  const [cuotaInicialHoy, setCuotaInicialHoy] = useState(4000000);
  const [fechaVenta, setFechaVenta] = useState(hoy);
  const [fechaPagoInicial, setFechaPagoInicial] = useState(hoy);
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA');
  const [banco, setBanco] = useState('Bancolombia');
  const [referencia, setReferencia] = useState('');

  const [plazoCuotas, setPlazoCuotas] = useState(24);
  const [diasPago, setDiasPago] = useState('15');
  const [fechaPrimeraCuota, setFechaPrimeraCuota] = useState(nextMonth15);
  const [valorCuotaCustom, setValorCuotaCustom] = useState('');
  const [vendedorNombre, setVendedorNombre] = useState('');
  const [comisionVendedor, setComisionVendedor] = useState('');
  const [cedulaCatastral, setCedulaCatastral] = useState('00-00-00-00-0017-0183-0-00-00-0000');
  const [matriculaInmob, setMatriculaInmob] = useState('232-62531');
  const [observacion, setObservacion] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([getClientes(), getVendedores(), obtenerArrasActiva(lote)])
      .then(([cls, vends, arras]) => {
        if (!mounted) return;
        setClientes(cls || []);
        setVendedores(vends || []);
        if (arras) {
          setArrasActiva(arras);
          const vArras = Number(arras.valor_arras) || 0;
          setArrasPrevias(vArras);
          setCuotaInicialHoy(Math.max(0, 4000000 - vArras));
          if (arras.vendedor_nombre) setVendedorNombre(arras.vendedor_nombre);
          if (arras.cliente_id) {
            setModoCliente('existente');
            setSelectedClienteId(arras.cliente_id);
          } else if (arras.cliente_nombre) {
            setModoCliente('nuevo');
            setNuevoCliente({
              nombre: arras.cliente_nombre,
              doc_cliente: arras.cliente_doc || '',
              celular: arras.cliente_celular || '',
              ciudad: arras.cliente_ciudad || 'Acacías',
            });
          }
        }
      })
      .finally(() => mounted && setLoadingInit(false));
    return () => { mounted = false; };
  }, [lote]);

  const inicialTotal = (Number(arrasPrevias) || 0) + (Number(cuotaInicialHoy) || 0);
  const saldoFinanciado = Math.max(0, (Number(precioVenta) || 0) - inicialTotal);
  const valorCuotaCalc = useMemo(() => {
    if (valorCuotaCustom && Number(valorCuotaCustom) > 0) return Number(valorCuotaCustom);
    const p = Number(plazoCuotas) || 1;
    return saldoFinanciado > 0 ? Math.round(saldoFinanciado / p) : 0;
  }, [saldoFinanciado, plazoCuotas, valorCuotaCustom]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    const cli = modoCliente === 'existente'
      ? clientes.find(c => c.id === selectedClienteId)
      : nuevoCliente;
    if (!cli) {
      setErrorMsg('Selecciona o ingresa los datos del comprador.');
      return;
    }

    setSubmitting(true);
    try {
      const cuotasPlan = saldoFinanciado > 0
        ? generarPlanPagos({
            saldoFinanciado,
            plazoCuotas: Number(plazoCuotas) || 24,
            valorCuota: valorCuotaCalc,
            diasPago: Number(diasPago) || 15,
            fechaPrimeraCuota,
          })
        : [];

      const res = await generarContratoLote({
        lote,
        cliente: cli,
        cotitular: tieneCotitular ? cotitular : null,
        arras_previas: Number(arrasPrevias) || 0,
        recibo_arras: arrasActiva?.numero_recibo || null,
        arras_dm_id: arrasActiva?.dm_id || null,
        cuota_inicial_hoy: Number(cuotaInicialHoy) || 0,
        precio_venta: Number(precioVenta) || 0,
        fecha_venta: fechaVenta,
        fecha_pago_inicial: fechaPagoInicial,
        medio_pago: medioPago,
        banco,
        referencia,
        plazo_cuotas: Number(plazoCuotas) || 0,
        dias_pago: diasPago,
        fecha_primera_cuota: fechaPrimeraCuota,
        valor_cuota: valorCuotaCalc,
        cuotas: cuotasPlan,
        vendedor_nombre: vendedorNombre,
        comision_vendedor: Number(comisionVendedor) || 0,
        cedula_catastral: cedulaCatastral,
        matricula_inmobiliaria: matriculaInmob,
        observacion,
        usuario: user,
      });

      // Descargar el PDF del contrato automáticamente
      if (res?.contratoData) {
        exportContratoPDF(res.contratoData);
      }

      onSuccess?.(res);
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || 'Error al generar el contrato.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Generar Contrato — ${lote?.id_lote || ''}`} onClose={onClose} width="760px">
      {loadingInit ? (
        <div style={{ padding: 30, textAlign: 'center', fontSize: 13 }}>Cargando datos del lote...</div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {arrasActiva && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, background: '#ecfdf5',
              border: '1px solid #86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
            }}>
              <div style={{ fontSize: 12, color: '#166534' }}>
                <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={14} /> Arras previas detectadas automáticamente
                </div>
                <div style={{ fontSize: 11, marginTop: 2 }}>
                  Titular: <strong>{arrasActiva.cliente_nombre}</strong> · Arras: <strong>{formatCOP(arrasActiva.valor_arras)}</strong>
                  {arrasActiva.numero_recibo ? ` (Recibo #${arrasActiva.numero_recibo})` : ''} · Se suman a la Cuota Inicial.
                </div>
              </div>
            </div>
          )}

          {/* Comprador */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-base)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                <User size={14} /> Promitente Comprador
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className={`btn ${modoCliente === 'existente' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setModoCliente('existente')}>
                  Existente
                </button>
                <button type="button" className={`btn ${modoCliente === 'nuevo' ? 'btn-primary' : 'btn-ghost'}`}
                  style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setModoCliente('nuevo')}>
                  Nuevo
                </button>
              </div>
            </div>

            {modoCliente === 'existente' ? (
              <select className="input" value={selectedClienteId} onChange={e => setSelectedClienteId(e.target.value)} required>
                <option value="">-- Seleccionar comprador --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.doc_cliente})</option>
                ))}
              </select>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 8 }}>
                <input className="input" required placeholder="Nombre completo *" value={nuevoCliente.nombre}
                  onChange={e => setNuevoCliente(p => ({ ...p, nombre: e.target.value }))} />
                <input className="input" required placeholder="Cédula *" value={nuevoCliente.doc_cliente}
                  onChange={e => setNuevoCliente(p => ({ ...p, doc_cliente: e.target.value }))} />
                <input className="input" placeholder="Celular" value={nuevoCliente.celular}
                  onChange={e => setNuevoCliente(p => ({ ...p, celular: e.target.value }))} />
                <input className="input" placeholder="Ciudad" value={nuevoCliente.ciudad}
                  onChange={e => setNuevoCliente(p => ({ ...p, ciudad: e.target.value }))} />
              </div>
            )}

            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginTop: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={tieneCotitular} onChange={e => setTieneCotitular(e.target.checked)} />
              Agregar segundo comprador (Cotitular en el contrato)
            </label>
            {tieneCotitular && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 6 }}>
                <input className="input" placeholder="Nombre cotitular" value={cotitular.nombre}
                  onChange={e => setCotitular(p => ({ ...p, nombre: e.target.value }))} />
                <input className="input" placeholder="Cédula cotitular" value={cotitular.doc_cliente}
                  onChange={e => setCotitular(p => ({ ...p, doc_cliente: e.target.value }))} />
                <input className="input" placeholder="Ciudad expedición" value={cotitular.ciudad}
                  onChange={e => setCotitular(p => ({ ...p, ciudad: e.target.value }))} />
              </div>
            )}
          </div>

          {/* Condiciones Económicas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Precio Venta *</label>
              <input type="number" className="input" required value={precioVenta}
                onChange={e => setPrecioVenta(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Arras Previas</label>
              <input type="number" className="input" value={arrasPrevias}
                onChange={e => setArrasPrevias(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Cuota Inicial Hoy</label>
              <input type="number" className="input" value={cuotaInicialHoy}
                onChange={e => setCuotaInicialHoy(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Saldo Financiado</label>
              <div style={{ padding: '7px 10px', borderRadius: 6, background: '#f1f5f9', fontWeight: 700, fontSize: 13 }}>
                {formatCOP(saldoFinanciado)}
              </div>
            </div>
          </div>

          {/* Financiación y Pago */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Plazo (Cuotas)</label>
              <input type="number" min="0" className="input" value={plazoCuotas}
                onChange={e => setPlazoCuotas(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Día de Pago Mensual</label>
              <input type="number" min="1" max="31" className="input" value={diasPago}
                onChange={e => setDiasPago(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Primera Cuota</label>
              <input type="date" className="input" value={fechaPrimeraCuota}
                onChange={e => setFechaPrimeraCuota(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Valor Cuota Mensual</label>
              <input type="number" className="input" placeholder={String(valorCuotaCalc)} value={valorCuotaCustom}
                onChange={e => setValorCuotaCustom(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Fecha Contrato</label>
              <input type="date" className="input" value={fechaVenta} onChange={e => setFechaVenta(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Medio Pago Inicial</label>
              <select className="input" value={medioPago} onChange={e => setMedioPago(e.target.value)}>
                {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Asesor / Vendedor</label>
              <input className="input" list="vendedores-cto" placeholder="DIRECTO" value={vendedorNombre}
                onChange={e => setVendedorNombre(e.target.value)} />
              <datalist id="vendedores-cto">
                {vendedores.map(v => <option key={v} value={v} />)}
              </datalist>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Comisión Asesor</label>
              <input type="number" className="input" placeholder="0" value={comisionVendedor}
                onChange={e => setComisionVendedor(e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Matrícula Inmobiliaria</label>
              <input className="input" value={matriculaInmob} onChange={e => setMatriculaInmob(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Cédula Catastral</label>
              <input className="input" value={cedulaCatastral} onChange={e => setCedulaCatastral(e.target.value)} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600 }}>Observaciones del Contrato</label>
              <input className="input" placeholder="Notas opcionales..." value={observacion}
                onChange={e => setObservacion(e.target.value)} />
            </div>
          </div>

          {errorMsg && (
            <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={15} /> {errorMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              Total Cuota Inicial: <strong>{formatCOP(inicialTotal)}</strong> · Cuota: <strong>{formatCOP(valorCuotaCalc)}</strong>
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}
                style={{ background: '#2563eb', borderColor: '#2563eb', gap: 6 }}>
                <Download size={14} /> {submitting ? 'Generando Contrato...' : 'Generar Contrato y Descargar PDF'}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}

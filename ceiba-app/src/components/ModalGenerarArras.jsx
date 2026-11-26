import React, { useState, useEffect, useMemo } from 'react';
import { BookmarkCheck, Search, User, Calendar, DollarSign, CreditCard, AlertCircle, Check } from 'lucide-react';
import Modal from './Modal';
import { getClientes } from '../lib/api/clientes';
import { getVendedores } from '../lib/api/ventas';
import { generarArrasLote } from '../lib/api/loteLifecycleApi';
import { formatCOP } from '../utils/helpers';

const MEDIOS_PAGO = ['TRANSFERENCIA', 'EFECTIVO', 'CONSIGNACIÓN', 'CHEQUE', 'OTRO'];

export default function ModalGenerarArras({ lote, user, onClose, onSuccess }) {
  const [clientes, setClientes] = useState([]);
  const [vendedores, setVendedores] = useState([]);
  const [modoCliente, setModoCliente] = useState('nuevo'); // 'existente' | 'nuevo'
  const [searchCliente, setSearchCliente] = useState('');
  const [selectedClienteId, setSelectedClienteId] = useState('');
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    doc_cliente: '',
    celular: '',
    ciudad: 'Acacías',
  });

  const hoy = new Date().toISOString().slice(0, 10);
  const en15Dias = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  })();

  const [valorArras, setValorArras] = useState('500000');
  const [fechaPago, setFechaPago] = useState(hoy);
  const [fechaLimite, setFechaLimite] = useState(en15Dias);
  const [medioPago, setMedioPago] = useState('TRANSFERENCIA');
  const [banco, setBanco] = useState('Bancolombia');
  const [referencia, setReferencia] = useState('');
  const [vendedorNombre, setVendedorNombre] = useState('');
  const [observacion, setObservacion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    Promise.all([getClientes(), getVendedores()])
      .then(([c, v]) => {
        setClientes(c || []);
        setVendedores(v || []);
      })
      .catch(console.error);
  }, []);

  const clientesFiltrados = useMemo(() => {
    const q = searchCliente.trim().toLowerCase();
    if (!q) return clientes.slice(0, 30);
    return clientes.filter(c =>
      c.nombre?.toLowerCase().includes(q) || c.doc_cliente?.toLowerCase().includes(q)
    ).slice(0, 30);
  }, [clientes, searchCliente]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    const clienteObj = modoCliente === 'existente'
      ? clientes.find(c => c.id === selectedClienteId)
      : nuevoCliente;

    if (!clienteObj) {
      setErrorMsg('Selecciona o ingresa los datos del cliente.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await generarArrasLote({
        lote,
        cliente: clienteObj,
        valor_arras: Number(valorArras),
        fecha_pago: fechaPago,
        fecha_limite: fechaLimite,
        medio_pago: medioPago,
        banco,
        referencia,
        vendedor_nombre: vendedorNombre,
        observacion,
        usuario: user,
      });
      onSuccess?.(res);
      onClose?.();
    } catch (err) {
      setErrorMsg(err.message || 'No se pudieron generar las arras.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal title={`Generar Arras — ${lote?.id_lote || ''}`} onClose={onClose} width="640px">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Banner informativo del lote */}
        <div style={{
          padding: '10px 14px', borderRadius: 10, background: '#fffbeb',
          border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8
        }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', display: 'flex', alignItems: 'center', gap: 6 }}>
              <BookmarkCheck size={15} /> Separación de Lote con Arras
            </div>
            <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>
              Área: <strong>{lote?.area_m2 || 160} m²</strong> · Precio lista: <strong>{formatCOP(lote?.precio_lote || lote?.precio_venta || 0)}</strong>
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            background: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d'
          }}>
            Pasará a APARTADO / ARRAS
          </span>
        </div>

        {/* Selección / creación de cliente */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12, background: 'var(--bg-base)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} /> Cliente que separa el lote
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button type="button" className={`btn ${modoCliente === 'nuevo' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setModoCliente('nuevo')}>
                Nuevo Cliente
              </button>
              <button type="button" className={`btn ${modoCliente === 'existente' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setModoCliente('existente')}>
                Cliente Existente
              </button>
            </div>
          </div>

          {modoCliente === 'existente' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ position: 'relative' }}>
                <Search size={13} style={{ position: 'absolute', left: 10, top: 10, color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  style={{ paddingLeft: 30, fontSize: 12 }}
                  placeholder="Buscar cliente por nombre o cédula..."
                  value={searchCliente}
                  onChange={e => setSearchCliente(e.target.value)}
                />
              </div>
              <select
                className="input"
                style={{ fontSize: 12 }}
                value={selectedClienteId}
                onChange={e => setSelectedClienteId(e.target.value)}
                required
              >
                <option value="">-- Seleccionar cliente --</option>
                {clientesFiltrados.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.doc_cliente})</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Nombre completo *</label>
                <input className="input" required placeholder="Ej: JUAN PEREZ" value={nuevoCliente.nombre}
                  onChange={e => setNuevoCliente(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Cédula / NIT *</label>
                <input className="input" required placeholder="Ej: 1121888999" value={nuevoCliente.doc_cliente}
                  onChange={e => setNuevoCliente(p => ({ ...p, doc_cliente: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Celular</label>
                <input className="input" placeholder="310 000 0000" value={nuevoCliente.celular}
                  onChange={e => setNuevoCliente(p => ({ ...p, celular: e.target.value }))} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 600 }}>Ciudad</label>
                <input className="input" value={nuevoCliente.ciudad}
                  onChange={e => setNuevoCliente(p => ({ ...p, ciudad: e.target.value }))} />
              </div>
            </div>
          )}
        </div>

        {/* Datos del pago de Arras */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <DollarSign size={12} /> Valor Arras *
            </label>
            <input type="number" min="1" className="input" required value={valorArras}
              onChange={e => setValorArras(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} /> Fecha Pago *
            </label>
            <input type="date" className="input" required value={fechaPago}
              onChange={e => setFechaPago(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Calendar size={12} /> Válidas hasta *
            </label>
            <input type="date" className="input" required value={fechaLimite}
              onChange={e => setFechaLimite(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CreditCard size={12} /> Medio de Pago
            </label>
            <select className="input" value={medioPago} onChange={e => setMedioPago(e.target.value)}>
              {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Banco / Cuenta</label>
            <input className="input" placeholder="Bancolombia / Davivienda" value={banco}
              onChange={e => setBanco(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Referencia / Comprobante</label>
            <input className="input" placeholder="Ej: M123456" value={referencia}
              onChange={e => setReferencia(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Asesor / Vendedor</label>
            <input className="input" list="vendedores-arras" placeholder="DIRECTO" value={vendedorNombre}
              onChange={e => setVendedorNombre(e.target.value)} />
            <datalist id="vendedores-arras">
              {vendedores.map(v => <option key={v} value={v} />)}
            </datalist>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600 }}>Observaciones</label>
            <input className="input" placeholder="Ej: Arras no devolutivas, plazo 15 días para firma"
              value={observacion} onChange={e => setObservacion(e.target.value)} />
          </div>
        </div>

        {errorMsg && (
          <div style={{ padding: 10, borderRadius: 8, background: '#fef2f2', color: '#dc2626', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertCircle size={15} /> {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}
            style={{ background: '#d97706', borderColor: '#d97706', gap: 6 }}>
            <Check size={14} /> {submitting ? 'Emitiendo Recibo...' : 'Confirmar Arras y Emitir Recibo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

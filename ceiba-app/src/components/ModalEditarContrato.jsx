import React, { useState } from 'react';
import { UserCheck, X, AlertCircle, Eye, FileText } from 'lucide-react';
import Modal from './Modal';
import { formatCOP } from '../utils/helpers';
import { updateVenta } from '../lib/api/ventas';
import { updateCliente, createCliente } from '../lib/api/clientes';
import { supabase } from '../lib/supabase';
import { registrarAccion } from '../lib/api/auditApi';

export default function ModalEditarContrato({ venta, onClose, onSuccess, readOnly = false }) {
  // Datos del Cliente
  const [docCliente, setDocCliente] = useState(venta?.clientes?.doc_cliente || '');
  const [nombreCliente, setNombreCliente] = useState(venta?.clientes?.nombre || venta?.cliente_nombre || '');
  const [celular, setCelular] = useState(venta?.clientes?.celular || '');
  const [ciudad, setCiudad] = useState(venta?.clientes?.ciudad || '');
  const [direccion, setDireccion] = useState(venta?.clientes?.direccion || '');

  // Datos Financieros del Contrato
  const [precioVenta, setPrecioVenta] = useState(venta?.precio_venta || '');
  const [cuotaInicial, setCuotaInicial] = useState(venta?.valor_cuota_inicial || '');
  const [fechaPagoCI, setFechaPagoCI] = useState(venta?.fecha_pago_cuota_inicial || '');
  const [saldoFinanciado, setSaldoFinanciado] = useState(venta?.saldo_financiado || '');
  const [plazoCuotas, setPlazoCuotas] = useState(venta?.plazo_cuotas || '');
  const [valorCuota, setValorCuota] = useState(venta?.valor_cuota || '');
  const [diasPago, setDiasPago] = useState(venta?.dias_pago || '');
  const [fechaVenta, setFechaVenta] = useState(venta?.fecha_venta || '');
  const [vendedorNombre, setVendedorNombre] = useState(venta?.vendedor_nombre || '');
  const [medioPago, setMedioPago] = useState(venta?.medio_pago || 'TRANSFERENCIA');
  const [estadoVenta, setEstadoVenta] = useState(venta?.estado || 'VENDIDO');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const inputStyle = (extra = {}) => ({
    width: '100%',
    ...(readOnly ? {
      background: '#f8fafc',
      borderColor: '#e2e8f0',
      color: '#0f172a',
      fontWeight: 600,
      cursor: 'default',
      userSelect: 'text'
    } : {}),
    ...extra
  });

  // Auto-cálculo de saldo financiado si cambian precio o cuota inicial
  const handlePrecioChange = (pv) => {
    if (readOnly) return;
    setPrecioVenta(pv);
    const ci = Number(cuotaInicial) || 0;
    const p = Number(pv) || 0;
    if (p > ci) setSaldoFinanciado(p - ci);
  };

  const handleCIChange = (ci) => {
    if (readOnly) return;
    setCuotaInicial(ci);
    const p = Number(precioVenta) || 0;
    const c = Number(ci) || 0;
    if (p > c) setSaldoFinanciado(p - c);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (readOnly) return;
    setSaving(true);
    setError(null);

    try {
      let clienteId = venta?.clientes?.id;

      // 1. Actualizar o crear Cliente si tiene documento o nombre
      if (nombreCliente) {
        if (clienteId) {
          const updated = await updateCliente(clienteId, {
            doc_cliente: docCliente ? String(docCliente).trim() : null,
            nombre: nombreCliente.trim(),
            celular: celular ? String(celular).trim() : null,
            ciudad: ciudad ? ciudad.trim() : null,
            direccion: direccion ? direccion.trim() : null,
          });
          if (updated && updated.id) {
            clienteId = updated.id;
          }
        } else if (docCliente) {
          // Si no tenía cliente_id pero ahora se le asignó cédula
          const { data: cliExistente } = await supabase
            .from('clientes')
            .select('id')
            .eq('doc_cliente', String(docCliente).trim())
            .single();

          if (cliExistente) {
            clienteId = cliExistente.id;
          } else {
            const nuevoCli = await createCliente({
              doc_cliente: String(docCliente).trim(),
              nombre: nombreCliente.trim(),
              celular: celular ? String(celular).trim() : null,
              ciudad: ciudad ? ciudad.trim() : null,
              direccion: direccion ? direccion.trim() : null,
            });
            clienteId = nuevoCli.id;
          }
        }
      }

      // 2. Actualizar Contrato / Venta
      await updateVenta(venta.id, {
        cliente_id: clienteId || venta.cliente_id,
        precio_venta: Number(precioVenta) || 0,
        valor_cuota_inicial: Number(cuotaInicial) || 0,
        fecha_pago_cuota_inicial: fechaPagoCI || null,
        saldo_financiado: Number(saldoFinanciado) || 0,
        plazo_cuotas: plazoCuotas ? Number(plazoCuotas) : null,
        valor_cuota: Number(valorCuota) || 0,
        dias_pago: diasPago || null,
        fecha_venta: fechaVenta || null,
        vendedor_nombre: vendedorNombre || null,
        medio_pago: medioPago || null,
        estado: estadoVenta,
      });

      // Sincronizar también con la tabla de lotes (estado, precio y propietario titular)
      const loteId = venta.lote_id || venta.lotes?.id;
      if (loteId) {
        try {
          const lotesUpdates = {};
          if (estadoVenta) lotesUpdates.estado = estadoVenta;
          if (nombreCliente) lotesUpdates.propietario = nombreCliente.trim();
          if (precioVenta) lotesUpdates.precio_venta = Number(precioVenta);

          await supabase
            .from('lotes')
            .update(lotesUpdates)
            .eq('id', loteId);
        } catch (syncErr) {
          console.warn('Advertencia al sincronizar estado y propietario en lotes:', syncErr);
        }
      }

      // Registrar en el Log de Auditoría
      try {
        await registrarAccion({
          modulo: 'CONTRATOS',
          accion: 'CONTRATO_ACTUALIZADO',
          lote_id_str: venta?.id_lote || venta?.lotes?.id_lote || `Venta #${venta.id}`,
          lote_id: loteId,
          cliente_nombre: nombreCliente || '—',
          descripcion: `Actualización de contrato y cliente: ${nombreCliente}. Precio venta: $${Number(precioVenta || 0).toLocaleString('es-CO')}, Inicial: $${Number(cuotaInicial || 0).toLocaleString('es-CO')}, Estado: ${estadoVenta}`,
          detalles: { ventaId: venta.id, precioVenta, cuotaInicial, estadoVenta, vendedorNombre }
        });
      } catch (logErr) {
        console.warn('Aviso guardando log de contrato:', logErr);
      }

      if (onSuccess) onSuccess();
      onClose();

    } catch (err) {
      console.error(err);
      setError(err.message || 'Error actualizando el contrato');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth={640} zIndex={100010}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {readOnly ? <Eye size={18} color="#0284c7" /> : <UserCheck size={18} color="var(--accent)" />}
          <span>{readOnly ? 'Ficha Técnica del Contrato' : 'Editar Contrato y Titular'} — Lote {venta?.id_lote || venta?.lotes?.id_lote}</span>
          {readOnly && (
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              padding: '2px 8px',
              borderRadius: 12
            }}>
              👁 Modo Lectura
            </span>
          )}
        </div>
        <button className="btn btn-ghost" onClick={onClose} style={{ padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {error && !readOnly && (
        <div className="alert-banner red" style={{ marginBottom: 12 }}>
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Sección Titular */}
        <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            👤 Datos del Titular / Cliente
          </div>
          <div className="grid-responsive-2" style={{ gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Cédula / Documento:
              </label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                placeholder={readOnly ? '—' : 'Ej: 79872109'}
                value={docCliente}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setDocCliente(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Nombre y Apellidos:
              </label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                placeholder={readOnly ? '—' : 'Nombre completo'}
                value={nombreCliente}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setNombreCliente(e.target.value)}
                required={!readOnly}
              />
            </div>
          </div>

          <div className="grid-responsive-3" style={{ gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Celular:</label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                value={celular || (readOnly ? '—' : '')}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setCelular(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Ciudad:</label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                value={ciudad || (readOnly ? '—' : '')}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setCiudad(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Dirección:</label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                value={direccion || (readOnly ? '—' : '')}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setDireccion(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Sección Condiciones Financieras */}
        <div style={{ background: 'var(--bg-card2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>
            💰 Condiciones Financieras del Contrato
          </div>

          <div className="grid-responsive-3" style={{ gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Precio Venta ($):</label>
              <input
                type={readOnly ? 'text' : 'number'}
                className="search-input"
                style={inputStyle()}
                value={readOnly ? (precioVenta ? formatCOP(precioVenta) : '$0') : precioVenta}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => handlePrecioChange(e.target.value)}
                required={!readOnly}
              />
              {!readOnly && precioVenta > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(precioVenta)}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Cuota Inicial ($):</label>
              <input
                type={readOnly ? 'text' : 'number'}
                className="search-input"
                style={inputStyle()}
                value={readOnly ? (cuotaInicial ? formatCOP(cuotaInicial) : '$0') : cuotaInicial}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => handleCIChange(e.target.value)}
              />
              {!readOnly && cuotaInicial > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(cuotaInicial)}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Saldo Financiado ($):</label>
              <input
                type={readOnly ? 'text' : 'number'}
                className="search-input"
                style={inputStyle()}
                value={readOnly ? (saldoFinanciado ? formatCOP(saldoFinanciado) : '$0') : saldoFinanciado}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setSaldoFinanciado(e.target.value)}
              />
              {!readOnly && saldoFinanciado > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(saldoFinanciado)}</span>}
            </div>
          </div>

          <div className="grid-responsive-3" style={{ gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Plazo (# cuotas):</label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                placeholder={readOnly ? '—' : 'Ej: 24'}
                value={readOnly ? (plazoCuotas ? `${plazoCuotas} cuotas` : '—') : plazoCuotas}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setPlazoCuotas(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Valor Cuota ($):</label>
              <input
                type={readOnly ? 'text' : 'number'}
                className="search-input"
                style={inputStyle()}
                value={readOnly ? (valorCuota ? formatCOP(valorCuota) : '$0') : valorCuota}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setValorCuota(e.target.value)}
              />
              {!readOnly && valorCuota > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(valorCuota)}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Días de Pago:</label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                placeholder={readOnly ? '—' : 'Ej: 20 DE CADA MES'}
                value={diasPago || (readOnly ? '—' : '')}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setDiasPago(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-responsive-3" style={{ gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Fecha Venta:</label>
              <input
                type={readOnly ? 'text' : 'date'}
                className="search-input"
                style={inputStyle()}
                value={readOnly ? (fechaVenta || '— Sin fecha registrada —') : fechaVenta}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setFechaVenta(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Fecha Pago Inicial:</label>
              <input
                type={readOnly ? 'text' : 'date'}
                className="search-input"
                style={inputStyle()}
                value={readOnly ? (fechaPagoCI || '—') : fechaPagoCI}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setFechaPagoCI(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Vendedor:</label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                value={vendedorNombre || (readOnly ? '— Sin vendedor asignado —' : '')}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setVendedorNombre(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-responsive-2" style={{ gap: 10, marginTop: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 3 }}>
                Estado del Lote / Contrato:
              </label>
              {readOnly ? (
                <input
                  type="text"
                  className="search-input"
                  style={inputStyle({ fontWeight: 700, color: estadoVenta === 'VENDIDO' ? '#16a34a' : (estadoVenta === 'PAGADO EN SU TOTALIDAD' ? '#2563eb' : '#d97706') })}
                  value={estadoVenta || '—'}
                  readOnly
                />
              ) : (
                <select
                  className="filter-select"
                  style={{ width: '100%' }}
                  value={estadoVenta}
                  onChange={e => setEstadoVenta(e.target.value)}
                >
                  {['VENDIDO', 'PAGADO EN SU TOTALIDAD', 'EN NEGOCIACIÓN', 'APARTADO', 'DISPONIBLE', 'NO APTO PARA VENTA'].map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                Medio de Pago Principal:
              </label>
              <input
                type="text"
                className="search-input"
                style={inputStyle()}
                value={medioPago || (readOnly ? '—' : '')}
                readOnly={readOnly}
                onChange={readOnly ? undefined : e => setMedioPago(e.target.value)}
                placeholder="TRANSFERENCIA, EFECTIVO..."
              />
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          {readOnly ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onClose}
              style={{ background: '#0284c7', borderColor: '#0284c7', padding: '7px 24px', fontWeight: 700 }}
            >
              Cerrar
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </>
          )}
        </div>
      </form>
    </Modal>
  );
}

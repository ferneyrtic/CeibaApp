import React, { useState } from 'react';
import { UserCheck, X, AlertCircle } from 'lucide-react';
import Modal from './Modal';
import { formatCOP } from '../utils/helpers';
import { updateVenta } from '../lib/api/ventas';
import { updateCliente, createCliente } from '../lib/api/clientes';
import { supabase } from '../lib/supabase';
import { registrarAccion } from '../lib/api/auditApi';

export default function ModalEditarContrato({ venta, onClose, onSuccess }) {
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

  // Auto-cálculo de saldo financiado si cambian precio o cuota inicial
  const handlePrecioChange = (pv) => {
    setPrecioVenta(pv);
    const ci = Number(cuotaInicial) || 0;
    const p = Number(pv) || 0;
    if (p > ci) setSaldoFinanciado(p - ci);
  };

  const handleCIChange = (ci) => {
    setCuotaInicial(ci);
    const p = Number(precioVenta) || 0;
    const c = Number(ci) || 0;
    if (p > c) setSaldoFinanciado(p - c);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let clienteId = venta?.clientes?.id;

      // 1. Actualizar o crear Cliente si tiene documento o nombre
      if (nombreCliente) {
        if (clienteId) {
          await updateCliente(clienteId, {
            doc_cliente: docCliente ? String(docCliente).trim() : null,
            nombre: nombreCliente.trim(),
            celular: celular ? String(celular).trim() : null,
            ciudad: ciudad ? ciudad.trim() : null,
            direccion: direccion ? direccion.trim() : null,
          });
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

      // Sincronizar también con la tabla de lotes
      const loteId = venta.lote_id || venta.lotes?.id;
      if (loteId && estadoVenta) {
        try {
          await supabase
            .from('lotes')
            .update({ estado: estadoVenta })
            .eq('id', loteId);
        } catch (syncErr) {
          console.warn('Advertencia al sincronizar estado en lotes:', syncErr);
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
    <Modal onClose={onClose} maxWidth={640}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserCheck size={18} color="var(--accent)" />
          Editar Contrato y Titular — Lote {venta?.id_lote || venta?.lotes?.id_lote}
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

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Sección Titular */}
        <div style={{ background: '#f8fafc', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
            👤 Datos del Titular / Cliente
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Cédula / Documento:
              </label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ej: 79872109"
                value={docCliente}
                onChange={e => setDocCliente(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>
                Nombre y Apellidos:
              </label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Nombre completo"
                value={nombreCliente}
                onChange={e => setNombreCliente(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Celular:</label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={celular}
                onChange={e => setCelular(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Ciudad:</label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={ciudad}
                onChange={e => setCiudad(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Dirección:</label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={direccion}
                onChange={e => setDireccion(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Sección Condiciones Financieras */}
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', marginBottom: 8 }}>
            💰 Condiciones Financieras del Contrato
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Precio Venta ($):</label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                value={precioVenta}
                onChange={e => handlePrecioChange(e.target.value)}
                required
              />
              {precioVenta > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(precioVenta)}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Cuota Inicial ($):</label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                value={cuotaInicial}
                onChange={e => handleCIChange(e.target.value)}
              />
              {cuotaInicial > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(cuotaInicial)}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Saldo Financiado ($):</label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                value={saldoFinanciado}
                onChange={e => setSaldoFinanciado(e.target.value)}
              />
              {saldoFinanciado > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(saldoFinanciado)}</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 8 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Plazo (# cuotas):</label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ej: 24"
                value={plazoCuotas}
                onChange={e => setPlazoCuotas(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Valor Cuota ($):</label>
              <input
                type="number"
                className="search-input"
                style={{ width: '100%' }}
                value={valorCuota}
                onChange={e => setValorCuota(e.target.value)}
              />
              {valorCuota > 0 && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatCOP(valorCuota)}</span>}
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, display: 'block', marginBottom: 3 }}>Días de Pago:</label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                placeholder="Ej: 20 DE CADA MES"
                value={diasPago}
                onChange={e => setDiasPago(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Fecha Venta:</label>
              <input
                type="date"
                className="search-input"
                style={{ width: '100%' }}
                value={fechaVenta}
                onChange={e => setFechaVenta(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Fecha Pago Inicial:</label>
              <input
                type="date"
                className="search-input"
                style={{ width: '100%' }}
                value={fechaPagoCI}
                onChange={e => setFechaPagoCI(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>Vendedor:</label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={vendedorNombre}
                onChange={e => setVendedorNombre(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: 3 }}>
                Estado del Lote / Contrato:
              </label>
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
            </div>
            <div>
              <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 3 }}>
                Medio de Pago Principal:
              </label>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%' }}
                value={medioPago}
                onChange={e => setMedioPago(e.target.value)}
                placeholder="TRANSFERENCIA, EFECTIVO..."
              />
            </div>
          </div>
        </div>


        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

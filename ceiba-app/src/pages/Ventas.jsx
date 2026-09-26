import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Search, X, RefreshCw, DollarSign, User, Download, FileText } from 'lucide-react';
import { getVentas } from '../lib/api/ventas';
import { formatCOP, formatDate, getEstadoBadge } from '../utils/helpers';
import { exportEstadoCuentaPDF } from '../utils/exportEstadoCuenta';
import Modal from '../components/Modal';
import Pagination from '../components/Pagination';
import ModalRegistrarVenta from '../components/ModalRegistrarVenta';

export default function Ventas() {
  const [allVentas, setAllVentas] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(null);
  const [showModalVenta, setShowModalVenta] = useState(false);

  // Paginación
  const [page, setPage]           = useState(1);
  const [pageSize, setPageSize]   = useState(50);

  const fetchVentas = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVentas();
      setAllVentas(data || []);
    } catch (err) {
      console.error('Error cargando ventas:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVentas();
  }, [fetchVentas]);

  // Filtrado 100% en memoria
  const filteredVentas = useMemo(() => {
    if (!search.trim()) return allVentas;
    const s = search.toLowerCase().trim();
    return allVentas.filter(v =>
      (v.id_lote && v.id_lote.toLowerCase().includes(s)) ||
      (v.lotes?.id_lote && v.lotes.id_lote.toLowerCase().includes(s)) ||
      (v.clientes?.nombre && v.clientes.nombre.toLowerCase().includes(s)) ||
      (v.vendedor_nombre && v.vendedor_nombre.toLowerCase().includes(s)) ||
      (v.clientes?.doc_cliente && String(v.clientes.doc_cliente).toLowerCase().includes(s))
    );
  }, [allVentas, search]);

  const paginatedVentas = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredVentas.slice(start, start + pageSize);
  }, [filteredVentas, page, pageSize]);

  const totalVentas = filteredVentas.reduce((a, v) => a + (v.precio_venta || 0), 0);
  const totalSaldo  = filteredVentas.reduce((a, v) => a + (v.saldo || 0), 0);

  const idLote   = v => v.lotes?.id_lote      ?? v.id_lote   ?? '—';
  const nombre   = v => v.clientes?.nombre     ?? '—';
  const ciudad   = v => v.clientes?.ciudad     ?? v.ciudad    ?? '—';

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Ventas</div>
          <div className="page-subtitle">
            {loading ? 'Cargando ventas...' : `${allVentas.length} ventas registradas · Total visible ${formatCOP(totalVentas)}`}
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModalVenta(true)}>
          <Plus size={14} /> Registrar Venta
        </button>
      </div>

      <div className="stats-row">
        {[
          { label:'Total Ventas',       val: formatCOP(totalVentas), color:'#16a34a' },
          { label:'Saldo Pendiente',    val: formatCOP(totalSaldo),  color:'#d97706' },
          { label:'Vendedores activos', val: [...new Set(allVentas.map(v => v.vendedor_nombre).filter(Boolean))].length, color:'#2563eb' },
        ].map(s => (
          <div key={s.label} className="stat-chip">
            <span className="stat-dot" style={{ background: s.color }} />
            <span className="stat-chip-val" style={{ color: s.color }}>{s.val}</span>
            <span className="stat-chip-label">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="search-bar">
        <div style={{ position:'relative', flex:1 }}>
          <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft:36 }}
            placeholder="Buscar por lote, cliente o vendedor..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <button className="btn btn-ghost" onClick={fetchVentas} title="Refrescar ventas">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="table-container">
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="table-header-title">Ventas ({filteredVentas.length})</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Mostrando {paginatedVentas.length} de {filteredVentas.length}
          </span>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }} />
            Cargando ventas...
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Lote</th>
                    <th>Cliente</th>
                    <th>Ciudad</th>
                    <th>Fecha</th>
                    <th>Precio Venta</th>
                    <th>Cuota Inicial</th>
                    <th>Saldo</th>
                    <th>Vendedor</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedVentas.map((v, i) => {
                    const rowNum = (page - 1) * pageSize + i + 1;
                    return (
                      <tr key={v.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(v)}>
                        <td style={{ color: 'var(--text-muted)', fontSize: 11 }}>{rowNum}</td>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{idLote(v)}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{nombre(v)}</div>
                          {v.clientes?.doc_cliente && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>CC {v.clientes.doc_cliente}</div>
                          )}
                        </td>
                        <td>{ciudad(v)}</td>
                        <td>{v.fecha_venta ? formatDate(v.fecha_venta) : '—'}</td>
                        <td style={{ fontWeight: 600 }}>{formatCOP(v.precio_venta)}</td>
                        <td>{formatCOP(v.valor_cuota_inicial)}</td>
                        <td style={{ fontWeight: 700, color: v.saldo > 0 ? '#d97706' : '#16a34a' }}>
                          {formatCOP(v.saldo)}
                        </td>
                        <td>{v.vendedor_nombre ?? '—'}</td>
                        <td onClick={e => e.stopPropagation()}>
                          <button
                            className="btn btn-ghost"
                            style={{ padding: '4px 8px', fontSize: 12, gap: 4 }}
                            onClick={() => setSelected(v)}
                          >
                            <FileText size={12} /> Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredVentas.length === 0 && (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                        No se encontraron ventas que coincidan con la búsqueda
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <Pagination
              currentPage={page}
              totalItems={filteredVentas.length}
              pageSize={pageSize}
              pageSizeOptions={[25, 50, 100]}
              onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
              onPageChange={(p) => setPage(p)}
            />
          </>
        )}
      </div>

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:18, fontWeight:700, fontFamily:'monospace' }}>{idLote(selected)}</div>
              <div style={{ fontSize:14, color:'var(--text-muted)' }}>{nombre(selected)}</div>
            </div>
            <button className="btn btn-ghost" style={{ padding:'6px 10px' }} onClick={() => setSelected(null)}>✕</button>
          </div>

          <div className="detail-grid">
            {[
              ['Precio de Venta',       formatCOP(selected.precio_venta)],
              ['Cuota Inicial',         formatCOP(selected.valor_cuota_inicial)],
              ['Saldo Financiado',      formatCOP(selected.saldo_financiado)],
              ['Saldo Actual',          formatCOP(selected.saldo)],
              ['Fecha Venta',           selected.fecha_venta ? formatDate(selected.fecha_venta) : '—'],
              ['Fecha Pago Inicial',    selected.fecha_pago_cuota_inicial ? formatDate(selected.fecha_pago_cuota_inicial) : '—'],
              ['Plazo Cuotas',          selected.plazo_cuotas ? `${selected.plazo_cuotas} meses` : '—'],
              ['Valor Cuota',           formatCOP(selected.valor_cuota)],
              ['Día de Pago',           selected.dias_pago ?? '—'],
              ['Medio de Pago',         selected.medio_pago ?? '—'],
              ['Vendedor',              selected.vendedor_nombre ?? '—'],
              ['Comisión Vendedor',     formatCOP(selected.comision_vendedor)],
            ].map(([l,v]) => (
              <div className="detail-item" key={l}>
                <div className="detail-label">{l}</div>
                <div className="detail-value">{v}</div>
              </div>
            ))}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
            <button
              className="btn btn-primary"
              style={{ display:'flex', alignItems:'center', gap:6 }}
              onClick={() => exportEstadoCuentaPDF(selected)}
            >
              <Download size={13} /> Exportar PDF
            </button>
          </div>
        </Modal>
      )}

      {showModalVenta && (
        <ModalRegistrarVenta
          onClose={() => setShowModalVenta(false)}
          onSuccess={() => {
            fetchVentas();
          }}
        />
      )}
    </div>
  );
}

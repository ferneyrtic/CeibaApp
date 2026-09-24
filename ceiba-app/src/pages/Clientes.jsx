import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, User, Phone, MapPin, Edit2 } from 'lucide-react';
import { getClientes } from '../lib/api/clientes';
import Modal from '../components/Modal';
import ModalEditarCliente from '../components/ModalEditarCliente';
import Pagination from '../components/Pagination';

export default function Clientes() {
  const [allClientes, setAllClientes]       = useState([]);
  const [loading, setLoading]               = useState(true);
  const [search, setSearch]                 = useState('');
  const [selected, setSelected]             = useState(null);
  const [editingCliente, setEditingCliente] = useState(null);

  // Paginación
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(24);

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getClientes('');
      setAllClientes(data || []);
    } catch (err) {
      console.error('Error cargando clientes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [fetchClientes]);

  // Búsqueda instantánea en memoria (0.1ms sin peticiones de red continuas)
  const filteredClientes = useMemo(() => {
    if (!search.trim()) return allClientes;
    const q = search.toLowerCase().trim();
    return allClientes.filter(c =>
      (c.nombre && c.nombre.toLowerCase().includes(q)) ||
      (c.doc_cliente && String(c.doc_cliente).toLowerCase().includes(q)) ||
      (c.ciudad && c.ciudad.toLowerCase().includes(q)) ||
      (c.celular && String(c.celular).includes(q)) ||
      (c.direccion && c.direccion.toLowerCase().includes(q))
    );
  }, [allClientes, search]);

  // Clientes paginados para mantener el DOM ultra liviano
  const paginatedClientes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredClientes.slice(start, start + pageSize);
  }, [filteredClientes, page, pageSize]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleSuccessEdit = (updated) => {
    setAllClientes(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
    if (selected && selected.id === updated.id) {
      setSelected(prev => ({ ...prev, ...updated }));
    }
  };

  const ciudades = useMemo(() => {
    return [...new Set(allClientes.map(c => c.ciudad).filter(Boolean))];
  }, [allClientes]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Clientes</div>
          <div className="page-subtitle">
            {loading ? 'Cargando clientes...' : `${allClientes.length} compradores registrados · ${ciudades.length} ciudades`}
          </div>
        </div>
      </div>

      <div className="search-bar">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="search-input"
            style={{ paddingLeft: 36 }}
            placeholder="Buscar por nombre, cédula, teléfono o ciudad..."
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <button className="btn btn-ghost" onClick={fetchClientes} title="Refrescar base de clientes">
          <RefreshCw size={14} />
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40vh', gap: 10, color: 'var(--text-muted)' }}>
          <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
          Cargando clientes...
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {paginatedClientes.map(c => {
              const initials = (c.nombre || '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
              return (
                <div
                  key={c.id}
                  className="card"
                  style={{ cursor: 'pointer', transition: 'all 0.2s', padding: 20, position: 'relative' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  onClick={() => setSelected(c)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 12,
                      background: 'linear-gradient(135deg, #16a34a, #059669)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.nombre}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {c.doc_cliente ? `CC ${c.doc_cliente}` : <span style={{ color: '#d97706' }}>Sin cédula</span>}
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost"
                      style={{ padding: '6px', borderRadius: 8 }}
                      title="Editar cliente"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCliente(c);
                      }}
                    >
                      <Edit2 size={13} color="var(--text-muted)" />
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                    {c.celular && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        <Phone size={12} color="var(--text-muted)" />
                        {c.celular}
                      </div>
                    )}
                    {c.ciudad && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}>
                        <MapPin size={12} color="var(--text-muted)" />
                        {c.ciudad}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredClientes.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                <User size={40} />
                <p>No se encontraron clientes que coincidan con la búsqueda</p>
              </div>
            )}
          </div>

          {filteredClientes.length > 0 && (
            <div style={{ marginTop: 20, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
              <Pagination
                currentPage={page}
                totalItems={filteredClientes.length}
                pageSize={pageSize}
                pageSizeOptions={[12, 24, 48, 96]}
                onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1); }}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          )}
        </>
      )}

      {/* Modal Detalle Cliente */}
      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'linear-gradient(135deg, #16a34a, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, fontWeight: 700, color: 'white',
              }}>
                {(selected.nombre || '??').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{selected.nombre}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {selected.doc_cliente ? `CC ${selected.doc_cliente}` : 'Sin cédula registrada'}
                </div>
              </div>
            </div>
            <button className="btn btn-ghost" style={{ padding: '6px 10px' }} onClick={() => setSelected(null)}>✕</button>
          </div>

          <div className="detail-grid">
            {[
              ['Nombre completo', selected.nombre],
              ['Documento',       selected.doc_cliente],
              ['Celular',         selected.celular],
              ['Ciudad',          selected.ciudad],
              ['Dirección',       selected.direccion],
            ].map(([l, v]) => (
              <div className="detail-item" key={l} style={{ gridColumn: l === 'Dirección' ? '1/-1' : undefined }}>
                <div className="detail-label">{l}</div>
                <div className="detail-value">{v ?? '—'}</div>
              </div>
            ))}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
            <button
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setEditingCliente(selected)}
            >
              <Edit2 size={13} />
              Editar Cliente
            </button>
          </div>
        </Modal>
      )}

      {/* Modal Editar Cliente */}
      {editingCliente && (
        <ModalEditarCliente
          cliente={editingCliente}
          onClose={() => setEditingCliente(null)}
          onSuccess={handleSuccessEdit}
        />
      )}
    </div>
  );
}


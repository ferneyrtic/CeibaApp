import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Check, MapPin, User, AlertCircle } from 'lucide-react';
import { formatCOP } from '../utils/helpers';

export default function SelectorLoteBuscador({
  ventas = [],
  selectedVentaId = '',
  onSelect,
  placeholder = 'Buscar por lote (ej. LC1 - 7 - 19), cliente o cédula...',
  label = 'Contrato / Lote:',
  required = true,
  disabled = false,
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Venta seleccionada actualmente
  const selectedVenta = useMemo(() => {
    if (!selectedVentaId) return null;
    return ventas.find(v => v.id === selectedVentaId || v.venta_id === selectedVentaId) || null;
  }, [ventas, selectedVentaId]);

  // Cerrar dropdown al dar clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar ventas en memoria
  const filteredVentas = useMemo(() => {
    if (!searchTerm.trim()) {
      return ventas.slice(0, 15);
    }
    const q = searchTerm.toLowerCase().trim().replace(/\s+/g, ' ');
    return ventas
      .filter(v => {
        const lote = (v.id_lote || v.lotes?.id_lote || '').toLowerCase().replace(/\s+/g, ' ');
        const nom = (v.cliente_nombre || v.clientes?.nombre || '').toLowerCase();
        const doc = (v.clientes?.doc_cliente || v.doc_cliente || '').toString().toLowerCase();
        return lote.includes(q) || nom.includes(q) || doc.includes(q);
      })
      .slice(0, 20);
  }, [ventas, searchTerm]);

  const handleSelect = (v) => {
    onSelect(v);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setSearchTerm('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', marginBottom: 14 }}>
      {label && (
        <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 5, color: '#334155' }}>
          {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
        </label>
      )}

      {/* Si ya hay un lote seleccionado, mostrar tarjeta limpia con opción de cambiar */}
      {selectedVenta ? (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f0fdf4',
          border: '1.5px solid #86efac',
          borderRadius: 8,
          padding: '10px 14px',
          gap: 12
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
            <span style={{
              background: '#16a34a',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              padding: '3px 8px',
              borderRadius: 6,
              fontFamily: 'monospace',
              whiteSpace: 'nowrap'
            }}>
              {selectedVenta.id_lote || selectedVenta.lotes?.id_lote}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#166534', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {selectedVenta.cliente_nombre || selectedVenta.clientes?.nombre || 'Sin cliente asignado'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {selectedVenta.clientes?.doc_cliente && `C.C. ${selectedVenta.clientes.doc_cliente} · `}
                Saldo pendiente: <strong style={{ color: (selectedVenta.saldo || 0) > 0 ? '#d97706' : '#16a34a' }}>{formatCOP(selectedVenta.saldo)}</strong>
              </div>
            </div>
          </div>

          {!disabled && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleClear}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderColor: '#bbf7d0',
                background: '#fff',
                color: '#166534',
                fontWeight: 600,
                gap: 4
              }}
              title="Cambiar lote seleccionado"
            >
              <X size={13} /> Cambiar
            </button>
          )}
        </div>
      ) : (
        /* Barra de búsqueda interactiva */
        <div>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94a3b8'
              }}
            />
            <input
              ref={inputRef}
              type="text"
              className="search-input"
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: 32,
                fontSize: 13,
                height: 40,
                borderRadius: 8,
                border: isOpen ? '1.5px solid #16a34a' : '1px solid var(--border)',
                background: disabled ? '#f8fafc' : '#fff'
              }}
              placeholder={placeholder}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setIsOpen(true);
              }}
              onFocus={() => setIsOpen(true)}
              disabled={disabled}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: 2
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Lista flotante de resultados */}
          {isOpen && !disabled && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              background: '#fff',
              border: '1px solid #cbd5e1',
              borderRadius: 8,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
              maxHeight: 280,
              overflowY: 'auto',
              zIndex: 1000
            }}>
              {filteredVentas.length === 0 ? (
                <div style={{ padding: '16px 20px', textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                  No se encontraron lotes ni clientes con "<strong>{searchTerm}</strong>"
                </div>
              ) : (
                filteredVentas.map((v) => {
                  const loteStr = v.id_lote || v.lotes?.id_lote || '—';
                  const cliStr = v.cliente_nombre || v.clientes?.nombre || 'Sin Titular';
                  const docStr = v.clientes?.doc_cliente || v.doc_cliente;
                  const saldoNum = v.saldo || 0;
                  const isSelected = (v.id === selectedVentaId || v.venta_id === selectedVentaId);

                  return (
                    <div
                      key={v.id || v.venta_id}
                      onClick={() => handleSelect(v)}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isSelected ? '#f0fdf4' : 'transparent',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: 12,
                          background: '#e2e8f0',
                          color: '#1e293b',
                          padding: '2px 7px',
                          borderRadius: 4,
                          whiteSpace: 'nowrap'
                        }}>
                          {loteStr}
                        </span>

                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {cliStr}
                          </div>
                          {docStr && (
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              Cédula: {docStr}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', whiteSpace: 'nowrap', marginLeft: 12 }}>
                        <div style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: saldoNum > 0 ? '#d97706' : '#16a34a'
                        }}>
                          {formatCOP(saldoNum)}
                        </div>
                        <div style={{ fontSize: 10, color: '#94a3b8' }}>
                          {saldoNum > 0 ? 'Saldo pendiente' : 'Saldado'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

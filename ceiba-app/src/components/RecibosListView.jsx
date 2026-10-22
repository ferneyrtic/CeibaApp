import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt, Search, RefreshCw, Download, Eye, Check, Copy,
  FileText, Calendar, DollarSign, Filter, CheckCircle2,
  AlertCircle, ArrowRight, ShieldCheck, Tag, X
} from 'lucide-react';
import { formatCOP, formatDate } from '../utils/helpers';
import { obtenerTodosLosRecibos, obtenerSiguienteNumeroRecibo } from '../lib/api/recibosApi';
import Pagination from './Pagination';

export default function RecibosListView({ onVerRecibo, onVerExtracto }) {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroCiclo, setFiltroCiclo] = useState('ciclo_actual'); // 'ciclo_actual' (#3399+) | 'todos'
  const [filtroMedio, setFiltroMedio] = useState('TODOS'); // 'TODOS' | 'TRANSFERENCIA' | 'EFECTIVO'
  const [proximoNumero, setProximoNumero] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const cargarRecibos = useCallback(async (force = false) => {
    setLoading(true);
    try {
      const [lista, nextNum] = await Promise.allSettled([
        obtenerTodosLosRecibos(force),
        obtenerSiguienteNumeroRecibo()
      ]);

      if (lista.status === 'fulfilled') {
        setRecibos(lista.value || []);
      }
      if (nextNum.status === 'fulfilled') {
        setProximoNumero(nextNum.value);
      }
    } catch (err) {
      console.error('Error cargando lista de recibos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarRecibos();
  }, [cargarRecibos]);

  // Filtrado de recibos
  const recibosFiltrados = useMemo(() => {
    return (recibos || []).filter(r => {
      const num = Number(r.numero_recibo || r.recibo_numero || 0);

      // Filtro de ciclo: por defecto mostrar ciclo actual (3399 en adelante)
      if (filtroCiclo === 'ciclo_actual' && num < 3399) {
        return false;
      }

      // Filtro de medio de pago
      if (filtroMedio !== 'TODOS') {
        const medio = (r.medio_pago || '').toUpperCase();
        if (filtroMedio === 'TRANSFERENCIA' && !medio.includes('TRANSF')) return false;
        if (filtroMedio === 'EFECTIVO' && !medio.includes('EFECT')) return false;
      }

      // Búsqueda por texto (número de recibo, lote, cliente, cédula, referencia, concepto)
      if (search.trim()) {
        const s = search.trim().toLowerCase().replace(/^#/, '');
        const matchNum = String(num).includes(s);
        const matchLote = (r.lote_id_str || '').toLowerCase().includes(s);
        const matchCliente = (r.cliente_nombre || '').toLowerCase().includes(s);
        const matchDoc = String(r.cliente_doc || r.cliente_cedula || '').toLowerCase().includes(s);
        const matchRef = (r.referencia || r.referencia_bancaria || '').toLowerCase().includes(s);
        const matchConcepto = (r.concepto || '').toLowerCase().includes(s);
        const matchAsesor = (r.asesor || r.registrado_por || '').toLowerCase().includes(s);

        if (!matchNum && !matchLote && !matchCliente && !matchDoc && !matchRef && !matchConcepto && !matchAsesor) {
          return false;
        }
      }

      return true;
    });
  }, [recibos, filtroCiclo, filtroMedio, search]);

  // Paginación de resultados
  const paginatedRecibos = useMemo(() => {
    const start = (page - 1) * pageSize;
    return recibosFiltrados.slice(start, start + pageSize);
  }, [recibosFiltrados, page, pageSize]);

  // Métricas calculadas para la cabecera
  const statsRecibos = useMemo(() => {
    const totalCount = recibosFiltrados.length;
    const totalRecaudado = recibosFiltrados.reduce((acc, r) => acc + (Number(r.valor || r.valor_pagado) || 0), 0);
    const numeros = recibosFiltrados.map(r => Number(r.numero_recibo || r.recibo_numero || 0)).filter(n => n > 0);
    const minNum = numeros.length > 0 ? Math.min(...numeros) : null;
    const maxNum = numeros.length > 0 ? Math.max(...numeros) : null;

    return {
      totalCount,
      totalRecaudado,
      rangoTexto: minNum && maxNum ? `#${minNum} → #${maxNum}` : '—'
    };
  }, [recibosFiltrados]);

  // Exportar a Excel
  const handleExportarExcel = async () => {
    if (recibosFiltrados.length === 0) {
      alert('No hay recibos para exportar con los filtros actuales.');
      return;
    }

    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      const rows = recibosFiltrados.map((r, i) => ({
        '#': i + 1,
        'No. Recibo': r.numero_recibo || r.recibo_numero || '',
        'Fecha Pago': r.fecha_pago || '',
        'ID Lote': r.lote_id_str || '',
        'Cliente / Titular': r.cliente_nombre || '',
        'Cédula / NIT': r.cliente_doc || r.cliente_cedula || '',
        'Concepto': r.concepto || '',
        'No. Cuota': r.numero_cuota || '',
        'Valor Pagado': Number(r.valor || r.valor_pagado || 0),
        'Medio de Pago': r.medio_pago || 'TRANSFERENCIA',
        'Banco': r.banco || '',
        'Referencia': r.referencia || r.referencia_bancaria || '',
        'Asesor / Registrado Por': r.asesor || r.registrado_por || '',
        'Observaciones': r.observaciones || ''
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(wb, ws, 'Historial Recibos');
      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `Recibos_Caja_LaCeiba_${fecha}.xlsx`);
    } catch (err) {
      console.error('Error exportando recibos a Excel:', err);
      alert('Error al generar archivo Excel.');
    }
  };

  // Copiar resumen de recibo
  const handleCopiarResumen = (r) => {
    const texto = `🧾 RECIBO DE CAJA #${r.numero_recibo || r.recibo_numero}\n` +
      `📅 Fecha: ${r.fecha_pago || ''}\n` +
      `🏡 Lote: ${r.lote_id_str || ''}\n` +
      `👤 Cliente: ${r.cliente_nombre || ''} (CC ${r.cliente_doc || r.cliente_cedula || ''})\n` +
      `💰 Valor: ${formatCOP(Number(r.valor || r.valor_pagado || 0))}\n` +
      `📋 Concepto: ${r.concepto || ''}\n` +
      `🏦 Medio: ${r.medio_pago || 'Transferencia'} ${r.banco ? `· ${r.banco}` : ''} ${r.referencia ? `(Ref: ${r.referencia})` : ''}\n` +
      `✍️ Registrado por: ${r.asesor || r.registrado_por || 'Secretaría'}`;

    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(texto).then(() => {
        setCopiedId(r.numero_recibo);
        setTimeout(() => setCopiedId(null), 2500);
      });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── KPIs y Resumen de Consecutivos ── */}
      <div className="cartera-diagnostico-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 12
      }}>
        {/* KPI 1: Total Recibos */}
        <div style={{
          background: 'var(--bg-card2)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '12px 16px'
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Receipt size={14} color="#059669" /> Recibos Visibles
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', marginTop: 4 }}>
            {statsRecibos.totalCount}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {filtroCiclo === 'ciclo_actual' ? 'Recibos del ciclo actual (#3399+)' : 'Todos los registrados'}
          </div>
        </div>

        {/* KPI 2: Total Recaudado */}
        <div style={{
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 8,
          padding: '12px 16px'
        }}>
          <div style={{ fontSize: 11, color: '#16a34a', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <DollarSign size={14} color="#16a34a" /> Total Recaudado
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#15803d', marginTop: 4 }}>
            {formatCOP(statsRecibos.totalRecaudado)}
          </div>
          <div style={{ fontSize: 11, color: '#16a34a', marginTop: 2 }}>
            Suma de valores en este listado
          </div>
        </div>

        {/* KPI 3: Rango Consecutivo */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: 8,
          padding: '12px 16px'
        }}>
          <div style={{ fontSize: 11, color: '#2563eb', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} color="#2563eb" /> Rango Consecutivo
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#1d4ed8', marginTop: 4, fontFamily: 'monospace' }}>
            {statsRecibos.rangoTexto}
          </div>
          <div style={{ fontSize: 11, color: '#2563eb', marginTop: 2 }}>
            Rango de recibos listados
          </div>
        </div>

        {/* KPI 4: Siguiente Consecutivo */}
        <div style={{
          background: '#fefce8',
          border: '1px solid #fef08a',
          borderRadius: 8,
          padding: '12px 16px'
        }}>
          <div style={{ fontSize: 11, color: '#ca8a04', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} color="#ca8a04" /> Próximo Recibo
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#a16207', marginTop: 4, fontFamily: 'monospace' }}>
            {proximoNumero ? `#${proximoNumero}` : 'Calculando...'}
          </div>
          <div style={{ fontSize: 11, color: '#854d0e', marginTop: 2 }}>
            Siguiente consecutivo asignable
          </div>
        </div>
      </div>

      {/* ── Barra de Búsqueda y Píldoras de Filtro ── */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--bg-card2)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '14px 16px'
      }}>
        <div style={{
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          {/* Buscador de texto con icono */}
          <div style={{ position: 'relative', flex: 1, minWidth: 260 }}>
            <Search size={15} style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)'
            }} />
            <input
              type="text"
              className="search-input"
              style={{
                width: '100%',
                paddingLeft: 36,
                paddingRight: search ? 32 : 12,
                fontSize: 13
              }}
              placeholder="Buscar por # recibo (ej: 3405), lote (LC2-42-5), cliente, cédula..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
            {search && (
              <button
                onClick={() => { setSearch(''); setPage(1); }}
                style={{
                  position: 'absolute',
                  right: 10,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center'
                }}
                title="Limpiar búsqueda"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12, gap: 6, fontWeight: 700 }}
              onClick={() => cargarRecibos(true)}
              disabled={loading}
              title="Recargar base de datos de recibos"
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              Recargar
            </button>

            <button
              className="btn btn-ghost"
              style={{
                fontSize: 12,
                gap: 6,
                color: '#15803d',
                borderColor: '#bbf7d0',
                background: '#f0fdf4',
                fontWeight: 700
              }}
              onClick={handleExportarExcel}
              title="Exportar listado visible a Excel"
            >
              <Download size={14} /> Excel
            </button>
          </div>
        </div>

        {/* Píldoras de Filtro Rápido */}
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: 12
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)', marginRight: 4 }}>
            Filtros:
          </span>

          {/* Píldora Ciclo Actual (#3399+) */}
          <button
            onClick={() => { setFiltroCiclo('ciclo_actual'); setPage(1); }}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: filtroCiclo === 'ciclo_actual' ? '1.5px solid #059669' : '1px solid var(--border)',
              background: filtroCiclo === 'ciclo_actual' ? '#ecfdf5' : 'var(--bg-card)',
              color: filtroCiclo === 'ciclo_actual' ? '#065f46' : 'var(--text-secondary)'
            }}
          >
            ✓ Ciclo Actual (#3399 al #{proximoNumero ? proximoNumero - 1 : '3411'})
          </button>

          {/* Píldora Todos los Recibos */}
          <button
            onClick={() => { setFiltroCiclo('todos'); setPage(1); }}
            style={{
              padding: '4px 12px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              border: filtroCiclo === 'todos' ? '1.5px solid #2563eb' : '1px solid var(--border)',
              background: filtroCiclo === 'todos' ? '#eff6ff' : 'var(--bg-card)',
              color: filtroCiclo === 'todos' ? '#1e40af' : 'var(--text-secondary)'
            }}
          >
            Todos los Registrados ({recibos.length})
          </button>

          <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>

          {/* Filtro Medio: Todos */}
          <button
            onClick={() => { setFiltroMedio('TODOS'); setPage(1); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: filtroMedio === 'TODOS' ? '1px solid #64748b' : '1px solid transparent',
              background: filtroMedio === 'TODOS' ? '#f1f5f9' : 'transparent',
              color: filtroMedio === 'TODOS' ? '#0f172a' : 'var(--text-muted)'
            }}
          >
            Todos los medios
          </button>

          {/* Filtro Medio: Transferencia */}
          <button
            onClick={() => { setFiltroMedio('TRANSFERENCIA'); setPage(1); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: filtroMedio === 'TRANSFERENCIA' ? '1px solid #0284c7' : '1px solid transparent',
              background: filtroMedio === 'TRANSFERENCIA' ? '#e0f2fe' : 'transparent',
              color: filtroMedio === 'TRANSFERENCIA' ? '#0369a1' : 'var(--text-muted)'
            }}
          >
            Solo Transferencias
          </button>

          {/* Filtro Medio: Efectivo */}
          <button
            onClick={() => { setFiltroMedio('EFECTIVO'); setPage(1); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: filtroMedio === 'EFECTIVO' ? '1px solid #d97706' : '1px solid transparent',
              background: filtroMedio === 'EFECTIVO' ? '#fef3c7' : 'transparent',
              color: filtroMedio === 'EFECTIVO' ? '#b45309' : 'var(--text-muted)'
            }}
          >
            Solo Efectivo
          </button>
        </div>
      </div>

      {/* ── Tabla de Recibos ── */}
      <div className="table-container" style={{ margin: 0 }}>
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="table-header-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={16} /> Listado Oficial de Recibos de Caja — {recibosFiltrados.length} encontrados
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Mostrando página {page} de {Math.ceil(recibosFiltrados.length / pageSize) || 1}
          </span>
        </div>

        {loading ? (
          <div style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12
          }}>
            <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
            Cargando historial de recibos...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 110, textAlign: 'center' }}>No. Recibo</th>
                  <th style={{ width: 100 }}>Fecha Pago</th>
                  <th style={{ width: 140 }}>ID Lote</th>
                  <th>Cliente / Titular</th>
                  <th>Concepto / Cuota</th>
                  <th style={{ textAlign: 'right', width: 130 }}>Valor Pagado</th>
                  <th style={{ width: 170 }}>Medio de Pago</th>
                  <th style={{ width: 140 }}>Registrado Por</th>
                  <th style={{ width: 150, textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecibos.map((r) => {
                  const numRecibo = r.numero_recibo || r.recibo_numero;
                  const valNum = Number(r.valor || r.valor_pagado || 0);
                  const isCopied = copiedId === numRecibo;
                  const medioStr = (r.medio_pago || 'TRANSFERENCIA').toUpperCase();
                  const isTransfer = medioStr.includes('TRANSF');

                  return (
                    <tr
                      key={numRecibo}
                      style={{ cursor: 'pointer', transition: 'background 0.15s ease' }}
                      onClick={() => onVerRecibo && onVerRecibo(r)}
                      title={`Clic para ver recibo #${numRecibo}`}
                    >
                      {/* # Recibo */}
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12,
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          padding: '3px 8px',
                          borderRadius: 6,
                          background: '#ecfdf5',
                          color: '#065f46',
                          border: '1px solid #a7f3d0'
                        }}>
                          #{numRecibo}
                        </span>
                      </td>

                      {/* Fecha de Pago */}
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {formatDate(r.fecha_pago)}
                      </td>

                      {/* ID Lote */}
                      <td>
                        <span style={{
                          fontWeight: 800,
                          fontFamily: 'monospace',
                          fontSize: 12.5,
                          color: '#1e293b'
                        }}>
                          {r.lote_id_str || '—'}
                        </span>
                      </td>

                      {/* Cliente / Titular */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: '#0f172a' }}>
                          {r.cliente_nombre || '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {r.cliente_doc || r.cliente_cedula ? `CC ${r.cliente_doc || r.cliente_cedula}` : ''}
                        </div>
                      </td>

                      {/* Concepto / Cuota */}
                      <td>
                        <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                          {r.concepto || (r.numero_cuota ? `Pago Cuota #${r.numero_cuota}` : 'Abono a contrato')}
                        </div>
                        {r.numero_cuota && (
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            Cuota #{r.numero_cuota}
                          </div>
                        )}
                      </td>

                      {/* Valor Pagado */}
                      <td style={{ textAlign: 'right' }}>
                        <span style={{
                          fontWeight: 800,
                          fontSize: 13,
                          color: '#15803d',
                          fontFamily: 'monospace'
                        }}>
                          {formatCOP(valNum)}
                        </span>
                      </td>

                      {/* Medio de Pago */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{
                            display: 'inline-block',
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            width: 'fit-content',
                            background: isTransfer ? '#e0f2fe' : '#fef3c7',
                            color: isTransfer ? '#0369a1' : '#b45309'
                          }}>
                            {isTransfer ? 'TRANSFERENCIA' : 'EFECTIVO'}
                          </span>
                          {r.banco && (
                            <span style={{ fontSize: 10.5, color: '#64748b' }}>
                              {r.banco}
                            </span>
                          )}
                          {(r.referencia || r.referencia_bancaria) && (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                              Ref: {r.referencia || r.referencia_bancaria}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Asesor / Registrado Por */}
                      <td style={{ fontSize: 11.5, color: 'var(--text-secondary)' }}>
                        {r.asesor || r.registrado_por || 'Secretaría'}
                      </td>

                      {/* Acciones */}
                      <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', alignItems: 'center' }}>
                          {/* Ver Recibo */}
                          <button
                            className="btn btn-ghost"
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              gap: 4,
                              color: '#0284c7',
                              borderColor: '#bae6fd',
                              background: '#f0f9ff',
                              fontWeight: 700
                            }}
                            onClick={() => onVerRecibo && onVerRecibo(r)}
                            title="Ver e imprimir recibo oficial con sello autenticado"
                          >
                            <Eye size={12} /> Ver
                          </button>

                          {/* Descargar PDF */}
                          <button
                            className="btn btn-ghost"
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              gap: 4,
                              color: '#15803d',
                              borderColor: '#bbf7d0',
                              background: '#f0fdf4',
                              fontWeight: 700
                            }}
                            onClick={() => onVerRecibo && onVerRecibo({ ...r, autoDownload: true })}
                            title="Descargar PDF de este recibo"
                          >
                            <Download size={12} /> PDF
                          </button>

                          {/* Copiar Resumen */}
                          <button
                            className="btn btn-ghost"
                            style={{
                              fontSize: 11,
                              padding: '4px 8px',
                              color: isCopied ? '#16a34a' : 'var(--text-muted)'
                            }}
                            onClick={() => handleCopiarResumen(r)}
                            title="Copiar datos del recibo para WhatsApp o notas"
                          >
                            {isCopied ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {recibosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      <AlertCircle size={28} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#475569' }}>
                        No se encontraron recibos
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>
                        {search ? `Ningún recibo coincide con "${search}"` : 'No hay recibos registrados en el ciclo seleccionado.'}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Paginación ── */}
      {recibosFiltrados.length > pageSize && (
        <Pagination
          currentPage={page}
          totalItems={recibosFiltrados.length}
          pageSize={pageSize}
          pageSizeOptions={[25, 50, 100]}
          onPageSizeChange={(sz) => { setPageSize(sz); setPage(1); }}
          onPageChange={(p) => setPage(p)}
        />
      )}
    </div>
  );
}

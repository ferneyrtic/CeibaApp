import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Receipt, Search, RefreshCw, Download, Eye, Check, Copy,
  FileText, Calendar, DollarSign, Filter, CheckCircle2,
  AlertCircle, ArrowRight, ShieldCheck, Tag, X, Clock
} from 'lucide-react';
import { formatCOP, formatDate, formatTime } from '../utils/helpers';
import { obtenerTodosLosRecibos, obtenerSiguienteNumeroRecibo } from '../lib/api/recibosApi';
import Pagination from './Pagination';

const sanitizarRegistradoPor = (str) => {
  if (!str) return 'Secretaría';
  const s = String(str).trim();
  if (/diana|soporte/i.test(s)) {
    return 'Diana (Soporte)';
  }
  return 'Secretaría';
};

/**
 * Determina el tipo de recibo y los estilos visuales asociados según el código de colores:
 * - Recibos normales (cuotas / abonos de cartera): VERDE (#ecfdf5, #065f46, #a7f3d0)
 * - Arras (apartados temporales de lote): AMARILLO (#fef3c7, #92400e, #fde68a)
 * - Cuota Inicial (separación de contrato): MORADO (#f3e8ff, #6b21a8, #d8b4fe)
 * - Anulado: ROJO (#fef2f2, #991b1b, #fecaca)
 */
export const getTipoReciboInfo = (r) => {
  const estado = String(r?.estado || r?.estado_recibo || '').toUpperCase();
  const concepto = String(r?.concepto || '').toUpperCase();
  const motivo = String(r?.motivo || '').toUpperCase();
  const lote = String(r?.lote_id_str || '').toUpperCase();

  if (estado === 'ANULADO') {
    return {
      tipo: 'ANULADO',
      label: '(ANULADO)',
      badgeText: 'ANULADO',
      bgBadge: '#fef2f2',
      colorBadge: '#991b1b',
      borderBadge: '#fecaca',
      colorValor: '#991b1b',
      valorDisplay: 'ANULADO'
    };
  }

  if (estado === 'ARRAS' || concepto.includes('ARRAS') || motivo.includes('ARRAS') || lote.includes('ARRAS')) {
    return {
      tipo: 'ARRAS',
      label: '(ARRAS)',
      badgeText: 'ARRAS',
      bgBadge: '#fef3c7',     // Amarillo fondo
      colorBadge: '#92400e',  // Amarillo texto
      borderBadge: '#fde68a', // Amarillo borde
      colorValor: '#b45309',  // Amarillo/ámbar valor
      valorDisplay: (Number(r?.valor || r?.valor_pagado || 0) === 0) ? 'ARRAS' : null
    };
  }

  if (
    estado === 'CUOTA_INICIAL' ||
    concepto.includes('CUOTA INICIAL') ||
    concepto.includes('INICIAL') ||
    motivo.includes('CUOTA INICIAL') ||
    motivo.includes('INICIAL')
  ) {
    return {
      tipo: 'CUOTA_INICIAL',
      label: '(INICIAL)',
      badgeText: 'CUOTA INICIAL',
      bgBadge: '#f3e8ff',     // Morado fondo
      colorBadge: '#6b21a8',  // Morado texto
      borderBadge: '#d8b4fe', // Morado borde
      colorValor: '#7e22ce',  // Morado valor
      valorDisplay: null
    };
  }

  // Recibo normal (Cuota de cartera / abono recurrente) - VERDE
  return {
    tipo: 'NORMAL',
    label: '',
    badgeText: 'NORMAL',
    bgBadge: '#ecfdf5',     // Verde fondo
    colorBadge: '#065f46',  // Verde texto
    borderBadge: '#a7f3d0', // Verde borde
    colorValor: '#15803d',  // Verde valor
    valorDisplay: null
  };
};

export default function RecibosListView({ onVerRecibo, onVerExtracto }) {
  const [recibos, setRecibos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroCiclo, setFiltroCiclo] = useState('ciclo_actual'); // 'ciclo_actual' (#3398+) | 'todos'
  const [filtroMedio, setFiltroMedio] = useState('TODOS'); // 'TODOS' | 'TRANSFERENCIA' | 'EFECTIVO'
  const [filtroTipo, setFiltroTipo] = useState('TODOS'); // 'TODOS' | 'NORMAL' | 'ARRAS' | 'CUOTA_INICIAL'
  const [filtroRegistrador, setFiltroRegistrador] = useState('TODOS'); // 'TODOS' | 'SECRETARIA' | 'SOPORTE'
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

  // Conteo de recibos por categoría según ciclo seleccionado
  const conteoTipos = useMemo(() => {
    let normales = 0;
    let arras = 0;
    let iniciales = 0;
    let anulados = 0;

    (recibos || []).forEach(r => {
      const num = Number(r.numero_recibo || r.recibo_numero || 0);
      if (filtroCiclo === 'ciclo_actual' && num < 3398) return;

      const t = getTipoReciboInfo(r).tipo;
      if (t === 'NORMAL') normales++;
      else if (t === 'ARRAS') arras++;
      else if (t === 'CUOTA_INICIAL') iniciales++;
      else if (t === 'ANULADO') anulados++;
    });

    return { normales, arras, iniciales, anulados };
  }, [recibos, filtroCiclo]);

  // Conteo comparativo entre Secretaría y Diana (Soporte)
  const conteoRegistrador = useMemo(() => {
    let secretaria = 0;
    let soporte = 0;

    (recibos || []).forEach(r => {
      const num = Number(r.numero_recibo || r.recibo_numero || 0);
      if (filtroCiclo === 'ciclo_actual' && num < 3398) return;

      const reg = sanitizarRegistradoPor(r.registrado_por);
      if (reg === 'Diana (Soporte)') soporte++;
      else secretaria++;
    });

    return { secretaria, soporte };
  }, [recibos, filtroCiclo]);

  // Filtrado de recibos
  const recibosFiltrados = useMemo(() => {
    return (recibos || []).filter(r => {
      const num = Number(r.numero_recibo || r.recibo_numero || 0);

      // Filtro de ciclo: por defecto mostrar ciclo actual (3398 en adelante)
      if (filtroCiclo === 'ciclo_actual' && num < 3398) {
        return false;
      }

      // Filtro de tipo de recibo (Normal, Arras, Cuota Inicial)
      if (filtroTipo !== 'TODOS') {
        const info = getTipoReciboInfo(r);
        if (info.tipo !== filtroTipo) return false;
      }

      // Filtro de medio de pago
      if (filtroMedio !== 'TODOS') {
        const medio = (r.medio_pago || '').toUpperCase();
        if (filtroMedio === 'TRANSFERENCIA' && !medio.includes('TRANSF')) return false;
        if (filtroMedio === 'EFECTIVO' && !medio.includes('EFECT')) return false;
      }

      // Filtro por responsable de registro: Secretaría vs Diana (Soporte)
      if (filtroRegistrador !== 'TODOS') {
        const reg = sanitizarRegistradoPor(r.registrado_por);
        if (filtroRegistrador === 'SECRETARIA' && reg !== 'Secretaría') return false;
        if (filtroRegistrador === 'SOPORTE' && reg !== 'Diana (Soporte)') return false;
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
        const matchRegistrador = sanitizarRegistradoPor(r.registrado_por).toLowerCase().includes(s);

        if (!matchNum && !matchLote && !matchCliente && !matchDoc && !matchRef && !matchConcepto && !matchRegistrador) {
          return false;
        }
      }

      return true;
    });
  }, [recibos, filtroCiclo, filtroTipo, filtroMedio, filtroRegistrador, search]);

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
        'Registrado Por': sanitizarRegistradoPor(r.registrado_por),
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
      `✍️ Registrado por: ${sanitizarRegistradoPor(r.registrado_por)}`;

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
            {filtroCiclo === 'ciclo_actual' ? 'Recibos del ciclo actual (#3398+)' : 'Todos los registrados'}
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

          {/* Píldora Ciclo Actual (#3398+) */}
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
            ✓ Ciclo Actual (#3398 al #{proximoNumero ? proximoNumero - 1 : '3423'})
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

          <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>

          {/* Filtro Comparativo: Secretaría vs Diana (Soporte) */}
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginLeft: 4 }}>
            Registrado por:
          </span>

          <button
            onClick={() => { setFiltroRegistrador('TODOS'); setPage(1); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: filtroRegistrador === 'TODOS' ? '1px solid #64748b' : '1px solid transparent',
              background: filtroRegistrador === 'TODOS' ? '#f1f5f9' : 'transparent',
              color: filtroRegistrador === 'TODOS' ? '#0f172a' : 'var(--text-muted)'
            }}
          >
            Todos
          </button>

          <button
            onClick={() => { setFiltroRegistrador('SECRETARIA'); setPage(1); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: filtroRegistrador === 'SECRETARIA' ? '1px solid #3b82f6' : '1px solid transparent',
              background: filtroRegistrador === 'SECRETARIA' ? '#eff6ff' : 'transparent',
              color: filtroRegistrador === 'SECRETARIA' ? '#1d4ed8' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
            title="Recibos emitidos y registrados por Secretaría"
          >
            ✍️ Secretaría ({conteoRegistrador.secretaria})
          </button>

          <button
            onClick={() => { setFiltroRegistrador('SOPORTE'); setPage(1); }}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              border: filtroRegistrador === 'SOPORTE' ? '1px solid #ea580c' : '1px solid transparent',
              background: filtroRegistrador === 'SOPORTE' ? '#fff7ed' : 'transparent',
              color: filtroRegistrador === 'SOPORTE' ? '#c2410c' : 'var(--text-muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
            title="Recibos registrados por Diana (Soporte Mora)"
          >
            🛡️ Diana (Soporte) ({conteoRegistrador.soporte})
          </button>
        </div>

        {/* Píldoras de Filtro por Categoría con Código de Colores */}
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: 12,
          paddingTop: 8,
          borderTop: '1px dashed var(--border)'
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text-muted)', marginRight: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Tag size={13} /> Tipo de Recibo:
          </span>

          {/* Todos */}
          <button
            type="button"
            onClick={() => { setFiltroTipo('TODOS'); setPage(1); }}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              border: filtroTipo === 'TODOS' ? '1.5px solid #64748b' : '1px solid var(--border)',
              background: filtroTipo === 'TODOS' ? '#f1f5f9' : 'var(--bg-card)',
              color: filtroTipo === 'TODOS' ? '#0f172a' : 'var(--text-secondary)'
            }}
          >
            Todos ({conteoTipos.normales + conteoTipos.arras + conteoTipos.iniciales + conteoTipos.anulados})
          </button>

          {/* Normales (Verde) */}
          <button
            type="button"
            onClick={() => { setFiltroTipo('NORMAL'); setPage(1); }}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: filtroTipo === 'NORMAL' ? '1.5px solid #059669' : '1px solid #a7f3d0',
              background: filtroTipo === 'NORMAL' ? '#d1fae5' : '#ecfdf5',
              color: '#065f46'
            }}
            title="Recibos normales de cuotas recurrentes y abonos de cartera (Verde)"
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#059669', display: 'inline-block' }} />
            Normales ({conteoTipos.normales})
          </button>

          {/* Arras (Amarillo) */}
          <button
            type="button"
            onClick={() => { setFiltroTipo('ARRAS'); setPage(1); }}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: filtroTipo === 'ARRAS' ? '1.5px solid #d97706' : '1px solid #fde68a',
              background: filtroTipo === 'ARRAS' ? '#fde68a' : '#fef3c7',
              color: '#92400e'
            }}
            title="Recibos de arras expedidos para apartar lote temporalmente (Amarillo)"
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
            Arras ({conteoTipos.arras})
          </button>

          {/* Cuota Inicial (Morado) */}
          <button
            type="button"
            onClick={() => { setFiltroTipo('CUOTA_INICIAL'); setPage(1); }}
            style={{
              padding: '3px 10px',
              borderRadius: 20,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              border: filtroTipo === 'CUOTA_INICIAL' ? '1.5px solid #9333ea' : '1px solid #d8b4fe',
              background: filtroTipo === 'CUOTA_INICIAL' ? '#e9d5ff' : '#f3e8ff',
              color: '#6b21a8'
            }}
            title="Recibos de cuota inicial expedidos en talonario físico (Morado)"
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#9333ea', display: 'inline-block' }} />
            Cuota Inicial ({conteoTipos.iniciales})
          </button>
        </div>
      </div>

      {/* ── Barra de Leyenda de Colores ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 10,
        padding: '8px 14px',
        background: 'var(--bg-card)',
        borderRadius: 8,
        border: '1px solid var(--border)',
        fontSize: 11.5
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--text-muted)' }}>
          <Tag size={13} />
          <span>Convención de Colores:</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#10b981', display: 'inline-block' }} />
            <strong style={{ color: '#065f46' }}>Verde:</strong>
            <span style={{ color: 'var(--text-secondary)' }}>Recibos normales (Cuotas / Cartera)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#f59e0b', display: 'inline-block' }} />
            <strong style={{ color: '#92400e' }}>Amarillo:</strong>
            <span style={{ color: 'var(--text-secondary)' }}>Arras (Apartados temporales)</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: '#9333ea', display: 'inline-block' }} />
            <strong style={{ color: '#6b21a8' }}>Morado:</strong>
            <span style={{ color: 'var(--text-secondary)' }}>Cuota Inicial (Separación contrato)</span>
          </div>
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
                  const tipoInfo = getTipoReciboInfo(r);

                  return (
                    <tr
                      key={numRecibo}
                      style={{
                        cursor: 'pointer',
                        transition: 'background 0.15s ease',
                        borderLeft: tipoInfo.tipo === 'CUOTA_INICIAL'
                          ? '3.5px solid #9333ea'
                          : (tipoInfo.tipo === 'ARRAS'
                            ? '3.5px solid #d97706'
                            : (tipoInfo.tipo === 'ANULADO' ? '3.5px solid #ef4444' : '3.5px solid #10b981'))
                      }}
                      onClick={() => {
                        if (typeof window !== 'undefined' && window.getSelection()?.toString().trim().length > 0) return;
                        if (onVerRecibo) onVerRecibo(r);
                      }}
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
                          background: tipoInfo.bgBadge,
                          color: tipoInfo.colorBadge,
                          border: `1px solid ${tipoInfo.borderBadge}`
                        }}>
                          #{numRecibo} {tipoInfo.label}
                        </span>
                      </td>

                      {/* Fecha de Pago y Hora */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#0f172a' }}>
                          {formatDate(r.fecha_pago)}
                        </div>
                        {formatTime(r.hora || r.hora_pago || r.created_at || r.timestamp) && (
                          <div style={{
                            fontSize: 10.5,
                            color: 'var(--text-muted)',
                            marginTop: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3.5,
                            fontWeight: 500
                          }}>
                            <Clock size={11} style={{ opacity: 0.7 }} />
                            <span>{formatTime(r.hora || r.hora_pago || r.created_at || r.timestamp)}</span>
                          </div>
                        )}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                            {r.concepto || (r.numero_cuota ? `Pago Cuota #${r.numero_cuota}` : 'Abono a contrato')}
                          </span>
                          {tipoInfo.tipo === 'CUOTA_INICIAL' && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: '#f3e8ff',
                              color: '#6b21a8',
                              border: '1px solid #d8b4fe'
                            }}>
                              CUOTA INICIAL
                            </span>
                          )}
                          {tipoInfo.tipo === 'ARRAS' && (
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: '#fef3c7',
                              color: '#92400e',
                              border: '1px solid #fde68a'
                            }}>
                              ARRAS
                            </span>
                          )}
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
                          color: tipoInfo.colorValor,
                          fontFamily: 'monospace'
                        }}>
                          {tipoInfo.tipo === 'ARRAS' && valNum === 0
                            ? 'ARRAS'
                            : (tipoInfo.tipo === 'ANULADO' ? 'ANULADO' : formatCOP(valNum))}
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

                      {/* Registrado Por: Secretaría vs Diana (Soporte) */}
                      <td style={{ fontSize: 11.5 }}>
                        {sanitizarRegistradoPor(r.registrado_por) === 'Diana (Soporte)' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2.5px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#fff7ed',
                              color: '#c2410c',
                              border: '1px solid #fed7aa'
                            }}
                            title="Recibo registrado por Soporte (Diana)"
                          >
                            🛡️ Diana (Soporte)
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2.5px 8px',
                              borderRadius: 6,
                              fontSize: 11,
                              fontWeight: 700,
                              background: '#f8fafc',
                              color: '#334155',
                              border: '1px solid #e2e8f0'
                            }}
                            title="Recibo emitido y registrado oficialmente por Secretaría"
                          >
                            ✍️ Secretaría
                          </span>
                        )}
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
                            onClick={() => {
                        if (typeof window !== 'undefined' && window.getSelection()?.toString().trim().length > 0) return;
                        if (onVerRecibo) onVerRecibo(r);
                      }}
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

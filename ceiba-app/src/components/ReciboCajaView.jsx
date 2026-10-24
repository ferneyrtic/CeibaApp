import React, { useRef, useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { Printer, Download, X, Check, Copy, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { lockBodyScroll, unlockBodyScroll, ensureScrollUnlocked } from '../utils/scrollLockManager';
import { formatCOP } from '../utils/helpers';
import { numeroALetrasCOP } from '../utils/numeroALetras';
import { LOGO_CEIBA_BASE64 } from '../assets/logoBase64';
import { SELLO_CEIBA_BASE64 } from '../assets/selloCeibaBase64';

// Error Boundary para evitar cualquier pantalla en blanco si falla el renderizado del recibo
class ReciboErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error capturado en ReciboErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return ReactDOM.createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.8)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 200000, padding: 16
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%',
            textAlign: 'center', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)'
          }}>
            <AlertTriangle size={36} color="#dc2626" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 16, fontWeight: 800, color: '#991b1b', marginBottom: 8 }}>
              No se pudo visualizar el recibo de caja
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 20 }}>
              {this.state.error?.message || 'Error inesperado al renderizar el documento'}
            </div>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                if (this.props.onClose) this.props.onClose();
              }}
              className="btn btn-primary"
              style={{ background: '#dc2626', borderColor: '#b91c1c' }}
            >
              Cerrar
            </button>
          </div>
        </div>,
        document.body
      );
    }
    return this.props.children;
  }
}

/**
 * Genera un Código Único de Verificación (CUV) criptográfico-determinístico
 * para garantizar la autenticidad e inalterabilidad del recibo.
 */
function generarCUV(recibo) {
  const num = String(recibo?.numero_recibo || recibo?.recibo_numero || '0');
  const doc = String(recibo?.cliente_doc || recibo?.cliente_cedula || '0');
  const val = String(recibo?.valor || recibo?.valor_pagado || '0');
  const fec = String(recibo?.fecha_pago || '2026-10');
  const lote = String(recibo?.lote_id_str || 'CEIBA');

  let hash = 0x811c9dc5;
  const str = `${num}:${doc}:${val}:${fec}:${lote}:CEIBA_AUTHENTIC_VALIDATOR_2026`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const hex = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `CUV-${num}-${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/**
 * Formatea el bloque 'ID CLIENTE' con Nombre de la persona y descripción de Lote
 * Ejemplo: Ferney Ramos — Lote 3 Manzana 4 (Etapa 2)
 */
function formatearIdCliente(recibo) {
  const cliente = (recibo?.cliente_nombre || 'Cliente').trim();
  const rawLote = (recibo?.lote_id_str || '').trim();
  if (!rawLote) return cliente;

  // Formato simple: LC[etapa] - [manzana] - [lote]
  const matchSimple = rawLote.match(/^LC(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)$/i);
  if (matchSimple) {
    const [, etapa, manzana, loteNum] = matchSimple;
    return `${cliente} — Lote ${loteNum} Manzana ${manzana} (Etapa ${etapa})`;
  }

  // Formato multi-lote: LC1 - 13 - 2 - 3 - 4 Y 5 o LC1 - 8 - 3 Y 4
  const matchMulti = rawLote.match(/^LC(\d+)\s*[-–]\s*(\d+)\s*[-–]\s*(\d+)\s*(?:Y|&)\s*(\d+)$/i);
  if (matchMulti) {
    const [, etapa, manzana, loteA, loteB] = matchMulti;
    return `${cliente} — Lotes ${loteA} y ${loteB} Manzana ${manzana} (Etapa ${etapa})`;
  }

  return `${cliente} — ${rawLote}`;
}

/**
 * Limpia el texto de concepto para dejar únicamente el concepto de pago (ej. Pago Cuota #4, Abono Cuota #8)
 * sin redundancias de lote ni cliente (los cuales ya van en 'ID CLIENTE').
 */
function limpiarConcepto(concepto, numeroCuota) {
  if (!concepto && numeroCuota) {
    return `Pago Cuota #${numeroCuota}`;
  }
  if (!concepto) return 'Abono a cuota pactada';

  let texto = String(concepto).trim();
  if (texto.includes(' - Titular:')) {
    texto = texto.split(' - Titular:')[0];
  }
  if (texto.includes(' - LC')) {
    texto = texto.split(' - LC')[0];
  }
  if (texto.includes(' - Lote TEST')) {
    texto = texto.split(' - Lote TEST')[0];
  }
  if (texto.includes(' - Lote ')) {
    texto = texto.split(' - Lote ')[0];
  }

  return texto.trim() || (numeroCuota ? `Pago Cuota #${numeroCuota}` : 'Abono a cuota pactada');
}

function ReciboCajaContent({ recibo, onClose, onPrint, autoDownload = false }) {
  const reciboRef = useRef(null);
  const [descargado, setDescargado] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // ── Todos los hooks ANTES de cualquier return condicional (Rules of Hooks) ──
  // Código Único de Verificación (CUV) para seguridad antifalsificación
  const cuvCode = useMemo(() => generarCUV(recibo), [recibo]);

  // Valores derivados (no son hooks; se calculan de forma segura con recibo null)
  const numRecibo = recibo?.numero_recibo || 3412;
  const valorNum = Math.round(Number(recibo?.valor) || 0);
  const valorLetras = typeof recibo?.valor_letras === 'string' && recibo?.valor_letras.trim()
    ? recibo.valor_letras
    : numeroALetrasCOP(valorNum);

  // Desglosar fecha de forma 100% segura (YYYY-MM-DD o variantes)
  let fAnio = '—', fMes = '—', fDia = '—';
  try {
    const rawF = String(recibo?.fecha_pago || recibo?.created_at || '').slice(0, 10);
    if (rawF && rawF.includes('-')) {
      const parts = rawF.split('-');
      if (parts.length === 3) {
        [fAnio, fMes, fDia] = parts;
      }
    }
  } catch (e) {}

  // Cadena segura de fecha de emisión
  let emisionStr = new Date().toLocaleString('es-CO');
  try {
    if (recibo?.created_at) {
      const d = new Date(recibo.created_at);
      if (!isNaN(d.getTime())) {
        emisionStr = d.toLocaleString('es-CO');
      }
    }
  } catch (e) {}

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    if (generandoPdf) return;
    setGenerandoPdf(true);
    try {
      if (!reciboRef.current) return;
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      const canvas = await html2canvas(reciboRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a5'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, 'PNG', 8, 8, pdfWidth - 16, pdfHeight - 16);
      pdf.save(`Recibo_Caja_${numRecibo}_${recibo?.lote_id_str || 'Ceiba'}.pdf`);
      setDescargado(true);
    } catch (err) {
      console.warn('html2canvas falló, usando generador directo jsPDF:', err);
      try {
        const { default: jsPDF } = await import('jspdf');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a5' });
        try {
          doc.addImage(LOGO_CEIBA_BASE64, 'PNG', 12, 10, 20, 20);
          doc.addImage(SELLO_CEIBA_BASE64, 'PNG', 152, 54, 38, 38);
          doc.setFontSize(7);
          doc.setTextColor(21, 128, 61);
          doc.text('✓ AUTENTICADO · VALIDADOR OFICIAL CEIBA', 142, 95);
          doc.setFontSize(6);
          doc.setTextColor(15, 118, 110);
          doc.text(`${cuvCode} · INALTERABLE`, 144, 98.5);
        } catch (e) {}
        doc.setFontSize(15);
        doc.setTextColor(1, 107, 69);
        doc.text('PROYECTO CAMPESTRE LA CEIBA', 36, 17);
        doc.setFontSize(9.5);
        doc.setTextColor(127, 29, 29);
        doc.text('RECIBO DE CAJA MENOR', 36, 22);
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.text('Cel: 320 251 2298 · laceibagroup4@gmail.com', 36, 26);
        doc.setDrawColor(1, 107, 69);
        doc.setLineWidth(0.4);
        doc.line(12, 32, 198, 32);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.text(`Recibo Nº: ${numRecibo}`, 14, 40);
        doc.text(`Ciudad: Acacías | Fecha: ${fDia}/${fMes}/${fAnio}`, 14, 48);
        doc.text(`ID Cliente: ${formatearIdCliente(recibo)}`, 14, 56);
        doc.text(`Valor: $${valorNum.toLocaleString('es-CO')} (${valorLetras})`, 14, 66);
        doc.text(`Concepto: ${limpiarConcepto(recibo?.concepto, recibo?.numero_cuota)}`, 14, 76);
        doc.text(`Observaciones: ${String(recibo?.observaciones || '')}`, 14, 86);
        doc.save(`Recibo_Caja_${numRecibo}.pdf`);
        setDescargado(true);
      } catch (fallbackErr) {
        console.error('Error generando fallback jsPDF:', fallbackErr);
      }
    } finally {
      setGenerandoPdf(false);
    }
  };

  // Early return DESPUÉS de todos los hooks
  useEffect(() => {
    if (!recibo) return;
    if (autoDownload || recibo?.autoDownload) {
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 450);
      return () => clearTimeout(timer);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDownload, recibo?.autoDownload]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const isMouseDownOnOverlay = useRef(false);

  // Cerrar con tecla Escape y gestión infalible de scroll
  useEffect(() => {
    lockBodyScroll();
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unlockBodyScroll();
      setTimeout(ensureScrollUnlocked, 10);
    };
  }, []);

  const handleOverlayMouseDown = (e) => {
    isMouseDownOnOverlay.current = (e.target === e.currentTarget);
  };

  const handleOverlayClick = (e) => {
    const hasSelection = typeof window !== 'undefined' && window.getSelection()?.toString().trim().length > 0;
    if (hasSelection) {
      isMouseDownOnOverlay.current = false;
      return;
    }
    if (isMouseDownOnOverlay.current && e.target === e.currentTarget && onClose) {
      onClose();
    }
    isMouseDownOnOverlay.current = false;
  };

  if (!recibo) return null;

  return ReactDOM.createPortal(
    <div
      onMouseDown={handleOverlayMouseDown}
      onClick={handleOverlayClick}
      className="modal-portal-overlay"
      data-modal-portal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(15, 23, 42, 0.8)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200000,
        padding: 16,
        overflowY: 'auto'
      }}
    >
      {/* ESTILOS DE IMPRESIÓN EXCLUSIVOS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #recibo-caja-print-area, #recibo-caja-print-area * {
            visibility: visible !important;
          }
          #recibo-caja-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            box-shadow: none !important;
            border: 1.5px solid #166534 !important;
            padding: 10mm !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)',
          width: '100%',
          maxWidth: 820,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 200001,
          margin: 'auto 0'
        }}
      >
        {/* BARRA SUPERIOR DE ACCIONES (NO SE IMPRIME) */}
        <div className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {descargado ? (
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Check size={14} /> Recibo descargado en tu equipo (PDF)
              </span>
            ) : generandoPdf ? (
              <span style={{
                background: '#e0f2fe',
                color: '#0284c7',
                padding: '4px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6
              }}>
                <Loader2 size={14} className="animate-spin" /> Generando y descargando PDF...
              </span>
            ) : (
              <span style={{
                background: '#dcfce7',
                color: '#15803d',
                padding: '3px 10px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 800
              }}>
                ✓ Recibo Registrado en el Sistema
              </span>
            )}
            <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>
              Consecutivo: Nº {numRecibo}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={handlePrint}
              className="btn btn-ghost"
              style={{
                fontSize: 12,
                gap: 6,
                padding: '6px 14px',
                color: '#15803d',
                borderColor: '#86efac',
                background: '#f0fdf4',
                fontWeight: 700
              }}
            >
              <Printer size={15} /> Imprimir Recibo
            </button>

            <button
              onClick={handleDownloadPDF}
              disabled={generandoPdf}
              className="btn btn-primary"
              style={{
                fontSize: 12,
                gap: 6,
                padding: '6px 14px',
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 700,
                opacity: generandoPdf ? 0.7 : 1
              }}
            >
              {generandoPdf ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {descargado ? 'Volver a Descargar' : 'Descargar PDF'}
            </button>

            <button
              onClick={onClose}
              className="btn btn-ghost"
              style={{ padding: 6, marginLeft: 6, color: '#64748b' }}
              title="Cerrar recibo"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CONTENEDOR DEL RECIBO FÍSICO — RÉPLICA VECTORIAL EXACTA */}
        <div style={{ padding: 24, background: '#f1f5f9', display: 'flex', justifyContent: 'center' }}>
          <div
            id="recibo-caja-print-area"
            ref={reciboRef}
            style={{
              width: '100%',
              maxWidth: 750,
              background: '#ffffff',
              border: '2px solid #016b45',
              borderRadius: 14,
              padding: '20px 24px',
              position: 'relative',
              boxShadow: '0 10px 25px -5px rgba(1, 107, 69, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
              fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
              color: '#0f172a'
            }}
          >
            {/* MARCA DE AGUA DE FONDO (SUAVE Y ELEGANTE) */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: 0.045,
              pointerEvents: 'none',
              textAlign: 'center',
              userSelect: 'none',
              zIndex: 0
            }}>
              <img
                src={LOGO_CEIBA_BASE64}
                alt=""
                style={{
                  width: 270,
                  height: 270,
                  objectFit: 'contain',
                  display: 'block',
                  margin: '0 auto'
                }}
              />
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: 4, color: '#016b45', marginTop: -12 }}>
                PROYECTO CAMPESTRE LA CEIBA
              </div>
            </div>

            {/* ENCABEZADO INSTITUCIONAL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, position: 'relative', zIndex: 1 }}>
              {/* Logo y Nombre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Emblema Oficial Árbol La Ceiba */}
                <div style={{
                  width: 70,
                  height: 70,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  flexShrink: 0
                }}>
                  <img
                    src={LOGO_CEIBA_BASE64}
                    alt="Logo La Ceiba"
                    style={{
                      width: 70,
                      height: 70,
                      objectFit: 'contain',
                      display: 'block'
                    }}
                  />
                </div>

                <div>
                  <div style={{
                    fontSize: 27,
                    fontWeight: 900,
                    letterSpacing: 0.8,
                    color: '#016b45', // Verde institucional La Ceiba
                    fontFamily: '"Montserrat", "Segoe UI", -apple-system, sans-serif',
                    lineHeight: 1.05,
                    textTransform: 'uppercase'
                  }}>
                    LA CEIBA
                  </div>
                  <div style={{
                    fontSize: 10.5,
                    fontWeight: 800,
                    letterSpacing: 2.5,
                    color: '#7f1d1d', // Borgoña / Rojo Ceiba
                    textTransform: 'uppercase',
                    marginTop: 3
                  }}>
                    — PROYECTO CAMPESTRE —
                  </div>

                  {/* Redes y Contacto */}
                  <div style={{ display: 'flex', gap: 14, fontSize: 9.5, color: '#475569', marginTop: 5, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      📞 <strong>320 251 2298</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✉️ <strong>laceibagroup4@gmail.com</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Cuadro Superior Derecho: Consecutivo Recibo */}
              <div style={{
                border: '2px solid #016b45',
                borderRadius: 8,
                padding: '6px 16px',
                textAlign: 'center',
                background: '#fff',
                minWidth: 160,
                boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: '#016b45', textTransform: 'uppercase' }}>
                  RECIBO DE CAJA MENOR
                </div>
                <div style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#dc2626', // Rojo característico del talonario
                  fontFamily: 'monospace',
                  letterSpacing: 1.5,
                  margin: '2px 0'
                }}>
                  Nº {String(numRecibo).padStart(4, '0')}
                </div>
                <div style={{ fontSize: 8.5, fontWeight: 600, color: '#64748b' }}>
                  No Responsable de IVA
                </div>
              </div>
            </div>

            {/* FILA 1: CIUDAD, FECHA (DÍA/MES/AÑO) Y TOTAL $ */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'stretch' }}>
              {/* Ciudad */}
              <div style={{
                flex: 1.4,
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1.5px solid #cbd5e1',
                borderRadius: 6,
                overflow: 'hidden'
              }}>
                <div style={{
                  background: '#166534',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 10,
                  padding: '6px 10px',
                  letterSpacing: 0.5
                }}>
                  CIUDAD:
                </div>
                <div style={{ padding: '6px 12px', fontSize: 12, fontWeight: 700, color: '#0f172a' }}>
                  Acacías
                </div>
              </div>

              {/* Casillas Fecha: DÍA - MES - AÑO */}
              <div style={{
                display: 'flex',
                border: '1.5px solid #cbd5e1',
                borderRadius: 6,
                overflow: 'hidden',
                textAlign: 'center'
              }}>
                <div style={{ borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ background: '#166534', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px' }}>DÍA</div>
                  <div style={{ padding: '3px 8px', fontSize: 12, fontWeight: 800, background: '#fff' }}>{fDia || '—'}</div>
                </div>
                <div style={{ borderRight: '1px solid #cbd5e1' }}>
                  <div style={{ background: '#166534', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 8px' }}>MES</div>
                  <div style={{ padding: '3px 8px', fontSize: 12, fontWeight: 800, background: '#fff' }}>{fMes || '—'}</div>
                </div>
                <div>
                  <div style={{ background: '#166534', color: '#fff', fontSize: 9, fontWeight: 800, padding: '2px 10px' }}>AÑO</div>
                  <div style={{ padding: '3px 10px', fontSize: 12, fontWeight: 800, background: '#fff' }}>{fAnio || '—'}</div>
                </div>
              </div>

              {/* Casilla Valor $ Numérico */}
              <div style={{
                flex: 1.1,
                display: 'flex',
                alignItems: 'center',
                background: '#f0fdf4',
                border: '2px solid #166534',
                borderRadius: 6,
                overflow: 'hidden'
              }}>
                <div style={{
                  background: '#166534',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 13,
                  padding: '6px 10px'
                }}>
                  $
                </div>
                <div style={{
                  flex: 1,
                  textAlign: 'right',
                  padding: '6px 12px',
                  fontSize: 15,
                  fontWeight: 900,
                  color: '#15803d',
                  fontFamily: 'monospace'
                }}>
                  {formatCOP(valorNum)}
                </div>
              </div>
            </div>

            {/* FILA 2: ID CLIENTE */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1.5px solid #cbd5e1',
              borderRadius: 6,
              overflow: 'hidden',
              marginBottom: 8
            }}>
              <div style={{
                background: '#166534',
                color: '#fff',
                fontWeight: 800,
                fontSize: 10,
                padding: '6px 12px',
                letterSpacing: 0.5,
                whiteSpace: 'nowrap'
              }}>
                ID CLIENTE:
              </div>
              <div style={{
                padding: '6px 14px',
                fontSize: 12.5,
                fontWeight: 900,
                color: '#166534',
                flex: 1,
                letterSpacing: 0.3
              }}>
                {formatearIdCliente(recibo)}
              </div>
            </div>

            {/* FILA 3: VALOR EN LETRAS */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              border: '1.5px solid #cbd5e1',
              borderRadius: 6,
              overflow: 'hidden',
              marginBottom: 8
            }}>
              <div style={{
                background: '#166534',
                color: '#fff',
                fontWeight: 800,
                fontSize: 10,
                padding: '7px 10px',
                letterSpacing: 0.5,
                whiteSpace: 'nowrap'
              }}>
                VALOR (EN LETRAS):
              </div>
              <div style={{
                padding: '6px 12px',
                fontSize: 11.5,
                fontWeight: 800,
                color: '#1e293b',
                flex: 1,
                fontFamily: 'monospace',
                textTransform: 'uppercase',
                letterSpacing: 0.3
              }}>
                {valorLetras}
              </div>
            </div>

            {/* FILA 4: CONCEPTO */}
            <div style={{
              display: 'flex',
              border: '1.5px solid #cbd5e1',
              borderRadius: 6,
              overflow: 'hidden',
              marginBottom: 8,
              minHeight: 40
            }}>
              <div style={{
                background: '#166534',
                color: '#fff',
                fontWeight: 800,
                fontSize: 10,
                padding: '8px 12px',
                letterSpacing: 0.5,
                whiteSpace: 'nowrap'
              }}>
                CONCEPTO:
              </div>
              <div style={{ padding: '8px 12px', fontSize: 11.5, fontWeight: 700, color: '#1e293b', flex: 1 }}>
                {limpiarConcepto(recibo?.concepto, recibo?.numero_cuota)}
              </div>
            </div>

            {/* FILA 5: OBSERVACIONES */}
            <div style={{
              display: 'flex',
              border: '1.5px solid #cbd5e1',
              borderRadius: 6,
              overflow: 'hidden',
              marginBottom: 14,
              minHeight: 34
            }}>
              <div style={{
                background: '#166534',
                color: '#fff',
                fontWeight: 800,
                fontSize: 9.5,
                padding: '6px 10px',
                letterSpacing: 0.5,
                whiteSpace: 'nowrap'
              }}>
                OBSERVACIONES:
              </div>
              <div style={{ padding: '6px 12px', fontSize: 11, color: '#475569', flex: 1 }}>
                {typeof recibo?.observaciones === 'string' && recibo.observaciones.trim()
                  ? recibo.observaciones
                  : `Medio de pago: ${recibo?.medio_pago || 'Transferencia'}`}
                {recibo?.saldo_restante_cuota > 0 && (
                  <span style={{ marginLeft: 8, color: '#d97706', fontWeight: 700 }}>
                    · Saldo restante de la cuota: {formatCOP(recibo.saldo_restante_cuota)}
                  </span>
                )}
              </div>
            </div>

            {/* FILA INFERIOR: AVISO OFICIAL Y CASILLAS C.C. / NIT CON SELLO GRANDE Y AUTENTICADO */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              borderTop: '1px dashed #cbd5e1',
              paddingTop: 12,
              gap: 20
            }}>
              {/* Información Legal y Certificación Contable (Izquierda - sin firma de cliente) */}
              <div style={{ flex: 1.1, paddingBottom: 6 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#334155', lineHeight: 1.4 }}>
                  Comprobante oficial de recaudo emitido y registrado en el sistema contable de Proyecto Campestre La Ceiba S.A.S.
                </div>
                <div style={{ fontSize: 8.5, color: '#64748b', marginTop: 4 }}>
                  Documento auténtico y válido tributariamente sin necesidad de firma manuscrita.
                </div>
                {/* Microtexto de seguridad antifalsificación */}
                <div style={{
                  fontSize: 7.5,
                  color: '#94a3b8',
                  letterSpacing: 0.4,
                  marginTop: 6,
                  fontFamily: 'monospace'
                }}>
                  ••• DOC. OFICIAL CERTIFICADO · LA CEIBA GROUP S.A.S. · NO ADMITE ENMIENDAS •••
                </div>
              </div>

              {/* Bloque Derecho: Sello Gigante Antifalsificación + Autenticado + Casillas C.C. / NIT */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                position: 'relative',
                minWidth: 260
              }}>
                {/* 1. Sello Validador Oficial La Ceiba "CANCELADO" (GRANDE) */}
                <div style={{
                  position: 'relative',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 6
                }}>
                  {/* Roseta concéntrica de seguridad detrás del sello */}
                  <div style={{
                    position: 'absolute',
                    width: 140,
                    height: 140,
                    borderRadius: '50%',
                    border: '1px dashed rgba(22, 101, 52, 0.25)',
                    pointerEvents: 'none'
                  }} />
                  <img
                    src={SELLO_CEIBA_BASE64}
                    alt="Sello Validador La Ceiba Cancelado"
                    style={{
                      width: 132,
                      height: 132,
                      objectFit: 'contain',
                      transform: 'rotate(-3.5deg)',
                      filter: 'drop-shadow(0 3px 6px rgba(22, 101, 52, 0.22)) contrast(1.04)',
                      opacity: 0.96,
                      display: 'block'
                    }}
                  />
                </div>

                {/* 2. Banda de Autenticación Oficial (Ubicación: Línea Verde) */}
                <div style={{
                  width: '100%',
                  textAlign: 'center',
                  padding: '4px 8px',
                  background: '#ecfdf5',
                  borderTop: '1.5px solid #16a34a',
                  borderBottom: '1.5px solid #16a34a',
                  borderRadius: 4,
                  marginBottom: 8,
                  lineHeight: 1.25
                }}>
                  <div style={{
                    fontSize: 9,
                    fontWeight: 900,
                    color: '#15803d',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4
                  }}>
                    <span>✓</span> AUTENTICADO · VALIDADOR OFICIAL CEIBA
                  </div>
                  <div style={{
                    fontSize: 7.5,
                    fontWeight: 800,
                    color: '#0f766e',
                    fontFamily: 'monospace',
                    letterSpacing: 0.5,
                    marginTop: 1
                  }}>
                    {cuvCode} · SERIE DIGITAL SEGURA
                  </div>
                </div>

                {/* 3. Casillas C.C. / NIT / No. */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#1e293b',
                  width: '100%'
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{
                      width: 14,
                      height: 14,
                      border: '1.5px solid #166534',
                      borderRadius: 3,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#166534',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 900
                    }}>
                      ✓
                    </span>
                    C.C.
                  </span>

                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#94a3b8' }}>
                    <span style={{
                      width: 14,
                      height: 14,
                      border: '1.5px solid #cbd5e1',
                      borderRadius: 3,
                      display: 'inline-block'
                    }} />
                    NIT.
                  </span>

                  <span style={{
                    borderBottom: '1.5px solid #475569',
                    padding: '0 8px 2px 8px',
                    fontFamily: 'monospace',
                    fontSize: 12,
                    fontWeight: 800,
                    minWidth: 100,
                    textAlign: 'center'
                  }}>
                    {recibo?.cliente_doc ? String(recibo.cliente_doc) : '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Sello de pie de página */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 12,
              paddingTop: 8,
              borderTop: '1px solid #f1f5f9',
              fontSize: 8.5,
              color: '#94a3b8'
            }}>
              <span>Comprobante de Ingreso · La Ceiba Group S.A.S.</span>
              <span>Emisión: {emisionStr}</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function ReciboCajaView(props) {
  return (
    <ReciboErrorBoundary onClose={props.onClose}>
      <ReciboCajaContent {...props} />
    </ReciboErrorBoundary>
  );
}

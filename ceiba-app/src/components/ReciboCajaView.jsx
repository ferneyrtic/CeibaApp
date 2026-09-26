import React, { useRef, useState, useEffect } from 'react';
import { Printer, Download, X, Check, Copy, Loader2, AlertTriangle } from 'lucide-react';
import { formatCOP } from '../utils/helpers';
import { numeroALetrasCOP } from '../utils/numeroALetras';
import { LOGO_CEIBA_BASE64 } from '../assets/logoBase64';

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
      return (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
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
        </div>
      );
    }
    return this.props.children;
  }
}

function ReciboCajaContent({ recibo, onClose, onPrint, autoDownload = false }) {
  const reciboRef = useRef(null);
  const [descargado, setDescargado] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  if (!recibo) return null;

  const numRecibo = recibo?.numero_recibo || 3175;
  const valorNum = Math.round(Number(recibo?.valor) || 0);
  const valorLetras = typeof recibo?.valor_letras === 'string' && recibo.valor_letras.trim()
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
        } catch (e) {}
        doc.setFontSize(15);
        doc.setTextColor(1, 107, 69);
        doc.text('PROYECTO CAMPESTRE LA CEIBA', 36, 17);
        doc.setFontSize(9.5);
        doc.setTextColor(127, 29, 29);
        doc.text('RECIBO DE CAJA MENOR', 36, 22);
        doc.setTextColor(71, 85, 105);
        doc.setFontSize(8);
        doc.text('Acacías, Meta · Cel: 320 251 2298 · laceibagroup4@gmail.com', 36, 26);
        doc.setDrawColor(1, 107, 69);
        doc.setLineWidth(0.4);
        doc.line(12, 32, 198, 32);
        doc.setTextColor(15, 23, 42);
        doc.setFontSize(10);
        doc.text(`Recibo Nº: ${numRecibo}`, 14, 40);
        doc.text(`Ciudad: Acacías | Fecha: ${fDia}/${fMes}/${fAnio}`, 14, 48);
        doc.text(`Cliente: ${String(recibo?.cliente_nombre || '')} (Doc: ${String(recibo?.cliente_doc || '')})`, 14, 56);
        doc.text(`Lote: ${String(recibo?.lote_id_str || '')}`, 14, 64);
        doc.text(`Valor: $${valorNum.toLocaleString('es-CO')} (${valorLetras})`, 14, 72);
        doc.text(`Concepto: ${String(recibo?.concepto || '')}`, 14, 80);
        doc.text(`Observaciones: ${String(recibo?.observaciones || '')}`, 14, 88);
        doc.save(`Recibo_Caja_${numRecibo}.pdf`);
        setDescargado(true);
      } catch (fallbackErr) {
        console.error('Error generando fallback jsPDF:', fallbackErr);
      }
    } finally {
      setGenerandoPdf(false);
    }
  };

  useEffect(() => {
    if (autoDownload || recibo?.autoDownload) {
      const timer = setTimeout(() => {
        handleDownloadPDF();
      }, 450);
      return () => clearTimeout(timer);
    }
  }, [autoDownload, recibo?.autoDownload]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.75)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: 16,
      overflowY: 'auto'
    }}>
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

      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
        width: '100%',
        maxWidth: 820,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      📍 <strong>Acacías, Meta</strong>
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

            {/* FILA 2: PAGADO A (SIEMPRE PROYECTO CAMPESTRE LA CEIBA) */}
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
                PAGADO A:
              </div>
              <div style={{
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 900,
                color: '#166534',
                flex: 1,
                letterSpacing: 0.5
              }}>
                PROYECTO CAMPESTRE LA CEIBA
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
              <div style={{ padding: '8px 12px', fontSize: 11.5, fontWeight: 600, color: '#334155', flex: 1 }}>
                {typeof recibo?.concepto === 'string' ? recibo.concepto : (recibo?.concepto ? String(recibo.concepto) : 'Abono a cuota pactada')}
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

            {/* FILA INFERIOR: FIRMA DE RECIBIDO Y CASILLAS C.C. / NIT */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-end',
              borderTop: '1px dashed #cbd5e1',
              paddingTop: 14,
              gap: 20
            }}>
              {/* Firma */}
              <div style={{ flex: 1.2 }}>
                <div style={{ borderBottom: '1.5px solid #475569', width: '85%', marginBottom: 4 }} />
                <div style={{ fontSize: 9.5, fontWeight: 800, color: '#475569', letterSpacing: 0.5 }}>
                  FIRMA DE RECIBIDO {recibo?.cliente_nombre ? `· ${String(recibo.cliente_nombre).toUpperCase()}` : ''}
                </div>
              </div>

              {/* Casillas C.C. / NIT / No. */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 11,
                fontWeight: 700,
                color: '#1e293b'
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
    </div>
  );
}

export default function ReciboCajaView(props) {
  return (
    <ReciboErrorBoundary onClose={props.onClose}>
      <ReciboCajaContent {...props} />
    </ReciboErrorBoundary>
  );
}

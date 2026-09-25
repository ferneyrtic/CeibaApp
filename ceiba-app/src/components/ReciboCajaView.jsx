import React, { useRef } from 'react';
import { Printer, Download, X, Check, Copy } from 'lucide-react';
import { formatCOP } from '../utils/helpers';
import { numeroALetrasCOP } from '../utils/numeroALetras';

export default function ReciboCajaView({ recibo, onClose, onPrint }) {
  const reciboRef = useRef(null);

  if (!recibo) return null;

  const numRecibo = recibo.numero_recibo || 3175;
  const valorNum = Math.round(Number(recibo.valor) || 0);
  const valorLetras = recibo.valor_letras || numeroALetrasCOP(valorNum);

  // Desglosar fecha (YYYY-MM-DD)
  const fechaStr = recibo.fecha_pago || new Date().toISOString().slice(0, 10);
  const [fAnio, fMes, fDia] = fechaStr.split('-');

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      const { default: jsPDF } = await import('jspdf');

      if (!reciboRef.current) return;

      const canvas = await html2canvas(reciboRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff'
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
      pdf.save(`Recibo_Caja_${numRecibo}_${recibo.lote_id_str || 'Ceiba'}.pdf`);
    } catch (err) {
      console.error('Error generando PDF del recibo:', err);
      window.print();
    }
  };

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
              className="btn btn-primary"
              style={{
                fontSize: 12,
                gap: 6,
                padding: '6px 14px',
                background: '#16a34a',
                borderColor: '#16a34a',
                fontWeight: 700
              }}
            >
              <Download size={15} /> Descargar PDF
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
              border: '2px solid #166534',
              borderRadius: 14,
              padding: '18px 22px',
              position: 'relative',
              boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
              fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
              color: '#0f172a'
            }}
          >
            {/* MARCA DE AGUA DE FONDO (SUAVE) */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: 0.05,
              pointerEvents: 'none',
              textAlign: 'center',
              userSelect: 'none'
            }}>
              <svg width="260" height="260" viewBox="0 0 100 100" fill="#166534">
                <path d="M50 10 C30 10 20 25 20 40 C20 55 35 65 45 70 L45 90 L55 90 L55 70 C65 65 80 55 80 40 C80 25 70 10 50 10 Z" />
              </svg>
              <div style={{ fontSize: 32, fontWeight: 900, letterSpacing: 4, color: '#166534', marginTop: -20 }}>
                LA CEIBA
              </div>
            </div>

            {/* ENCABEZADO INSTITUCIONAL */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              {/* Logo y Nombre */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Emblema Árbol Verde */}
                <div style={{
                  width: 58,
                  height: 58,
                  borderRadius: '50%',
                  border: '2px solid #166534',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f0fdf4'
                }}>
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#166534" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a7 7 0 0 0-7 7c0 2.38 1.19 4.47 3 5.74V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-5.26c1.81-1.27 3-3.36 3-5.74a7 7 0 0 0-7-7z" />
                    <path d="M12 12v10" />
                  </svg>
                </div>

                <div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 900,
                    letterSpacing: -0.5,
                    color: '#7f1d1d', // Borgoña / Rojo Ceiba
                    fontFamily: 'Georgia, serif',
                    lineHeight: 1
                  }}>
                    La Ceiba
                  </div>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 2,
                    color: '#166534',
                    textTransform: 'uppercase',
                    marginTop: 4
                  }}>
                    — PROYECTO CAMPESTRE —
                  </div>

                  {/* Redes y Contacto */}
                  <div style={{ display: 'flex', gap: 14, fontSize: 10, color: '#475569', marginTop: 6, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      📞 <strong>3202512298</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✉️ <strong>laceibagroup4@gmail.com</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      🌐 <strong>La Ceiba Group · @laceibagroup</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Cuadro Superior Derecho: Consecutivo Recibo */}
              <div style={{
                border: '2px solid #166534',
                borderRadius: 10,
                padding: '6px 16px',
                textAlign: 'center',
                background: '#fff',
                minWidth: 160
              }}>
                <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: '#166534', textTransform: 'uppercase' }}>
                  RECIBO DE CAJA MENOR
                </div>
                <div style={{
                  fontSize: 22,
                  fontWeight: 900,
                  color: '#dc2626', // Rojo característico del talonario
                  fontFamily: 'monospace',
                  letterSpacing: 1,
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
                  {recibo.ciudad || 'Bogotá D.C.'}
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

            {/* FILA 2: PAGADO A / PAGADO POR */}
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
                fontWeight: 800,
                color: '#0f172a',
                flex: 1,
                textTransform: 'uppercase'
              }}>
                {recibo.cliente_nombre || '—'}
              </div>
              {recibo.lote_id_str && (
                <div style={{
                  padding: '4px 10px',
                  marginRight: 8,
                  background: '#e2e8f0',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 800,
                  fontFamily: 'monospace'
                }}>
                  Lote {recibo.lote_id_str}
                </div>
              )}
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
                {recibo.concepto || 'Abono a cuota pactada'}
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
                {recibo.observaciones || `Medio de pago: ${recibo.medio_pago || 'Transferencia'}`}
                {recibo.saldo_restante_cuota > 0 && (
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
                  FIRMA DE RECIBIDO
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
                  {recibo.cliente_doc || '—'}
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
              <span>Emisión: {new Date(recibo.created_at || Date.now()).toLocaleString('es-CO')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
